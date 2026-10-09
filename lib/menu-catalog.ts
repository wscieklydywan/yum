import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ModifierGroup, Option, Product, Station } from './menu'
import { variantGroupLabel } from './menu-config'

type ProductRow = {
  id: string
  category_id: string
  name: string
  description: string | null
  price: number | string
  image: string | null
  badge: Product['badge'] | null
  rating: number | string | null
  reviews: number | null
  variant_label: string | null
  sizes: unknown
  extras: unknown
  available: boolean
  station: string | null
}
type VariantRow = { id: string; product_id: string; name: string; price: number | string; active: boolean }
type AssignmentRow = { product_id: string; group_id: string; required: boolean; min_selections: number | null; max_selections: number | null; price_delta_override: number | string | null; sort: number }
type GroupRow = { id: string; name: string; selection_mode: string; min_selections: number | null; max_selections: number | null; station: string | null; active: boolean }
type OptionRow = { id: string; group_id: string; name: string; price_delta: number | string; active: boolean; stations: string[] | null }

export type CatalogProduct = Product & { available: boolean; station: Station }

const toStation = (value: unknown): Station => value === 'cashier' ? 'cashier' : 'kitchen'

type LegacyOption = { id?: unknown; label?: unknown; name?: unknown; price?: unknown; options?: unknown }

function normalizeLegacyOptions(raw: unknown): Option[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const flat = (raw as LegacyOption[]).flatMap((entry) => Array.isArray(entry?.options) ? entry.options as LegacyOption[] : [entry])
  const result = flat.flatMap((entry, index) => {
    const label = typeof entry?.label === 'string' ? entry.label : typeof entry?.name === 'string' ? entry.name : ''
    if (!label.trim()) return []
    return [{ id: typeof entry.id === 'string' ? entry.id : `opt-${index}`, label, price: Number(entry.price) || 0 }]
  })
  return result.length > 0 ? result : undefined
}

export async function loadCatalog(supabase: SupabaseClient, productIds?: string[]): Promise<CatalogProduct[] | null> {
  let productQuery = supabase
    .from('menu_products')
    .select('id, category_id, name, description, price, image, badge, rating, reviews, variant_label, sizes, extras, available, sort, station')
    .order('sort')
  if (productIds) productQuery = productQuery.in('id', productIds)

  const [products, variants, assignments, groups, options] = await Promise.all([
    productQuery,
    supabase.from('menu_product_variants').select('id, product_id, name, price, active, sort').order('sort'),
    supabase.from('menu_product_modifier_groups').select('product_id, group_id, required, min_selections, max_selections, price_delta_override, sort').order('sort'),
    supabase.from('menu_modifier_groups').select('id, name, selection_mode, min_selections, max_selections, station, active'),
    supabase.from('menu_modifier_options').select('id, group_id, name, price_delta, active, sort, stations').order('sort'),
  ])
  if (products.error || variants.error || assignments.error || groups.error || options.error) return null

  const groupById = new Map((groups.data as GroupRow[]).filter((group) => group.active).map((group) => [group.id, group]))
  const optionsByGroup = new Map<string, OptionRow[]>()
  for (const option of options.data as OptionRow[]) {
    if (!option.active) continue
    optionsByGroup.set(option.group_id, [...(optionsByGroup.get(option.group_id) ?? []), option])
  }

  return (products.data as ProductRow[]).map((row) => {
    const productVariants = (variants.data as VariantRow[])
      .filter((variant) => variant.product_id === row.id && variant.active)
      .map((variant) => ({ id: variant.id, name: variant.name, price: Number(variant.price) }))

    const modifierGroups: ModifierGroup[] = (assignments.data as AssignmentRow[])
      .filter((assignment) => assignment.product_id === row.id)
      .flatMap((assignment) => {
        const group = groupById.get(assignment.group_id)
        const groupOptions = optionsByGroup.get(assignment.group_id) ?? []
        if (!group || groupOptions.length === 0) return []
        const override = assignment.price_delta_override === null ? null : Number(assignment.price_delta_override)
        const min = Math.max(assignment.min_selections ?? group.min_selections ?? 0, assignment.required ? 1 : 0)
        return [{
          id: group.id,
          name: group.name,
          mode: group.selection_mode === 'multiple' ? 'multiple' : 'single',
          min,
          max: assignment.max_selections ?? group.max_selections,
          station: group.station === 'kitchen' ? 'kitchen' : 'cashier',
          options: groupOptions.map((option) => ({ id: option.id, name: option.name, price: override ?? Number(option.price_delta), ...(option.stations?.length ? { stations: option.stations.map(toStation) } : {}) })),
        } satisfies ModifierGroup]
      })

    const configured = productVariants.length > 0 || modifierGroups.length > 0
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      price: productVariants[0]?.price ?? Number(row.price),
      image: row.image ?? '',
      category: row.category_id,
      badge: row.badge ?? undefined,
      rating: row.rating === null ? undefined : Number(row.rating),
      reviews: row.reviews ?? undefined,
      variantLabel: row.variant_label ?? undefined,
      sizes: configured ? undefined : normalizeLegacyOptions(row.sizes),
      extras: configured ? undefined : normalizeLegacyOptions(row.extras),
      variants: productVariants.length > 0 ? productVariants : undefined,
      variantGroupLabel: productVariants.length > 0 ? variantGroupLabel(row.category_id, productVariants.map((variant) => variant.name)) : undefined,
      modifierGroups: modifierGroups.length > 0 ? modifierGroups : undefined,
      available: row.available,
      station: toStation(row.station),
    }
  })
}
