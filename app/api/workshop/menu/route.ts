import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'
import { ID_PATTERN, inList, integer, money, shortId, slugify, text } from '@/lib/workshop-menu'

const badges = ['Bestseller', 'Nowość', 'Ostry'] as const
const stations = ['kitchen', 'cashier'] as const

type VariantInput = { id?: string; name: string; price: number }
type ModifierInput = { group_id: string; required: boolean; min_selections: number; max_selections: number | null; price_delta_override: number | null }

function parseVariants(input: unknown): VariantInput[] | null {
  if (input === undefined) return []
  if (!Array.isArray(input) || input.length > 20) return null
  const result: VariantInput[] = []
  for (const raw of input) {
    const name = text(raw?.name, 60)
    const price = money(raw?.price, 10000)
    if (!name || price === null) return null
    result.push({ id: typeof raw?.id === 'string' && ID_PATTERN.test(raw.id) ? raw.id : undefined, name, price })
  }
  return result
}

function parseModifiers(input: unknown): ModifierInput[] | null {
  if (input === undefined) return []
  if (!Array.isArray(input) || input.length > 20) return null
  const result: ModifierInput[] = []
  for (const raw of input) {
    const groupId = typeof raw?.group_id === 'string' ? raw.group_id : ''
    if (!ID_PATTERN.test(groupId) || result.some((entry) => entry.group_id === groupId)) return null
    const required = raw?.required === true
    const min = integer(raw?.min_selections, 0, 20)
    const max = integer(raw?.max_selections, 1, 50)
    const override = money(raw?.price_delta_override, 1000)
    if (min === undefined || max === undefined) return null
    const minSelections = required ? Math.max(1, min ?? 1) : 0
    if (max !== null && max < minSelections) return null
    result.push({ group_id: groupId, required, min_selections: minSelections, max_selections: max, price_delta_override: override })
  }
  return result
}

function parseProduct(body: Record<string, unknown> | null) {
  if (!body) return null
  const name = text(body.name, 80)
  const categoryId = typeof body.category_id === 'string' ? body.category_id : ''
  const variants = parseVariants(body.variants)
  const modifiers = parseModifiers(body.modifiers)
  const price = variants?.length ? variants[0].price : money(body.price, 10000)
  const image = text(body.image, 500)
  const badge = body.badge === null || body.badge === '' ? null : badges.includes(body.badge as (typeof badges)[number]) ? body.badge as string : undefined
  const station = stations.includes(body.station as (typeof stations)[number]) ? body.station as string : 'kitchen'
  const variantLabel = text(body.variant_label, 60) || null
  if (!name || !categoryId || price === null || badge === undefined || !variants || !modifiers) return null
  if (image && !/^(https:\/\/|\/)/.test(image)) return null
  return {
    product: { name, category_id: categoryId, price, description: text(body.description, 400), image, badge, station, variant_label: variantLabel, available: body.available !== false },
    variants,
    modifiers,
  }
}

async function saveStructure(admin: SupabaseClient, productId: string, variants: VariantInput[], modifiers: ModifierInput[]) {
  const { data: existing, error: existingError } = await admin.from('menu_product_variants').select('id').eq('product_id', productId)
  if (existingError) return existingError
  const ownIds = new Set((existing ?? []).map((row) => row.id as string))
  const rows = variants.map((variant, index) => ({
    id: variant.id && ownIds.has(variant.id) ? variant.id : `var_${productId}_${slugify(variant.name, 'wariant')}_${shortId()}`,
    product_id: productId,
    name: variant.name,
    price: variant.price,
    sort: index + 1,
    active: true,
  }))

  let removeVariants = admin.from('menu_product_variants').delete().eq('product_id', productId)
  if (rows.length > 0) removeVariants = removeVariants.not('id', 'in', inList(rows.map((row) => row.id)))
  const removed = await removeVariants
  if (removed.error) return removed.error
  if (rows.length > 0) {
    const upserted = await admin.from('menu_product_variants').upsert(rows)
    if (upserted.error) return upserted.error
  }

  const cleared = await admin.from('menu_product_modifier_groups').delete().eq('product_id', productId)
  if (cleared.error) return cleared.error
  if (modifiers.length > 0) {
    const inserted = await admin.from('menu_product_modifier_groups').insert(modifiers.map((modifier, index) => ({ ...modifier, product_id: productId, sort: index + 1 })))
    if (inserted.error) return inserted.error
  }
  return null
}

const invalid = () => NextResponse.json({ error: 'Uzupełnij nazwę, kategorię, ceny i poprawne ustawienia dodatków.' }, { status: 400 })

export async function POST(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const parsed = parseProduct(await request.json().catch(() => null))
  if (!parsed) return invalid()
  const admin = createAdminClient()
  const { data: last } = await admin.from('menu_products').select('sort').eq('category_id', parsed.product.category_id).order('sort', { ascending: false }).limit(1).maybeSingle()
  const id = `${slugify(parsed.product.name)}-${shortId()}`
  const { error } = await admin.from('menu_products').insert({ ...parsed.product, id, sort: (last?.sort ?? 0) + 1 })
  if (error) return NextResponse.json({ error: 'Nie udało się dodać pozycji.' }, { status: 503 })
  const structureError = await saveStructure(admin, id, parsed.variants, parsed.modifiers)
  if (structureError) return NextResponse.json({ error: 'Pozycja dodana, ale nie udało się zapisać wariantów lub dodatków.' }, { status: 503 })
  return NextResponse.json({ id }, { status: 201 })
}

export async function PATCH(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const id = typeof body?.id === 'string' ? body.id : ''
  const parsed = parseProduct(body)
  if (!id || !parsed) return invalid()
  const admin = createAdminClient()
  const { error } = await admin.from('menu_products').update(parsed.product).eq('id', id)
  if (error) return NextResponse.json({ error: 'Nie udało się zapisać zmian.' }, { status: 503 })
  const structureError = await saveStructure(admin, id, parsed.variants, parsed.modifiers)
  if (structureError) return NextResponse.json({ error: 'Nie udało się zapisać wariantów lub dodatków.' }, { status: 503 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null) as { id?: string } | null
  if (!body?.id) return NextResponse.json({ error: 'Brak pozycji.' }, { status: 400 })
  const { error } = await createAdminClient().from('menu_products').delete().eq('id', body.id)
  if (error) return NextResponse.json({ error: 'Nie udało się usunąć pozycji (może występować w zamówieniach).' }, { status: 409 })
  return NextResponse.json({ success: true })
}
