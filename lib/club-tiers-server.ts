import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildTiers, DEFAULT_TIER_SETTINGS, parsePerks, type ClubTierSettings } from '@/lib/loyalty'

export const TIER_SETTINGS_COLUMNS =
  'silver_fan_threshold_points, gold_fan_threshold_points, silver_fan_discount_percent, gold_fan_discount_percent, fan_perks, silver_fan_perks, gold_fan_perks'

type TierRow = {
  silver_fan_threshold_points: number | null
  gold_fan_threshold_points: number | null
  silver_fan_discount_percent: number | string | null
  gold_fan_discount_percent: number | string | null
  fan_perks: string | null
  silver_fan_perks: string | null
  gold_fan_perks: string | null
}

export function tierSettingsFromRow(row: Partial<TierRow> | null | undefined): ClubTierSettings {
  if (!row) return DEFAULT_TIER_SETTINGS
  return {
    silverMin: Number(row.silver_fan_threshold_points ?? DEFAULT_TIER_SETTINGS.silverMin),
    goldMin: Number(row.gold_fan_threshold_points ?? DEFAULT_TIER_SETTINGS.goldMin),
    silverPercent: Number(row.silver_fan_discount_percent ?? DEFAULT_TIER_SETTINGS.silverPercent),
    goldPercent: Number(row.gold_fan_discount_percent ?? DEFAULT_TIER_SETTINGS.goldPercent),
    perks: { fan: parsePerks(row.fan_perks), silver: parsePerks(row.silver_fan_perks), gold: parsePerks(row.gold_fan_perks) },
  }
}

/** Fresh read for pricing – an order must always use the thresholds that are saved right now. */
export async function loadTierSettings(admin: SupabaseClient): Promise<ClubTierSettings> {
  const { data, error } = await admin.from('restaurant_settings').select(TIER_SETTINGS_COLUMNS).eq('id', 1).maybeSingle()
  if (error) throw error
  return tierSettingsFromRow(data as TierRow | null)
}

export async function loadTiers(admin: SupabaseClient) {
  return buildTiers(await loadTierSettings(admin))
}
