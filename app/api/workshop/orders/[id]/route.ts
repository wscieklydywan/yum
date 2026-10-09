import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { priceOrderLines } from '@/lib/workshop-order-lines'
import { packagingCount, packagingItems, parsePackaging, type PackagingKind } from '@/lib/packaging'
import { loadRestaurantSettings } from '@/lib/restaurant-state'

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
}
type Change = { index?: unknown; quantity?: unknown; options?: unknown; cancelled?: unknown }

const json = (error: string, status: number) => NextResponse.json({ error }, { status })

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json('Zaloguj się ponownie.', 401)
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!EDIT_ROLES.includes(profile?.role ?? '')) return json('Pozycje zmienia bar.', 403)

  const body = (await request.json().catch(() => null)) as { changes?: Change[]; lines?: unknown[]; packaging?: unknown } | null
  const changes = Array.isArray(body?.changes) ? body.changes : []
  const lines = Array.isArray(body?.lines) ? body.lines : []
  const addedPackaging = parsePackaging(body?.packaging)
  if (!addedPackaging) return json('Nieprawidłowe opakowania.', 400)
  if (changes.length > 100) return json('Za dużo zmian naraz.', 400)
  if (!changes.length && !lines.length && !packagingCount(addedPackaging)) return json('Brak zmian do zapisania.', 400)

  const admin = createAdminClient()
  const { data: order, error } = await admin.from('orders').select('id, status, items, discount, delivery_fee').eq('id', id).maybeSingle()
  if (error || !order) return json('Zamówienie nie istnieje.', 404)
  if (!ACTIVE.includes(order.status)) return json('Wydanego zamówienia nie można już zmieniać – możesz zrobić zwrot.', 409)

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

    if ((quantity as number) > item.quantity) item.done = false
    item.quantity = quantity as number
    if (options) item.options = options
    else delete item.options
  }

  const priced = await priceOrderLines(admin, lines)
  if (!priced.ok) return json(priced.error, priced.status)
  for (const entry of priced.value.items) items.push({ id: crypto.randomUUID(), ...entry, done: false, added: true })
  const settings = packagingCount(addedPackaging) ? await loadRestaurantSettings(admin) : null
  for (const entry of packagingItems(addedPackaging, settings?.packagingPrices)) {
    const existing = items.find((item) => item.packaging === entry.packaging && !item.cancelled)
    if (existing) existing.quantity = Math.min(existing.quantity + entry.quantity, MAX_ITEM_QUANTITY)
    else items.push({ id: crypto.randomUUID(), ...entry })
  }

  const live = items.filter((item) => !item.cancelled)
  if (!live.length) return json('Zamówienie musi mieć przynajmniej jedną pozycję – anuluj całe zamówienie.', 400)
  const priceable = live.every((item) => typeof item.unitPrice === 'number')
  const subtotal = priceable ? Math.round(live.reduce((sum, item) => sum + item.unitPrice! * (item.quantity - (item.refunded ?? 0)), 0) * 100) / 100 : null
  const update: Record<string, unknown> = { items }
  if (subtotal !== null) {
    update.subtotal = subtotal
    update.total = Math.round((Math.max(subtotal - Number(order.discount ?? 0), 0) + Number(order.delivery_fee ?? 0)) * 100) / 100
  }

  // Only write if nobody changed the items meanwhile (e.g. kitchen ticking items or a receipt being printed).
  const { data: saved, error: saveError } = await admin.from('orders').update(update).eq('id', id).in('status', ACTIVE).eq('items', JSON.stringify(order.items)).select('id')
  if (saveError) return json(saveError.message.includes('paragon') ? saveError.message : 'Nie udało się zapisać zmian.', 409)
  if (!saved?.length) return json('Zamówienie zmieniło się w międzyczasie – otwórz edycję ponownie.', 409)
  return NextResponse.json({ ok: true })
}
