import { after, NextResponse } from 'next/server'
import { ensureBusinessDay } from "@/lib/business-day-server"
import { kitchenOrderPush, sendStationPush } from '@/lib/push'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { orderSources } from '@/components/warsztat/order-data'
import { orderColumns } from '@/components/warsztat/order-rows'
import { clubPricing } from '@/lib/club-pricing'
import { getTier } from '@/lib/loyalty'
import { claimWorkshopCode, normalizeWorkshopCode, WorkshopCodeError, type WorkshopCodeClaim } from '@/lib/workshop-codes'
import { loadStationResolver } from '@/lib/order-stations'
import { priceOrderLines, type PricedItem } from '@/lib/workshop-order-lines'
import { autoPackaging, packagingItems, packagingTotal, parsePackaging } from '@/lib/packaging'
import { loadRestaurantSettings } from '@/lib/restaurant-state'
import { checkDeliveryZone, splitAddress } from '@/lib/delivery-zone'
import { DEFAULT_DELIVERY_ZONES } from '@/lib/order-settings'
import { isValidPhone, normalizePhone } from '@/lib/phone'
import { inStoreChannel, promotionDiscount, promotionNote } from '@/lib/promotions'
import { loadActivePromotions } from '@/lib/promotions-server'

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
  clubPhone?: string
  scheduledFor?: string | null
  lines?: { productId?: string; quantity?: number; note?: string; selection?: unknown }[]
  packaging?: unknown
  /** The cashier settles first; the order goes to the kitchen only after payment. */
  payNow?: boolean
  /** Generated in the browser; a retried request with the same id returns the already saved order. */
  clientRequestId?: string
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isMissingColumn = (error: { code?: string } | null) => error?.code === '42703' || error?.code === 'PGRST204'

async function findByRequestId(admin: ReturnType<typeof createAdminClient>, clientRequestId: string) {
  const { data, error } = await admin.from('orders').select(orderColumns).eq('client_request_id', clientRequestId).maybeSingle<{ id: string; number: number }>()
  return error ? null : data
}

const duplicateResponse = (order: { id: string; number: number }) =>
  NextResponse.json({ orderId: order.id, orderNumber: order.number, clubPoints: null, order, duplicate: true }, { status: 200 })

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Zaloguj się ponownie.' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!ALLOWED_ROLES.includes(profile?.role ?? '')) return NextResponse.json({ error: 'Brak uprawnień do dodawania zamówień.' }, { status: 403 })

  const body = (await request.json().catch(() => null)) as Body | null
  const admin = createAdminClient()
  await ensureBusinessDay(admin)
  const clientRequestId = typeof body?.clientRequestId === 'string' && UUID_PATTERN.test(body.clientRequestId) ? body.clientRequestId : null
  if (clientRequestId) {
    const existing = await findByRequestId(admin, clientRequestId)
    if (existing) return duplicateResponse(existing)
  }
  const source = body?.source as (typeof SOURCES)[number]
  const type = body?.type as (typeof TYPES)[number]
  if (!SOURCES.includes(source) || !TYPES.includes(type) || (source !== 'own' && type === 'Stacjonarnie')) {
    return NextResponse.json({ error: 'Nieprawidłowe źródło lub typ zamówienia.' }, { status: 400 })
  }
  const address = body?.address?.trim().slice(0, 200) ?? ''
  if (source !== 'glovo' && type === 'Dostawa' && address.length < 3) return NextResponse.json({ error: 'Podaj adres dostawy.' }, { status: 400 })
  if (source === 'glovo' && !body?.externalNumber?.trim()) return NextResponse.json({ error: 'Podaj numer zamówienia Glovo.' }, { status: 400 })
  if (source === 'pyszne' && !body?.customer?.trim()) return NextResponse.json({ error: 'Podaj imię klienta.' }, { status: 400 })

  let scheduledFor: string | null = null
  if (body?.scheduledFor) {
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

  let clubMember: { id: string; full_name: string | null; status_points: number | null } | null = null
  if (body?.clubPhone) {
    if (source !== 'own') return NextResponse.json({ error: 'Punkty Yummy Club nalicza się tylko do zamówień własnych.' }, { status: 400 })
    const clubPhone = normalizePhone(body.clubPhone)
    if (!isValidPhone(clubPhone)) return NextResponse.json({ error: 'Numer Yummy Club musi mieć 9 cyfr.' }, { status: 400 })
    const { data } = await admin.from('profiles').select('id, full_name, status_points').eq('phone', clubPhone).eq('role', 'klient').maybeSingle()
    if (!data) return NextResponse.json({ error: 'Nie znaleziono konta Yummy Club z tym numerem.' }, { status: 404 })
    clubMember = data
  }

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
  let applied = claim?.code ?? null
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
  const promotion = source === 'own' ? promotionDiscount(priced.value.promoLines, await loadActivePromotions(admin), inStoreChannel(type === 'Dostawa')) : { discount: 0, applied: [] }
  const memberTier = clubMember ? getTier(clubMember.status_points ?? 0) : null
  const pricing = clubPricing({ productsValue: foodSubtotal, promotionDiscount: promotion.discount, code: applied, tierPercent: memberTier?.percent ?? 0 })
  if (pricing.codeSkipped) {
    await claim?.release()
    claim = null
    applied = null
  }
  const discount = pricing.discount
  const tierNote = pricing.tierAmount > 0 && memberTier ? `Rabat statusowy ${memberTier.name} -${memberTier.percent}%` : null
  const packaging = body?.packaging === undefined ? autoPackaging(priced.value.products, type) : parsePackaging(body.packaging)
  if (!packaging) {
    await claim?.release()
    return NextResponse.json({ error: 'Nieprawidłowe opakowania.' }, { status: 400 })
  }
  const restaurantSettings = await loadRestaurantSettings(admin)
  const packagingPrices = restaurantSettings?.packagingPrices
  // Own deliveries pay the zone fee like online orders; an address outside the zone (cashier warned) stays at 0.
  let deliveryFee = 0
  let distanceKm: number | null = null
  // Distance is measured once here and stored, so the kitchen board never geocodes on its own.
  if (source !== 'glovo' && type === 'Dostawa') {
    const { street, city } = splitAddress(address)
    const zone = await checkDeliveryZone(street, city, restaurantSettings?.deliveryZones ?? DEFAULT_DELIVERY_ZONES)
    if (zone.ok && source === 'own') deliveryFee = zone.fee
    distanceKm = zone.ok ? zone.distanceKm : zone.distanceKm ?? null
  }
  const allItems = [...items, ...packagingItems(packaging, packagingPrices, restaurantSettings?.packagingVat)]
  const subtotal = Math.round((foodSubtotal + packagingTotal(packaging, packagingPrices)) * 100) / 100
  const sourceLabel = orderSources[source].label
  const externalNumber = body?.externalNumber?.trim().slice(0, 40)
  const noteText = [promotion.applied.length ? promotionNote(promotion.applied) : null, applied && `Kod ${applied.code}: ${applied.reward.replaceAll(' · ', ', ')}`, tierNote, externalNumber && `Nr ${sourceLabel}: ${externalNumber}`, body?.note?.trim().slice(0, 500)].filter(Boolean).join(' · ') || null
  const customer = body?.customer?.trim().slice(0, 120) || applied?.customer || clubMember?.full_name || (type === 'Stacjonarnie' ? 'Klient stacjonarny' : source === 'own' ? 'Klient' : `Klient ${sourceLabel}`)

  // Staff entering an order by hand has already accepted it, so it skips the „Nowe” step and goes straight to the kitchen.
  const acceptNow = body?.payNow !== true
  const row = {
    ...(acceptNow ? { status: 'preparing', started_at: new Date().toISOString() } : {}),
    type,
    customer,
    phone: body?.phone?.trim().slice(0, 30) ?? '',
    address: type === 'Dostawa' ? address : null,
    items: allItems,
    eta: scheduledClock ? `Na ${scheduledClock}` : type === 'Dostawa' ? '30–45 min' : type === 'Stacjonarnie' ? 'Na miejscu' : '15 min',
    scheduled_for: scheduledFor,
    subtotal,
    discount,
    delivery_fee: deliveryFee,
    distance_km: distanceKm,
    total: Math.round((subtotal - discount + deliveryFee) * 100) / 100,
    customer_id: clubMember?.id ?? applied?.customerId ?? null,
    club_savings: clubMember || applied?.customerId ? discount : 0,
  }

  // „Dodaj i rozlicz” needs the full row so the payment dialog opens without another round trip.
  const returning = !acceptNow ? orderColumns : 'id, number'
  let result = await admin.from('orders').insert({ ...row, source, note: noteText, ...(clientRequestId ? { client_request_id: clientRequestId } : {}) }).select(returning).single<{ id: string; number: number }>()
  // Until the optional `source` / `client_request_id` columns exist, keep the origin as a tag at the start of the note.
  if (result.error && isMissingColumn(result.error)) {
    result = await admin.from('orders').insert({ ...row, note: [orderSources[source].tag, noteText].filter(Boolean).join(' ') }).select(returning.replace(', source', '')).single<{ id: string; number: number }>()
  }
  // Two identical requests raced: the other one already saved this order.
  if (result.error?.code === '23505' && clientRequestId) {
    await claim?.release()
    const existing = await findByRequestId(admin, clientRequestId)
    if (existing) return duplicateResponse(existing)
  }
  if (result.error || !result.data) {
    await claim?.release()
    return NextResponse.json({ error: 'Nie udało się zapisać zamówienia. Kod nadal jest aktywny.' }, { status: 503 })
  }

  // Stars are awarded by the database when the order is handed off, so a cancelled order never earns them.
  const clubPoints = null
  if (acceptNow && allItems.some((item) => (item.station ?? 'kitchen') === 'kitchen')) {
    const orderNumber = result.data.number
    after(() => sendStationPush('kitchen', kitchenOrderPush(orderNumber, type)))
  }
  return NextResponse.json({ orderId: result.data.id, orderNumber: result.data.number, clubPoints, order: !acceptNow ? result.data : undefined }, { status: 201 })
}
