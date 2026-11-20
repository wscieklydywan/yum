import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { inStoreChannel, promotionDiscount, promotionNote, promotionsFor, type PromotionLine } from './promotions'
import { loadActivePromotions } from './promotions-server'

type EditableItem = {
  productId?: string
  quantity: number
  name: string
  unitPrice?: number
  cancelled?: boolean
  refunded?: number
  packaging?: unknown
  surcharge?: boolean
}

type ProductRef = { id: string; category: string | null }

const PROMOTION_NOTE_PART = /^Promocja\b/i

/** Older stored items carry only the product name, so they are matched to the menu by name. */
async function loadProductRefs(admin: SupabaseClient, items: EditableItem[]) {
  const ids = [...new Set(items.map((item) => item.productId).filter((id): id is string => Boolean(id)))]
  const names = [...new Set(items.filter((item) => !item.productId).map((item) => item.name))]
  const byId = new Map<string, ProductRef>()
  const byName = new Map<string, ProductRef>()
  const [withIds, withNames] = await Promise.all([
    ids.length ? admin.from('menu_products').select('id, name, category_id').in('id', ids) : Promise.resolve({ data: [] as { id: string; name: string; category_id: string | null }[] }),
    names.length ? admin.from('menu_products').select('id, name, category_id').in('name', names) : Promise.resolve({ data: [] as { id: string; name: string; category_id: string | null }[] }),
  ])
  for (const row of withIds.data ?? []) byId.set(row.id, { id: row.id, category: row.category_id })
  for (const row of withNames.data ?? []) if (!byName.has(row.name)) byName.set(row.name, { id: row.id, category: row.category_id })
  return (item: EditableItem) => (item.productId ? byId.get(item.productId) : byName.get(item.name)) ?? null
}

function toPromotionLines(items: EditableItem[], productOf: (item: EditableItem) => ProductRef | null): PromotionLine[] {
  const lines: PromotionLine[] = []
  for (const item of items) {
    if (item.cancelled || item.packaging || item.surcharge || typeof item.unitPrice !== 'number') continue
    const quantity = item.quantity - (item.refunded ?? 0)
    const product = productOf(item)
    if (quantity < 1 || !product) continue
    lines.push({ productId: product.id, category: product.category, amount: item.unitPrice * quantity, quantity })
  }
  return lines
}

/**
 * Recalculates the running promotions after the bar changed an order's items. Only the difference between
 * the promotion before and after the edit is applied, so status discounts, codes and manual price cuts stay as they were.
 */
export async function promotionDeltaForEdit(admin: SupabaseClient, options: { before: EditableItem[]; after: EditableItem[]; delivery: boolean; member: boolean; note: string | null }) {
  const promotions = promotionsFor(await loadActivePromotions(admin), options.member)
  if (!promotions.length) return { delta: 0, note: options.note }
  const productOf = await loadProductRefs(admin, [...options.before, ...options.after])
  const channel = inStoreChannel(options.delivery)
  const now = new Date()
  const before = promotionDiscount(toPromotionLines(options.before, productOf), promotions, channel, now)
  const after = promotionDiscount(toPromotionLines(options.after, productOf), promotions, channel, now)
  const delta = Math.round((after.discount - before.discount) * 100) / 100
  if (delta === 0) return { delta: 0, note: options.note }

  const rest = (options.note ?? '').split(' · ').filter((part) => part && !PROMOTION_NOTE_PART.test(part.trim()))
  const note = [after.applied.length ? promotionNote(after.applied) : null, ...rest].filter(Boolean).join(' · ') || null
  return { delta, note }
}
