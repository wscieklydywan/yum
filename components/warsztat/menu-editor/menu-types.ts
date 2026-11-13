import { DEFAULT_SEASONAL_LABEL, type ModifierGroup, type Product } from '@/lib/menu'
import { variantGroupLabel } from '@/lib/menu-config'
import { parseVat, type VatLetter } from '@/lib/vat'

export type MenuBadge = 'Bestseller' | 'Nowość' | 'Ostry'
export type MenuStation = 'kitchen' | 'cashier'
export type SelectionMode = 'single' | 'multiple'

export type MenuItem = {
  id: string
  name: string
  category_id: string
  description: string
  price: number | string
  image: string
  badge: MenuBadge | null
  variant_label: string | null
  available: boolean
  station?: MenuStation
  allergens?: string[] | null
  ingredients?: string[] | null
  /** NULL until someone verifies the product's rate. */
  vat?: VatLetter | null
  seasonal?: boolean | null
  seasonal_label?: string | null
  available_until?: string | null
  pinned?: boolean | null
}

export type WorkshopOption = { id: string; name: string; price_delta: number; active: boolean; sort: number; stations: MenuStation[] | null }
export type WorkshopGroup = {
  id: string
  name: string
  selection_mode: SelectionMode
  min_selections: number
  max_selections: number | null
  station: MenuStation
  active: boolean
  sort: number
  options: WorkshopOption[]
}
export type WorkshopVariant = { id: string; product_id: string; name: string; price: number; active: boolean; sort: number }
export type WorkshopAssignment = {
  product_id: string
  group_id: string
  required: boolean
  min_selections: number | null
  max_selections: number | null
  price_delta_override: number | null
  sort: number
}
export type MenuStructure = { groups: WorkshopGroup[]; variants: WorkshopVariant[]; assignments: WorkshopAssignment[] }

export type DraftVariant = { id?: string; name: string; price: string }
export type DraftModifier = { group_id: string; required: boolean; min: string; max: string; price_override: string }

export type MenuDraft = {
  id?: string
  name: string
  category_id: string
  description: string
  price: string
  image: string
  badge: MenuBadge | null
  station: MenuStation
  variant_label: string
  variants: DraftVariant[]
  modifiers: DraftModifier[]
  available: boolean
  allergens: string[]
  ingredients: string[]
  vat: VatLetter | ''
  seasonal: boolean
  seasonal_label: string
  /** Local datetime-input value (YYYY-MM-DDTHH:mm); empty = no end date. */
  available_until: string
  pinned: boolean
}

export const stationLabels: Record<MenuStation, string> = { kitchen: 'Kuchnia', cashier: 'Bar' }
export const badgeOptions: MenuBadge[] = ['Bestseller', 'Nowość', 'Ostry']
export const emptyStructure: MenuStructure = { groups: [], variants: [], assignments: [] }

export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatSeasonEnd(iso: string | null | undefined) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const priceText = (value: number | string | null | undefined) => value === null || value === undefined || value === '' ? '' : String(Number(value))

export function toDraft(item: MenuItem | null, defaultCategory: string, structure: MenuStructure): MenuDraft {
  const variants = item ? structure.variants.filter((variant) => variant.product_id === item.id && variant.active) : []
  const modifiers = item ? structure.assignments.filter((assignment) => assignment.product_id === item.id) : []
  return {
    id: item?.id,
    name: item?.name ?? '',
    category_id: item?.category_id ?? defaultCategory,
    description: item?.description ?? '',
    price: item ? priceText(item.price) : '',
    image: item?.image ?? '',
    badge: item?.badge ?? null,
    station: item?.station ?? 'kitchen',
    variant_label: item?.variant_label ?? '',
    allergens: item?.allergens ?? [],
    ingredients: item?.ingredients ?? [],
    vat: parseVat(item?.vat) ?? '',
    variants: variants.map((variant) => ({ id: variant.id, name: variant.name, price: priceText(variant.price) })),
    modifiers: modifiers.map((assignment) => {
      const group = structure.groups.find((entry) => entry.id === assignment.group_id)
      const min = Math.max(assignment.min_selections ?? group?.min_selections ?? 0, assignment.required ? 1 : 0)
      return {
        group_id: assignment.group_id,
        required: min > 0,
        min: String(Math.max(min, 1)),
        max: assignment.max_selections === null ? '' : String(assignment.max_selections),
        price_override: priceText(assignment.price_delta_override),
      }
    }),
    available: item?.available ?? true,
    seasonal: item?.seasonal === true,
    seasonal_label: item?.seasonal_label ?? '',
    available_until: toLocalInput(item?.available_until),
    pinned: item?.pinned === true,
  }
}

export function newModifier(group: WorkshopGroup): DraftModifier {
  return { group_id: group.id, required: group.min_selections > 0, min: String(Math.max(group.min_selections, 1)), max: '', price_override: '' }
}

export function draftToPayload(draft: MenuDraft) {
  const variants = draft.variants.filter((variant) => variant.name.trim()).map((variant) => ({ id: variant.id, name: variant.name.trim(), price: Number(variant.price) || 0 }))
  return {
    ...draft,
    price: variants[0]?.price ?? Number(draft.price),
    vat: draft.vat || null,
    seasonal_label: draft.seasonal ? draft.seasonal_label.trim() : '',
    available_until: draft.seasonal && draft.available_until ? new Date(draft.available_until).toISOString() : null,
    variants,
    modifiers: draft.modifiers.map((modifier) => ({
      group_id: modifier.group_id,
      required: modifier.required,
      min_selections: modifier.required ? Math.max(1, Number(modifier.min) || 1) : 0,
      max_selections: modifier.max.trim() ? Number(modifier.max) : null,
      price_delta_override: modifier.price_override.trim() ? Number(modifier.price_override) : null,
    })),
  }
}

export function buildPreviewProduct(draft: MenuDraft, groups: WorkshopGroup[]): Product {
  const variants = draft.variants
    .filter((variant) => variant.name.trim())
    .map((variant, index) => ({ id: variant.id ?? `draft-${index}`, name: variant.name.trim(), price: Number(variant.price) || 0 }))
  const modifierGroups: ModifierGroup[] = draft.modifiers.flatMap((modifier) => {
    const group = groups.find((entry) => entry.id === modifier.group_id)
    if (!group || !group.active) return []
    const options = group.options.filter((option) => option.active)
    if (options.length === 0) return []
    const override = modifier.price_override.trim() ? Number(modifier.price_override) : null
    const max = group.selection_mode === 'single' ? 1 : modifier.max.trim() ? Number(modifier.max) : group.max_selections
    return [{
      id: group.id,
      name: group.name,
      mode: group.selection_mode,
      min: modifier.required ? Math.max(1, Number(modifier.min) || 1) : 0,
      max,
      options: options.map((option) => ({ id: option.id, name: option.name, price: override ?? option.price_delta })),
    }]
  })
  const configured = variants.length > 0 || modifierGroups.length > 0
  return {
    id: draft.id ?? 'draft',
    category: draft.category_id,
    name: draft.name || 'Nazwa dania',
    description: draft.description || 'Opis dania pojawi się tutaj.',
    price: variants[0]?.price ?? (Number(draft.price) || 0),
    image: draft.image,
    badge: draft.badge ?? undefined,
    variantLabel: draft.variant_label || undefined,
    allergens: draft.allergens,
    ingredients: draft.ingredients,
    ...(draft.seasonal ? { seasonalLabel: draft.seasonal_label.trim() || DEFAULT_SEASONAL_LABEL, availableUntil: draft.available_until ? new Date(draft.available_until).toISOString() : undefined } : {}),
    ...(configured ? {
      variants: variants.length > 0 ? variants : undefined,
      variantGroupLabel: variants.length > 0 ? variantGroupLabel(draft.category_id, variants.map((variant) => variant.name)) : undefined,
      modifierGroups: modifierGroups.length > 0 ? modifierGroups : undefined,
    } : {}),
  }
}

export function groupSummary(group: WorkshopGroup) {
  const active = group.options.filter((option) => option.active)
  const prices = active.map((option) => option.price_delta)
  const range = prices.length === 0 ? 'brak opcji' : Math.min(...prices) === Math.max(...prices) ? `${Math.min(...prices).toFixed(2).replace('.', ',')} zł` : `${Math.min(...prices).toFixed(2).replace('.', ',')}–${Math.max(...prices).toFixed(2).replace('.', ',')} zł`
  return `${active.length} opcji · ${group.selection_mode === 'single' ? 'jeden wybór' : 'wielokrotny'} · ${range}`
}
