import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePromotion, PROMOTION_COLUMNS, type Promotion } from './promotions'

/** Promotions switched on by the bar. A missing table or a read error never blocks ordering – it just means no promotion. */
export async function loadActivePromotions(admin: SupabaseClient): Promise<Promotion[]> {
  const { data, error } = await admin.from('promotions').select(PROMOTION_COLUMNS).eq('active', true).order('sort').order('created_at')
  if (error || !data) return []
  return (data as Promotion[]).map(normalizePromotion)
}

export async function loadAllPromotions(admin: SupabaseClient): Promise<Promotion[] | null> {
  const { data, error } = await admin.from('promotions').select(PROMOTION_COLUMNS).order('sort').order('created_at')
  if (error || !data) return null
  return (data as Promotion[]).map(normalizePromotion)
}
