import 'server-only'
import { revalidateTag, unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { loadCatalog } from '@/lib/menu-catalog'
import { loadRestaurantSettings } from '@/lib/restaurant-state'
import { loadActivePromotions } from '@/lib/promotions-server'
import { WHEEL_PUBLIC_FIELDS, type WheelPrize } from '@/lib/wheel'
import { DEFAULT_WHEEL_CONFIG, type WheelConfig } from '@/lib/marketing'

/**
 * Server-side cache for data shown to customers on the public site.
 * Every visit hits these instead of Supabase; the workshop invalidates the matching tag after each change.
 * `revalidate` is only a safety net for edits made outside the app (e.g. directly in Supabase).
 * Ordering never reads from here – /api/orders always validates against fresh data.
 */
export const PUBLIC_MENU_TAG = 'public-menu'
export const PUBLIC_SETTINGS_TAG = 'public-restaurant-settings'
export const PUBLIC_PROMOTIONS_TAG = 'public-promotions'
export const PUBLIC_WHEEL_TAG = 'public-wheel'
export const PUBLIC_WHEEL_CONFIG_TAG = 'public-wheel-config'

const SAFETY_REVALIDATE_SECONDS = 300

export const getCachedCatalog = unstable_cache(
  () => loadCatalog(createAdminClient()),
  ['public-catalog'],
  { tags: [PUBLIC_MENU_TAG], revalidate: SAFETY_REVALIDATE_SECONDS },
)

export const getCachedRestaurantSettings = unstable_cache(
  () => loadRestaurantSettings(createAdminClient()),
  ['public-restaurant-settings'],
  { tags: [PUBLIC_SETTINGS_TAG], revalidate: SAFETY_REVALIDATE_SECONDS },
)

export const getCachedPromotions = unstable_cache(
  () => loadActivePromotions(createAdminClient()),
  ['public-promotions'],
  { tags: [PUBLIC_PROMOTIONS_TAG], revalidate: SAFETY_REVALIDATE_SECONDS },
)

export const getCachedWheelPrizes = unstable_cache(
  async (): Promise<WheelPrize[]> => {
    const { data, error } = await createAdminClient()
      .from('wheel_prizes')
      .select(WHEEL_PUBLIC_FIELDS)
      .eq('active', true)
      .order('sort')
      .order('id')
    if (error) throw error
    return (data ?? []).map((row) => ({ ...row, discount_value: Number(row.discount_value) })) as WheelPrize[]
  },
  ['public-wheel-prizes'],
  { tags: [PUBLIC_WHEEL_TAG], revalidate: SAFETY_REVALIDATE_SECONDS },
)

/** Throws on a read error so a failed read is never cached; the route falls back to defaults uncached. */
export const getCachedWheelConfig = unstable_cache(
  async (): Promise<WheelConfig> => {
    const { data, error } = await createAdminClient()
      .from('restaurant_settings')
      .select('wheel_enabled, extra_spin_enabled, extra_spin_cost')
      .eq('id', 1)
      .maybeSingle()
    if (error) throw error
    return data
      ? { enabled: data.wheel_enabled, extraSpinEnabled: data.extra_spin_enabled, extraSpinCost: data.extra_spin_cost }
      : DEFAULT_WHEEL_CONFIG
  },
  ['public-wheel-config'],
  { tags: [PUBLIC_WHEEL_CONFIG_TAG], revalidate: SAFETY_REVALIDATE_SECONDS },
)

/** Wraps a workshop mutation so the public cache is refreshed only after a successful write. */
export function invalidatesPublic<R extends Response | undefined>(tags: string[], handler: (request: Request) => Promise<R>) {
  return async (request: Request): Promise<R> => {
    const response = await handler(request)
    if (response?.ok) for (const tag of tags) revalidateTag(tag, { expire: 0 })
    return response
  }
}
