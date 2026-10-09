import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { orderSources } from '@/components/warsztat/order-data'
import { codeDiscount } from '@/lib/checkout-codes'
import { claimWorkshopCode, normalizeWorkshopCode, WorkshopCodeError, type WorkshopCodeClaim } from '@/lib/workshop-codes'
import { loadStationResolver } from '@/lib/order-stations'
import { priceOrderLines, type PricedItem } from '@/lib/workshop-order-lines'
import { autoPackaging, packagingItems, packagingTotal, parsePackaging } from '@/lib/packaging'
import { loadRestaurantSettings } from '@/lib/restaurant-state'

const ALLOWED_ROLES = ['admin', 'szef', 'kuchnia', 'kelner']
const SOURCES = ['own', 'glovo', 'pyszne'] as const
const TYPES = ['Dostawa', 'Odbiór osobisty', 'Stacjonarnie'] as const

type Body = {
  source?: string
  type?: string
  customer?: string
  phone?: string
  address?: string
  externalNumber?: string
  note?: string
  code?: string
  scheduledFor?: string | null
  lines?: { productId?: string; quantity?: number; note?: string; selection?: unknown }[]
  packaging?: unknown
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Zaloguj się ponownie.' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!ALLOWED_ROLES.includes(profile?.role ?? '')) return NextResponse.json({ error: 'Brak uprawnień do dodawania zamówień.' }, { status: 403 })

  const body = (await request.json().catch(() => null)) as Body | null
  const source = body?.source as (typeof SOURCES)[number]
  const type = body?.type as (typeof TYPES)[number]
  if (!SOURCES.includes(source) || !TYPES.includes(type) || (source !== 'own' && type === 'Stacjonarnie')) {
    return NextResponse.json({ error: 'Nieprawidłowe źródło lub typ zamówienia.' }, { status: 400 })
  }
  const address = body?.address?.trim().slice(0, 200) ?? ''
  if (type === 'Dostawa' && address.length < 3) return NextResponse.json({ error: 'Podaj adres dostawy.' }, { status: 400 })

  let scheduledFor: string | null = null
  if (body?.scheduledFor) {
    if (type === 'Stacjonarnie') return NextResponse.json({ error: 'Na godzinę można zamówić tylko odbiór osobisty lub dostawę.' }, { status: 400 })
    const scheduled = typeof body.scheduledFor === 'string' ? Date.parse(body.scheduledFor) : NaN
    if (!Number.isFinite(scheduled) || scheduled < Date.now() - 5 * 60_000 || scheduled > Date.now() + 7 * 86_400_000) {
      return NextResponse.json({ error: 'Godzina zamówienia musi być w przyszłości (maks. 7 dni).' }, { status: 400 })
    }
    scheduledFor = new Date(scheduled).toISOString()
  }
  const scheduledClock = scheduledFor && new Date(scheduledFor).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' })

  const code = normalizeWorkshopCode(body?.code)
  if (code && source !== 'own') return NextResponse.json({ error: 'Kody działają tylko dla zamówień własnych.' }, { status: 400 })

  const lines = body?.lines
  if (!Array.isArray(lines) || lines.length > 30 || (lines.length < 1 && !code)) return NextResponse.json({ error: 'Dodaj przynajmniej jedną pozycję.' }, { status: 400 })
  const admin = createAdminClient()
  const priced = await priceOrderLines(admin, lines)
  if (!priced.ok) return NextResponse.json({ error: priced.error }, { status: priced.status })
  const paidItems = priced.value.items
  type Item = PricedItem

  let claim: WorkshopCodeClaim | null = null
  if (code) {
    try {
      claim = await claimWorkshopCode(admin, code)
    } catch (error) {
      return NextResponse.json({ error: error instanceof WorkshopCodeError ? error.message : 'Nie udało się sprawdzić kodu.' }, { status: 409 })
    }
  }
  const applied = claim?.code ?? null
  if (!priced.value.productCount && !applied?.items.length) {
    await claim?.release()
    return NextResponse.json({ error: 'Dodaj przynajmniej jedną płatną pozycję – ten kod daje rabat na zamówienie.' }, { status: 400 })
  }

  const stationFor = await loadStationResolver(admin)
  const items: Item[] = [
    ...paidItems,
    ...(applied?.items ?? []).map((item) => ({ quantity: item.quantity, name: item.name, unitPrice: 0, station: stationFor(item.name) as Item['station'] })),
  ]
  const foodSubtotal = Math.round(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) * 100) / 100
  const discount = codeDiscount(foodSubtotal, applied)
  const packaging = body?.packaging === undefined ? autoPackaging(priced.value.products, type) : parsePackaging(body.packaging)
  if (!packaging) {
    await claim?.release()
    return NextResponse.json({ error: 'Nieprawidłowe opakowania.' }, { status: 400 })
  }
  const packagingPrices = (await loadRestaurantSettings(admin))?.packagingPrices
  const allItems = [...items, ...packagingItems(packaging, packagingPrices)]
  const subtotal = Math.round((foodSubtotal + packagingTotal(packaging, packagingPrices)) * 100) / 100
  const sourceLabel = orderSources[source].label
  const externalNumber = body?.externalNumber?.trim().slice(0, 40)
  const noteText = [applied && `Kod ${applied.code}: ${applied.reward.replaceAll(' · ', ', ')}`, externalNumber && `Nr ${sourceLabel}: ${externalNumber}`, body?.note?.trim().slice(0, 500)].filter(Boolean).join(' · ') || null
  const customer = body?.customer?.trim().slice(0, 120) || applied?.customer || (type === 'Stacjonarnie' ? 'Klient stacjonarny' : source === 'own' ? 'Klient' : `Klient ${sourceLabel}`)

  const row = {
    type,
    customer,
    phone: body?.phone?.trim().slice(0, 30) ?? '',
    address: type === 'Dostawa' ? address : null,
    items: allItems,
    eta: scheduledClock ? `Na ${scheduledClock}` : type === 'Dostawa' ? '30–45 min' : type === 'Stacjonarnie' ? 'Na miejscu' : '15 min',
    scheduled_for: scheduledFor,
    subtotal,
    discount,
    delivery_fee: 0,
    total: Math.round((subtotal - discount) * 100) / 100,
    customer_id: applied?.customerId ?? null,
  }

  let result = await admin.from('orders').insert({ ...row, source, note: noteText }).select('number').single()
  // Until the optional `source` column exists, keep the origin as a tag at the start of the note.
  if (result.error && (result.error.code === '42703' || result.error.code === 'PGRST204')) {
    result = await admin.from('orders').insert({ ...row, note: [orderSources[source].tag, noteText].filter(Boolean).join(' ') }).select('number').single()
  }
  if (result.error || !result.data) {
    await claim?.release()
    return NextResponse.json({ error: 'Nie udało się zapisać zamówienia. Kod nadal jest aktywny.' }, { status: 503 })
  }
  return NextResponse.json({ orderNumber: result.data.number }, { status: 201 })
}
