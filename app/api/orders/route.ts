import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { loadCatalog } from '@/lib/menu-catalog'
import { autoPackaging, packagingItems, packagingTotal, type PackagingKind } from '@/lib/packaging'
import { loadStationResolver } from '@/lib/order-stations'
import { checkDeliveryZone } from '@/lib/delivery-zone'
import { loadRestaurantStatus } from '@/lib/restaurant-state'
import { applyFreeDelivery } from '@/lib/order-settings'
import { stationLabel, stationOpen } from '@/lib/restaurant-status'
import { hasConfigurator, parseSelection, resolveSelection } from '@/lib/menu-config'
import { GUEST_CHECKOUT_CODE, GUEST_PROMO_CODE, checkoutCodeError, codeDiscount, describeCodeBenefit, type CheckoutCode } from '@/lib/checkout-codes'

const MAX_QUANTITY = 20
const formatPrice = (value: number) => `${value.toFixed(2).replace('.', ',')} zł`
const ORDER_TYPES = ['Dostawa', 'Odbiór osobisty'] as const

type SubmittedLine = { productId: string; quantity: number; details: string[]; selection?: unknown }
type ProductOption = { id: string; label: string; price: number }

const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl-PL')

export async function POST(request: Request) {
  let body: {
    customer?: string
    phone?: string
    address?: string
    city?: string
    type?: string
    promoCode?: string
    scheduledFor?: string | null
    lines?: SubmittedLine[]
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe dane zamówienia.' }, { status: 400 })
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
  if (type === 'Dostawa' && (!body.address?.trim() || !body.city?.trim())) {
    return NextResponse.json({ error: 'Podaj adres dostawy.' }, { status: 400 })
  }
  let scheduledFor: string | null = null
  if (body.scheduledFor) {
    const scheduled = typeof body.scheduledFor === 'string' ? Date.parse(body.scheduledFor) : NaN
    if (!Number.isFinite(scheduled) || scheduled < Date.now() + 10 * 60_000 || scheduled > Date.now() + 3 * 86_400_000) {
      return NextResponse.json({ error: 'Wybrana godzina jest niedostępna. Wybierz inną.' }, { status: 400 })
    }
    scheduledFor = new Date(scheduled).toISOString()
  }
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
  const status = await loadRestaurantStatus(admin)
  if (!status) return NextResponse.json({ error: 'Nie udało się sprawdzić, czy lokal przyjmuje zamówienia.' }, { status: 503 })
  if (!status.acceptingOrders) return NextResponse.json({ error: status.reason }, { status: 423 })

  let deliveryFee = 0
  if (type === 'Dostawa') {
    const zone = await checkDeliveryZone(body.address!, body.city!, status.deliveryZones)
    if (!zone.ok) return NextResponse.json({ error: zone.message }, { status: zone.reason === 'unavailable' ? 503 : 422 })
    deliveryFee = zone.fee
  }

  const products = await loadCatalog(admin, [...quantities.keys()])
  if (!products || products.length !== quantities.size) {
    return NextResponse.json({ error: 'Niektóre dania są już niedostępne.' }, { status: 409 })
  }

  const stationFor = await loadStationResolver(admin)

  let subtotal = 0
  const items: { quantity: number; name: string; options?: string; unitPrice: number; station?: 'kitchen' | 'cashier'; done?: boolean; packaging?: PackagingKind }[] = []
  for (const line of lines) {
    const product = products.find((entry) => entry.id === line.productId)
    if (!product?.available) return NextResponse.json({ error: 'Niektóre dania są już niedostępne.' }, { status: 409 })

    if (hasConfigurator(product)) {
      const selection = parseSelection(line.selection)
      if (!selection) return NextResponse.json({ error: 'Nieprawidłowe opcje produktu.' }, { status: 400 })
      const resolved = resolveSelection(product, selection)
      if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 409 })
      subtotal += resolved.unitPrice * line.quantity
      items.push({
        quantity: line.quantity,
        name: product.name,
        unitPrice: resolved.baseUnitPrice,
        station: product.station,
        ...(resolved.baseDetails.length ? { options: resolved.baseDetails.join(', ') } : {}),
      })
      for (const extra of resolved.separateLines) {
        items.push({ quantity: line.quantity, name: extra.name, unitPrice: extra.unitPrice, station: extra.station })
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
    items.push({ quantity: line.quantity, name: product.name, unitPrice: Math.round(unitPrice * 100) / 100, station: product.station, ...(selected.length ? { options: selected.join(', ') } : {}) })
  }

  const productsValue = Math.round(subtotal * 100) / 100
  if (productsValue < status.minOrderOnline) {
    return NextResponse.json({ error: `Minimalna wartość zamówienia online to ${formatPrice(status.minOrderOnline)}. Brakuje ${formatPrice(status.minOrderOnline - productsValue)}.` }, { status: 422 })
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

  const discount = codeDiscount(subtotal, appliedCode)
  const packaging = autoPackaging(lines.map((line) => ({ product: products.find((entry) => entry.id === line.productId)!, quantity: line.quantity })), type!)
  items.push(...packagingItems(packaging, status.packagingPrices))
  subtotal = Math.round((subtotal + packagingTotal(packaging, status.packagingPrices)) * 100) / 100
  const { data: order, error } = await admin.from('orders').insert({
    type,
    customer,
    phone,
    address: type === 'Dostawa' ? `${body.address!.trim().slice(0, 180)}, ${body.city!.trim().slice(0, 100)}` : null,
    items,
    note: appliedCode && appliedCode.kind !== 'guest' ? `${appliedCode.kind === 'coupon' ? 'Kupon Yummy Club' : 'Kod promocyjny'} ${appliedCode.code} · ${describeCodeBenefit(appliedCode)}` : null,
    eta: scheduledLabel ? `Na ${scheduledLabel}` : type === 'Dostawa' ? '30–45 min' : '15 min',
    scheduled_for: scheduledFor,
    subtotal,
    discount,
    delivery_fee: deliveryFee,
    total: Math.round((subtotal - discount + deliveryFee) * 100) / 100,
    customer_id: user?.id ?? null,
  }).select('id, number').single()

  if ((error || !order) && claim) await admin.rpc('checkout_release_code', { p_claim: claim })
  if (error || !order) return NextResponse.json({ error: 'Nie udało się zapisać zamówienia. Spróbuj ponownie.' }, { status: 503 })
  return NextResponse.json({ orderNumber: order.number }, { status: 201 })
}
