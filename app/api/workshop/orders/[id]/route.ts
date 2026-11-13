import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { priceOrderLines } from '@/lib/workshop-order-lines'
import { packagingCount, packagingItems, parsePackaging, type PackagingKind } from '@/lib/packaging'
import { loadRestaurantSettings } from '@/lib/restaurant-state'
import { checkDeliveryZone, splitAddress } from '@/lib/delivery-zone'
import { DEFAULT_DELIVERY_ZONES } from '@/lib/order-settings'
import { resolveOrderSource } from '@/components/warsztat/order-data'
import { recomputeFinalizedReport } from '@/lib/day-report'
import { FOOD_VAT, type VatLetter } from '@/lib/vat'

const EDIT_ROLES = ['admin', 'szef', 'kelner']
const ACTIVE = ['new', 'preparing', 'ready']
const MAX_ITEM_QUANTITY = 50

type StoredItem = {
  id?: string
  quantity: number
  name: string
  options?: string
  unitPrice?: number
  station?: string
  done?: boolean
  cancelled?: boolean
  problem?: string
  receipted?: number
  refunded?: number
  added?: boolean
  packaging?: PackagingKind
  surcharge?: boolean
  vat?: VatLetter
}

const MAX_ADJUSTMENT = 1000
type Adjustment = { kind: 'discount' | 'surcharge'; amount: number; reason: string }

/** Manual price correction from the bar: a discount lowers the order total, a surcharge adds a billed line. */
function parseAdjustment(raw: unknown): Adjustment | false {
  if (!raw || typeof raw !== 'object') return false
  const { kind, amount, reason } = raw as Record<string, unknown>
  if (kind !== 'discount' && kind !== 'surcharge') return false
  const value = typeof amount === 'number' ? Math.round(amount * 100) / 100 : NaN
  if (!Number.isFinite(value) || value < 0.01 || value > MAX_ADJUSTMENT) return false
  return { kind, amount: value, reason: typeof reason === 'string' ? reason.trim().slice(0, 60) : '' }
}
type Change = { index?: unknown; quantity?: unknown; options?: unknown; cancelled?: unknown }

type Details = { type?: unknown; scheduledFor?: unknown; customer?: unknown; phone?: unknown; address?: unknown }
type OrderRow = {
  items: StoredItem[]
  delivery_fee: number | string | null
  type: OrderType
  source: string | null
  note: string | null
  customer: string
  phone: string | null
  address: string | null
  scheduled_for: string | null
  eta: string
  paid_at: string | null
}
type OrderType = (typeof TYPES)[number]
type Result<T> = { ok: true; value: T } | { ok: false; error: string; status: number }

const TYPES = ['Dostawa', 'Odbiór osobisty', 'Stacjonarnie'] as const
const DEFAULT_NAMES = ['Klient', 'Klient stacjonarny', 'Klient Glovo', 'Klient Pyszne.pl', 'Klient Kiosk']

const json = (error: string, status: number) => NextResponse.json({ error }, { status })
const fail = (error: string, status = 400) => ({ ok: false as const, error, status })

/** Type, time and customer data changed at the bar. The delivery fee never changes once money or a receipt is involved. */
async function resolveDetails(order: OrderRow, details: Details): Promise<Result<{ fields: Record<string, unknown> }>> {
  const source = resolveOrderSource(order.source, order.note).source
  const platform = source === 'glovo' || source === 'pyszne'
  const type = (details.type ?? order.type) as OrderType
  if (!TYPES.includes(type)) return fail('Nieprawidłowy typ zamówienia.')
  if (platform && type === 'Stacjonarnie') return fail('Zamówienie z aplikacji dostawy nie może być na miejscu.')
  const fields: Record<string, unknown> = {}
  if (type !== order.type) fields.type = type

  let scheduledFor = order.scheduled_for
  if (details.scheduledFor !== undefined) {
    if (details.scheduledFor === null) scheduledFor = null
    else {
      const scheduled = typeof details.scheduledFor === 'string' ? Date.parse(details.scheduledFor) : NaN
      const unchanged = order.scheduled_for && scheduled === Date.parse(order.scheduled_for)
      if (!unchanged && (!Number.isFinite(scheduled) || scheduled < Date.now() - 5 * 60_000 || scheduled > Date.now() + 7 * 86_400_000)) {
        return fail('Godzina zamówienia musi być w przyszłości (maks. 7 dni).')
      }
      scheduledFor = new Date(scheduled).toISOString()
    }
  }
  const scheduleChanged = (scheduledFor ? Date.parse(scheduledFor) : null) !== (order.scheduled_for ? Date.parse(order.scheduled_for) : null)
  if (scheduleChanged) fields.scheduled_for = scheduledFor
  if (scheduleChanged || type !== order.type) {
    const clock = scheduledFor && new Date(scheduledFor).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' })
    fields.eta = clock ? `Na ${clock}` : type === 'Dostawa' ? '30–45 min' : type === 'Stacjonarnie' ? 'Na miejscu' : '15 min'
  }

  if (!platform || source === 'pyszne') {
    if (typeof details.customer === 'string') {
      const customer = details.customer.trim().slice(0, 120)
      const fallback = DEFAULT_NAMES.includes(order.customer) ? (source === 'kiosk' ? order.customer : 'Klient') : order.customer
      const next = customer || fallback
      if (source === 'pyszne' && !customer) return fail('Podaj imię klienta.')
      if (next !== order.customer) fields.customer = next
    }
  }
  if (!platform && typeof details.phone === 'string') {
    const phone = details.phone.trim().slice(0, 30)
    if (phone !== (order.phone ?? '')) fields.phone = phone
  }

  let address = order.address
  if (source !== 'glovo') {
    if (typeof details.address === 'string') address = details.address.trim().slice(0, 200)
    if (type === 'Dostawa' && (address ?? '').length < 3) return fail('Podaj adres dostawy.')
    if (type !== 'Dostawa') address = null
    if (address !== order.address) fields.address = address
  }

  // Delivery platforms bill the delivery themselves; own and online orders pay the zone fee.
  const currentFee = Number(order.delivery_fee ?? 0)
  let fee = currentFee
  if (type !== 'Dostawa') {
    if (!platform) fee = 0
    if (order.type === 'Dostawa') fields.distance_km = null
  } else if (source !== 'glovo' && (order.type !== 'Dostawa' || address !== order.address)) {
    const settings = await loadRestaurantSettings(createAdminClient())
    const { street, city } = splitAddress(address ?? '')
    const zone = await checkDeliveryZone(street, city, settings?.deliveryZones ?? DEFAULT_DELIVERY_ZONES)
    if (!platform) fee = zone.ok ? zone.fee : 0
    fields.distance_km = zone.ok ? zone.distanceKm : zone.distanceKm ?? null
  }
  if (Math.round(fee * 100) !== Math.round(currentFee * 100)) {
    const settled = Boolean(order.paid_at) || order.items.some((item) => (item.receipted ?? 0) > 0)
    if (settled) return fail('Zamówienie jest już rozliczone – zmiana zmieniłaby opłatę za dostawę. Zostaw typ albo zrób zwrot i nowe zamówienie.', 409)
    fields.delivery_fee = fee
  }

  return { ok: true, value: { fields } }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json('Zaloguj się ponownie.', 401)
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!EDIT_ROLES.includes(profile?.role ?? '')) return json('Pozycje zmienia bar.', 403)

  const body = (await request.json().catch(() => null)) as { changes?: Change[]; lines?: unknown[]; packaging?: unknown; details?: Details; adjustment?: unknown } | null
  const changes = Array.isArray(body?.changes) ? body.changes : []
  const lines = Array.isArray(body?.lines) ? body.lines : []
  const addedPackaging = parsePackaging(body?.packaging ?? {})
  if (!addedPackaging) return json('Nieprawidłowe opakowania.', 400)
  if (changes.length > 100) return json('Za dużo zmian naraz.', 400)
  const adjustment = body?.adjustment === undefined ? null : parseAdjustment(body.adjustment)
  if (adjustment === false) return json(`Kwota korekty musi wynosić od 0,01 do ${MAX_ADJUSTMENT} zł.`, 400)
  const details = body?.details && typeof body.details === 'object' ? body.details : null
  const itemsChanged = changes.length > 0 || lines.length > 0 || packagingCount(addedPackaging) > 0 || Boolean(adjustment)
  if (!itemsChanged && !details) return json('Brak zmian do zapisania.', 400)

  const admin = createAdminClient()
  const { data: order, error } = await admin.from('orders').select('id, status, items, discount, delivery_fee, total, type, source, note, customer, phone, address, scheduled_for, eta, paid_at').eq('id', id).maybeSingle()
  if (error || !order) return json('Zamówienie nie istnieje.', 404)
  if (!ACTIVE.includes(order.status)) return json('Wydanego zamówienia nie można już zmieniać – możesz zrobić zwrot.', 409)

  const detailsUpdate = details ? await resolveDetails(order as OrderRow, details) : null
  if (detailsUpdate && !detailsUpdate.ok) return json(detailsUpdate.error, detailsUpdate.status)
  if (!itemsChanged) {
    const { fields } = detailsUpdate!.value
    if ('delivery_fee' in fields) fields.total = Math.round((Number(order.total ?? 0) - Number(order.delivery_fee ?? 0) + Number(fields.delivery_fee)) * 100) / 100
    const { data: saved, error: saveError } = await admin.from('orders').update(fields).eq('id', id).in('status', ACTIVE).select('id')
    if (saveError || !saved?.length) return json('Nie udało się zapisać zmian.', 409)
    return NextResponse.json({ ok: true })
  }

  const items: StoredItem[] = (order.items as StoredItem[]).map((item) => ({ ...item }))
  const seen = new Set<number>()
  for (const change of changes) {
    const index = change.index
    if (!Number.isInteger(index) || seen.has(index as number)) return json('Nieprawidłowa zmiana pozycji.', 400)
    seen.add(index as number)
    const item = items[index as number]
    if (!item || item.cancelled) return json('Pozycja nie istnieje lub została już anulowana.', 409)
    const receipted = item.receipted ?? 0

    if (change.cancelled === true) {
      if (receipted > 0) return json(`„${item.name}” jest już na paragonie – zamiast usuwać zrób zwrot.`, 409)
      delete item.problem
      item.cancelled = true
      continue
    }

    const quantity = change.quantity
    if (!Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > MAX_ITEM_QUANTITY) return json(`Ilość musi wynosić od 1 do ${MAX_ITEM_QUANTITY}.`, 400)
    if ((quantity as number) < receipted) return json(`„${item.name}”: na paragonie jest już ${receipted} szt.`, 409)
    const options = typeof change.options === 'string' ? change.options.trim().slice(0, 200) : (item.options ?? '')
    if (receipted > 0 && options !== (item.options ?? '')) return json(`„${item.name}” jest już na paragonie – opisu nie można zmienić.`, 409)

    // Packaging and surcharges are never prepared by a station – they stay ready whatever the quantity.
    if (item.packaging || item.surcharge) item.done = true
    else if ((quantity as number) > item.quantity) item.done = false
    item.quantity = quantity as number
    if (options) item.options = options
    else delete item.options
  }

  const priced = await priceOrderLines(admin, lines)
  if (!priced.ok) return json(priced.error, priced.status)
  for (const entry of priced.value.items) items.push({ id: crypto.randomUUID(), ...entry, done: false, added: true })
  const settings = packagingCount(addedPackaging) ? await loadRestaurantSettings(admin) : null
  for (const entry of packagingItems(addedPackaging, settings?.packagingPrices, settings?.packagingVat)) {
    const existing = items.find((item) => item.packaging === entry.packaging && !item.cancelled)
    if (existing) {
      existing.quantity = Math.min(existing.quantity + entry.quantity, MAX_ITEM_QUANTITY)
      existing.done = true
    } else items.push({ id: crypto.randomUUID(), ...entry })
  }
  if (adjustment?.kind === 'surcharge') {
    items.push({ id: crypto.randomUUID(), quantity: 1, name: adjustment.reason ? `Dopłata: ${adjustment.reason}` : 'Dopłata', unitPrice: adjustment.amount, station: 'cashier', done: true, added: true, surcharge: true, vat: FOOD_VAT })
  }

  const live = items.filter((item) => !item.cancelled)
  if (!live.length) return json('Zamówienie musi mieć przynajmniej jedną pozycję – anuluj całe zamówienie.', 400)
  const priceable = live.every((item) => typeof item.unitPrice === 'number')
  const subtotal = priceable ? Math.round(live.reduce((sum, item) => sum + item.unitPrice! * (item.quantity - (item.refunded ?? 0)), 0) * 100) / 100 : null
  const detailFields = detailsUpdate?.ok ? detailsUpdate.value.fields : {}
  const deliveryFee = 'delivery_fee' in detailFields ? Number(detailFields.delivery_fee) : Number(order.delivery_fee ?? 0)
  const update: Record<string, unknown> = { ...detailFields, items }
  let discount = Number(order.discount ?? 0)
  if (adjustment?.kind === 'discount') {
    if (subtotal === null) return json('Nie można obniżyć ceny – część pozycji nie ma ceny.', 409)
    if (order.items.some((item: StoredItem) => (item.receipted ?? 0) > 0)) return json('Paragon jest już wydrukowany – obniżki nie można dodać. Zrób zwrot części pozycji.', 409)
    if (Math.round((discount + adjustment.amount) * 100) > Math.round(subtotal * 100)) return json('Obniżka nie może być większa niż wartość pozycji.', 400)
    discount = Math.round((discount + adjustment.amount) * 100) / 100
    update.discount = discount
  }
  if (subtotal !== null) {
    update.subtotal = subtotal
    update.total = Math.round((Math.max(subtotal - discount, 0) + deliveryFee) * 100) / 100
  } else if ('delivery_fee' in detailFields) {
    update.total = Math.round((Number(order.total ?? 0) - Number(order.delivery_fee ?? 0) + deliveryFee) * 100) / 100
  }

  // Only write if nobody changed the items meanwhile (e.g. kitchen ticking items or a receipt being printed).
  const { data: saved, error: saveError } = await admin.from('orders').update(update).eq('id', id).in('status', ACTIVE).eq('items', JSON.stringify(order.items)).select('id')
  if (saveError) return json(saveError.message.includes('paragon') ? saveError.message : 'Nie udało się zapisać zmian.', 409)
  if (!saved?.length) return json('Zamówienie zmieniło się w międzyczasie – otwórz edycję ponownie.', 409)
  return NextResponse.json({ ok: true })
}

const DELETE_ROLES = ['admin', 'szef']
const FINISHED = ['handed_off', 'cancelled']

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json('Nieprawidłowe zamówienie.', 400)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json('Zaloguj się ponownie.', 401)
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!DELETE_ROLES.includes(profile?.role ?? '')) return json('Tylko szef lub administrator może usuwać zamówienia.', 403)

  const admin = createAdminClient()
  const { data: order } = await admin.from('orders').select('status, created_at').eq('id', id).maybeSingle()
  if (!order) return json('Nie znaleziono zamówienia.', 404)
  if (!FINISHED.includes(order.status)) return json('Usunąć można tylko zakończone zamówienie z historii.', 409)

  const { error } = await admin.from('orders').delete().eq('id', id)
  if (error) return json('Nie udało się usunąć zamówienia.', 503)
  const reportUpdated = await recomputeFinalizedReport(admin, order.created_at)
  return NextResponse.json({ deleted: true, reportUpdated })
}
