import { after, NextResponse } from 'next/server'
import { ensureBusinessDay } from "@/lib/business-day-server"
import { newOrderPush, sendStationPush } from '@/lib/push'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles } from '@/lib/workshop-auth'
import { KIOSK_ROLES } from '@/lib/kiosk'
import { clubPricing } from '@/lib/club-pricing'
import { getTier } from '@/lib/loyalty'
import { claimWorkshopCode, normalizeWorkshopCode, WorkshopCodeError, type WorkshopCodeClaim } from '@/lib/workshop-codes'
import { loadStationResolver } from '@/lib/order-stations'
import { priceOrderLines, type PricedItem } from '@/lib/workshop-order-lines'
import { autoPackaging, packagingItems, packagingTotal } from '@/lib/packaging'
import { loadRestaurantStatus } from '@/lib/restaurant-state'
import { stationLabel, stationOpen } from '@/lib/restaurant-status'
import { isValidPhone, normalizePhone } from '@/lib/phone'
import { promotionDiscount, promotionNote } from '@/lib/promotions'
import { loadActivePromotions } from '@/lib/promotions-server'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Body = {
  lines?: unknown
  code?: string
  clubPhone?: string
  clientRequestId?: string
}

export async function POST(request: Request) {
  const auth = await authorizeRoles(KIOSK_ROLES)
  if ('response' in auth) return auth.response

  const body = (await request.json().catch(() => null)) as Body | null
  const admin = createAdminClient()
  await ensureBusinessDay(admin)
  const clientRequestId = typeof body?.clientRequestId === 'string' && UUID_PATTERN.test(body.clientRequestId) ? body.clientRequestId : null
  if (clientRequestId) {
    const { data: existing } = await admin.from('orders').select('number').eq('client_request_id', clientRequestId).maybeSingle<{ number: number }>()
    if (existing) return NextResponse.json({ orderNumber: existing.number, duplicate: true })
  }

  if (!Array.isArray(body?.lines) || body.lines.length < 1) return NextResponse.json({ error: 'Koszyk jest pusty.' }, { status: 400 })

  const status = await loadRestaurantStatus(admin)
  if (!status) return NextResponse.json({ error: 'Nie udało się sprawdzić, czy lokal przyjmuje zamówienia.' }, { status: 503 })
  if (!status.acceptingOrders) return NextResponse.json({ error: status.reason }, { status: 423 })

  let clubMember: { id: string; full_name: string | null; status_points: number | null } | null = null
  if (body.clubPhone) {
    const clubPhone = normalizePhone(body.clubPhone)
    if (!isValidPhone(clubPhone)) return NextResponse.json({ error: 'Numer telefonu musi mieć 9 cyfr.' }, { status: 400 })
    const { data } = await admin.from('profiles').select('id, full_name, status_points').eq('phone', clubPhone).eq('role', 'klient').maybeSingle()
    if (!data) return NextResponse.json({ error: 'Nie znaleziono konta Yummy Club z tym numerem.' }, { status: 404 })
    clubMember = data
  }

  const priced = await priceOrderLines(admin, body.lines)
  if (!priced.ok) return NextResponse.json({ error: priced.error }, { status: priced.status })

  const code = normalizeWorkshopCode(body.code)
  let claim: WorkshopCodeClaim | null = null
  if (code) {
    try {
      claim = await claimWorkshopCode(admin, code)
    } catch (error) {
      return NextResponse.json({ error: error instanceof WorkshopCodeError ? error.message : 'Nie udało się sprawdzić kodu.' }, { status: 409 })
    }
  }
  let applied = claim?.code ?? null

  const stationFor = await loadStationResolver(admin)
  const items: PricedItem[] = [
    ...priced.value.items,
    ...(applied?.items ?? []).map((item) => ({ quantity: item.quantity, name: item.name, options: `Gratis · kod ${applied!.code}`, unitPrice: 0, station: stationFor(item.name) as PricedItem['station'] })),
  ]

  const blocked = items.find((item) => !stationOpen(status, item.station ?? 'kitchen'))
  if (blocked) {
    await claim?.release()
    const station = blocked.station ?? 'kitchen'
    return NextResponse.json({ error: `${stationLabel(station)} jest chwilowo wyłączon${station === 'kitchen' ? 'a' : 'y'} – „${blocked.name}” nie jest teraz dostępne.` }, { status: 409 })
  }

  const foodSubtotal = Math.round(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) * 100) / 100
  const promotion = promotionDiscount(priced.value.promoLines, await loadActivePromotions(admin), 'in_store')
  const memberTier = clubMember ? getTier(clubMember.status_points ?? 0) : null
  const pricing = clubPricing({ productsValue: foodSubtotal, promotionDiscount: promotion.discount, code: applied, tierPercent: memberTier?.percent ?? 0 })
  if (pricing.codeSkipped) {
    await claim?.release()
    claim = null
    applied = null
  }
  const discount = pricing.discount
  const tierNote = pricing.tierAmount > 0 && memberTier ? `Rabat statusowy ${memberTier.name} -${memberTier.percent}%` : null
  const packaging = autoPackaging(priced.value.products, 'Stacjonarnie')
  const allItems = [...items, ...packagingItems(packaging, status.packagingPrices, status.packagingVat)]
  const subtotal = Math.round((foodSubtotal + packagingTotal(packaging, status.packagingPrices)) * 100) / 100
  const note = [promotion.applied.length ? promotionNote(promotion.applied) : null, applied && `Kod ${applied.code}: ${applied.reward.replaceAll(' · ', ', ')}`, tierNote].filter(Boolean).join(' · ') || null
  const customerId = clubMember?.id ?? applied?.customerId ?? null

  const { data: order, error } = await admin.from('orders').insert({
    type: 'Stacjonarnie',
    source: 'kiosk',
    customer: clubMember?.full_name || applied?.customer || 'Klient kiosku',
    phone: '',
    address: null,
    items: allItems,
    note,
    eta: 'Na miejscu',
    subtotal,
    discount,
    delivery_fee: 0,
    total: Math.round((subtotal - discount) * 100) / 100,
    customer_id: customerId,
    club_savings: customerId ? discount : 0,
    ...(clientRequestId ? { client_request_id: clientRequestId } : {}),
  }).select('id, number').single<{ id: string; number: number }>()

  if (error?.code === '23505' && clientRequestId) {
    await claim?.release()
    const { data: existing } = await admin.from('orders').select('number').eq('client_request_id', clientRequestId).maybeSingle<{ number: number }>()
    if (existing) return NextResponse.json({ orderNumber: existing.number, duplicate: true })
  }
  if (error || !order) {
    await claim?.release()
    return NextResponse.json({ error: 'Nie udało się zapisać zamówienia. Spróbuj ponownie.' }, { status: 503 })
  }

  after(() => sendStationPush('cashier', newOrderPush(order.number, 'Kiosk · Na miejscu')))
  return NextResponse.json({ orderNumber: order.number }, { status: 201 })
}
