import { after, NextResponse } from 'next/server'
import { ensureBusinessDay } from "@/lib/business-day-server"
import { newOrderPush, sendStationPush } from '@/lib/push'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { loadCatalog } from '@/lib/menu-catalog'
import { vatOf } from '@/lib/workshop-order-lines'
import type { VatLetter } from '@/lib/vat'
import { autoPackaging, packagingItems, packagingTotal, type PackagingKind } from '@/lib/packaging'
import { loadStationResolver } from '@/lib/order-stations'
import { checkDeliveryZone } from '@/lib/delivery-zone'
import { loadRestaurantStatus } from '@/lib/restaurant-state'
import { applyFreeDelivery } from '@/lib/order-settings'
import { isWithinHours, paymentMethodEnabled, stationLabel, stationOpen } from '@/lib/restaurant-status'
import { hasConfigurator, parseSelection, resolveSelection, setFields, setKeyFor } from '@/lib/menu-config'
import { onlineChannel, promotionDiscount, promotionNote, type PromotionLine } from '@/lib/promotions'
import { loadActivePromotions } from '@/lib/promotions-server'
import { GUEST_CHECKOUT_CODE, GUEST_PROMO_CODE, checkoutCodeError, describeCodeBenefit, type CheckoutCode } from '@/lib/checkout-codes'
import { clubPricing } from '@/lib/club-pricing'
import { getTier } from '@/lib/loyalty'

const MAX_QUANTITY = 20
const formatPrice = (value: number) => `${value.toFixed(2).replace('.', ',')} zł`
const ORDER_TYPES = ['Dostawa', 'Odbiór osobisty'] as const

type SubmittedLine = { productId: string; quantity: number; details: string[]; selection?: unknown }
type ProductOption = { id: string; label: string; price: number }

const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl-PL')
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function findByRequestId(admin: ReturnType<typeof createAdminClient>, clientRequestId: string) {
  const { data, error } = await admin.from('orders').select('number').eq('client_request_id', clientRequestId).maybeSingle<{ number: number }>()
  return error ? null : data
}

export async function POST(request: Request) {
  let body: {
    customer?: string
    phone?: string
    address?: string
    city?: string
    type?: string
    promoCode?: string
    scheduledFor?: string | null
    paymentMethod?: string
    customerNote?: string | null
    lines?: SubmittedLine[]
    clientRequestId?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe dane zamówienia.' }, { status: 400 })
  }

  // A retry after a dropped connection carries the same id, so it returns the order that was already saved.
  const clientRequestId = typeof body.clientRequestId === 'string' && UUID_PATTERN.test(body.clientRequestId) ? body.clientRequestId : null
  if (clientRequestId) {
    const existing = await findByRequestId(createAdminClient(), clientRequestId)
    if (existing) return NextResponse.json({ orderNumber: existing.number, duplicate: true }, { status: 200 })
  }

  const customer = body.customer?.trim().slice(0, 120) ?? ''
  const phone = body.phone?.trim().slice(0, 30) ?? ''
  const type = body.type
  const lines = body.lines
  if (customer.length < 2 || !/^[0-9 +()-]{9,20}$/.test(phone) || !ORDER_TYPES.includes(type as (typeof ORDER_TYPES)[number])) {
    return NextResponse.json({ error: 'Sprawdź imię, telefon i sposób odbioru.' }, { status: 400 })
  }
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > 30) {
    return NextResponse.json({ error: 'Koszyk jest pusty lub zawiera zbyt wiele pozycji.' }, { status: 400 })
  }
  const preferredPayment = body.paymentMethod
  if (preferredPayment !== 'cash' && preferredPayment !== 'card') {
    return NextResponse.json({ error: 'Wybierz formę płatności.' }, { status: 400 })
  }
  if (type === 'Dostawa' && (!body.address?.trim() || !body.city?.trim())) {
    return NextResponse.json({ error: 'Podaj adres dostawy.' }, { status: 400 })
  }
  if (!body.scheduledFor) return NextResponse.json({ error: 'Wybierz godzinę zamówienia.' }, { status: 400 })
  const scheduled = typeof body.scheduledFor === 'string' ? Date.parse(body.scheduledFor) : NaN
  if (!Number.isFinite(scheduled) || scheduled < Date.now() + 10 * 60_000 || scheduled > Date.now() + 3 * 86_400_000) {
    return NextResponse.json({ error: 'Wybrana godzina jest niedostępna. Wybierz inną.' }, { status: 400 })
  }
  const scheduledFor: string = new Date(scheduled).toISOString()
  const scheduledLabel = scheduledFor && new Date(scheduledFor).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', ...(new Date(scheduledFor).toDateString() !== new Date().toDateString() ? { day: 'numeric', month: 'numeric' } : {}) })
  const quantities = new Map<string, number>()
  for (const line of lines) {
    if (typeof line?.productId !== 'string' || !Array.isArray(line.details) || line.details.length > 12 || !Number.isInteger(line.quantity) || line.quantity < 1) {
      return NextResponse.json({ error: 'Nieprawidłowa pozycja w koszyku.' }, { status: 400 })
    }
    const totalQuantity = (quantities.get(line.productId) ?? 0) + line.quantity
    if (totalQuantity > MAX_QUANTITY) return NextResponse.json({ error: 'Limit jednej pozycji to 20 sztuk.' }, { status: 400 })
    quantities.set(line.productId, totalQuantity)
  }

  const admin = createAdminClient()

  await ensureBusinessDay(admin)
  const status = await loadRestaurantStatus(admin)
  if (!status) return NextResponse.json({ error: 'Nie udało się sprawdzić, czy lokal przyjmuje zamówienia.' }, { status: 503 })
  if (status.preorderReason) return NextResponse.json({ error: status.preorderReason }, { status: 423 })
  const slot = new Date(scheduledFor)
  const slotOpen = !status.autoHours
    || isWithinHours(status.openingHours, slot, status.closeBeforeMinutes)
    || (status.overrideActive && !!status.orderingOverrideUntil && slot.getTime() <= Date.parse(status.orderingOverrideUntil))
  if (!slotOpen) return NextResponse.json({ error: 'Wybrana godzina jest poza godzinami otwarcia. Wybierz inną.' }, { status: 400 })
  if (!paymentMethodEnabled(status, preferredPayment)) {
    return NextResponse.json({ error: preferredPayment === 'card' ? 'Płatność kartą i BLIK jest chwilowo niedostępna. Wybierz gotówkę.' : 'Płatność gotówką jest chwilowo niedostępna. Wybierz kartę lub BLIK.', code: 'PAYMENT_DISABLED' }, { status: 409 })
  }

  let deliveryFee = 0
  let distanceKm: number | null = null
  if (type === 'Dostawa') {
    const zone = await checkDeliveryZone(body.address!, body.city!, status.deliveryZones)
    if (!zone.ok) return NextResponse.json({ error: zone.message }, { status: zone.reason === 'unavailable' ? 503 : 422 })
    deliveryFee = zone.fee
    distanceKm = zone.distanceKm
  }

  const products = await loadCatalog(admin, [...quantities.keys()])
  if (!products || products.length !== quantities.size) {
    return NextResponse.json({ error: 'Niektóre dania są już niedostępne.' }, { status: 409 })
  }

  const stationFor = await loadStationResolver(admin)

  let subtotal = 0
  const promoLines: PromotionLine[] = []
  const items: { quantity: number; name: string; options?: string; unitPrice: number; station?: 'kitchen' | 'cashier'; done?: boolean; packaging?: PackagingKind; vat?: VatLetter; set?: string; label?: string }[] = []
  for (const line of lines) {
    const product = products.find((entry) => entry.id === line.productId)
    if (!product?.available) return NextResponse.json({ error: 'Niektóre dania są już niedostępne.' }, { status: 409 })

    if (hasConfigurator(product)) {
      const selection = parseSelection(line.selection)
      if (!selection) return NextResponse.json({ error: 'Nieprawidłowe opcje produktu.' }, { status: 400 })
      const resolved = resolveSelection(product, selection)
      if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 409 })
      subtotal += resolved.unitPrice * line.quantity
      promoLines.push({ productId: product.id, category: product.category, amount: resolved.unitPrice * line.quantity, quantity: line.quantity })
      const set = setKeyFor(resolved.separateLines, items.length)
      items.push({
        quantity: line.quantity,
        name: product.name,
        unitPrice: resolved.baseUnitPrice,
        station: product.station,
        ...vatOf(product),
        ...(resolved.baseDetails.length ? { options: resolved.baseDetails.join(', ') } : {}),
        ...(set ? { set } : {}),
      })
      for (const extra of resolved.separateLines) {
        items.push({ quantity: line.quantity, name: extra.name, unitPrice: extra.unitPrice, station: extra.station, ...vatOf(product), ...setFields(extra, set) })
      }
      continue
    }

    const sizes: ProductOption[] = product.sizes ?? []
    const extras: ProductOption[] = product.extras ?? []
    let unitPrice = Number(product.price)
    const selected: string[] = []
    for (const [index, detail] of line.details.entries()) {
      if (typeof detail !== 'string' || detail.length > 100) return NextResponse.json({ error: 'Nieprawidłowe opcje produktu.' }, { status: 400 })
      if (index === 0 && (sizes.length > 0 || product.variantLabel)) {
        const size = sizes.find((option) => option.label === detail)
        if (size) {
          unitPrice += Number(size.price)
          selected.push(size.label)
        } else if (detail === product.variantLabel) {
          selected.push(product.variantLabel)
        } else if (sizes.length > 0) {
          return NextResponse.json({ error: 'Wybrany rozmiar nie jest dostępny.' }, { status: 409 })
        }
        continue
      }
      const label = detail.startsWith('+ ') ? detail.slice(2) : detail
      const extra = extras.find((option) => option.label.toLocaleLowerCase('pl-PL') === label.toLocaleLowerCase('pl-PL'))
      if (!extra || selected.includes(extra.label)) return NextResponse.json({ error: 'Wybrany dodatek nie jest dostępny.' }, { status: 409 })
      unitPrice += Number(extra.price)
      selected.push(extra.label)
    }
    subtotal += unitPrice * line.quantity
    promoLines.push({ productId: product.id, category: product.category, amount: unitPrice * line.quantity, quantity: line.quantity })
    items.push({ quantity: line.quantity, name: product.name, unitPrice: Math.round(unitPrice * 100) / 100, station: product.station, ...vatOf(product), ...(selected.length ? { options: selected.join(', ') } : {}) })
  }

  const productsValue = Math.round(subtotal * 100) / 100
  if (type === 'Dostawa' && productsValue < status.minOrderOnline) {
    return NextResponse.json({ error: `Minimalna wartość zamówienia z dostawą to ${formatPrice(status.minOrderOnline)}. Brakuje ${formatPrice(status.minOrderOnline - productsValue)} albo wybierz odbiór osobisty.` }, { status: 422 })
  }

  deliveryFee = applyFreeDelivery(deliveryFee, productsValue, status.freeDeliveryFrom)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const submittedCode = typeof body.promoCode === 'string' ? body.promoCode.trim().toUpperCase().slice(0, 24) : ''
  let appliedCode: CheckoutCode | null = null
  let claim: unknown = null
  if (submittedCode === GUEST_PROMO_CODE) {
    appliedCode = GUEST_CHECKOUT_CODE
  } else if (submittedCode) {
    if (!user) return NextResponse.json({ error: checkoutCodeError('not_authenticated') }, { status: 401 })
    const { data, error: claimError } = await supabase.rpc('checkout_claim_code', { p_code: submittedCode })
    if (claimError || !data) return NextResponse.json({ error: checkoutCodeError(claimError?.message) }, { status: 409 })
    claim = data
    appliedCode = data as CheckoutCode
    for (const item of appliedCode.items) {
      const quantity = Math.min(Math.max(Number(item.quantity) || 1, 1), MAX_QUANTITY)
      const name = String(item.name).slice(0, 120)
      items.push({ quantity, name, options: `Gratis · kod ${appliedCode.code}`, unitPrice: 0, station: stationFor(name) })
    }
  }

  const blocked = items.find((item) => !stationOpen(status, item.station ?? 'kitchen'))
  if (blocked) {
    if (claim) await admin.rpc('checkout_release_code', { p_claim: claim })
    const station = blocked.station ?? 'kitchen'
    return NextResponse.json({ error: `${stationLabel(station)} jest chwilowo wyłączon${station === 'kitchen' ? 'a' : 'y'} – „${blocked.name}” nie jest teraz dostępne.` }, { status: 409 })
  }

  const promotion = promotionDiscount(promoLines, await loadActivePromotions(admin), onlineChannel(type === 'Odbiór osobisty'))
  const member = user ? (await admin.from('profiles').select('role, status_points').eq('id', user.id).maybeSingle()).data : null
  const memberTier = member?.role === 'klient' ? getTier(member.status_points ?? 0) : null
  const pricing = clubPricing({ productsValue: subtotal, promotionDiscount: promotion.discount, code: appliedCode, tierPercent: memberTier?.percent ?? 0 })
  if (pricing.codeSkipped) {
    if (claim) await admin.rpc('checkout_release_code', { p_claim: claim })
    claim = null
    appliedCode = null
  }
  const discount = pricing.discount
  const codeNote = appliedCode && appliedCode.kind !== 'guest' ? `${appliedCode.kind === 'coupon' ? 'Kupon Yummy Club' : 'Kod promocyjny'} ${appliedCode.code} · ${describeCodeBenefit(appliedCode)}` : null
  const tierNote = pricing.tierAmount > 0 && memberTier ? `Rabat statusowy ${memberTier.name} -${memberTier.percent}%` : null
  // Notes are joined with ' · ' and split again by the kitchen filter, so strip that separator from customer text.
  const customerNote = typeof body.customerNote === 'string'
    ? body.customerNote.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/·/g, ',').replace(/\s+/g, ' ').trim().slice(0, 300)
    : ''
  const note = [customerNote ? `Uwagi: ${customerNote}` : null, promotion.applied.length ? promotionNote(promotion.applied) : null, codeNote, tierNote].filter(Boolean).join(' · ') || null
  const packaging = autoPackaging(lines.map((line) => ({ product: products.find((entry) => entry.id === line.productId)!, quantity: line.quantity })), type!)
  items.push(...packagingItems(packaging, status.packagingPrices, status.packagingVat))
  subtotal = Math.round((subtotal + packagingTotal(packaging, status.packagingPrices)) * 100) / 100
  const { data: order, error } = await admin.from('orders').insert({
    type,
    customer,
    phone,
    address: type === 'Dostawa' ? `${body.address!.trim().slice(0, 180)}, ${body.city!.trim().slice(0, 100)}` : null,
    items,
    note,
    eta: scheduledLabel ? `Na ${scheduledLabel}` : type === 'Dostawa' ? '30–45 min' : '15 min',
    scheduled_for: scheduledFor,
    preferred_payment: preferredPayment,
    subtotal,
    discount,
    delivery_fee: deliveryFee,
    distance_km: distanceKm,
    total: Math.round((subtotal - discount + deliveryFee) * 100) / 100,
    customer_id: user?.id ?? null,
    club_savings: memberTier ? discount : 0,
    ...(clientRequestId ? { client_request_id: clientRequestId } : {}),
  }).select('id, number').single()

  if ((error || !order) && claim) await admin.rpc('checkout_release_code', { p_claim: claim })
  // Two retries racing past the first check: the unique index lets only one insert through.
  if (error?.code === '23505' && clientRequestId) {
    const existing = await findByRequestId(admin, clientRequestId)
    if (existing) return NextResponse.json({ orderNumber: existing.number, duplicate: true }, { status: 200 })
  }
  if (error || !order) return NextResponse.json({ error: 'Nie udało się zapisać zamówienia. Spróbuj ponownie.' }, { status: 503 })
  after(() => sendStationPush('cashier', newOrderPush(order.number, `${customer} · ${type}`)))
  return NextResponse.json({ orderNumber: order.number }, { status: 201 })
}
