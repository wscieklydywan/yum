import 'server-only'
import { revalidateTag, unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { loadCatalog } from '@/lib/menu-catalog'
import { loadRestaurantSettings } from '@/lib/restaurant-state'
import { loadActivePromotions } from '@/lib/promotions-server'
import { WHEEL_PUBLIC_FIELDS, type WheelPrize } from '@/lib/wheel'
import { DEFAULT_WHEEL_CONFIG, type WheelConfig } from '@/lib/marketing'
import { DEFAULT_LOYALTY_RATE } from '@/lib/loyalty-rate'
import type { PublicLoyalty } from '@/lib/loyalty-public'
import { TIER_SETTINGS_COLUMNS, tierSettingsFromRow } from '@/lib/club-tiers-server'
import { isHomeSlideId, normalizeSlideOrder, type HomeSlidesSettings } from '@/lib/home-slides'

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
export const PUBLIC_LOYALTY_TAG = 'public-loyalty'
export const PUBLIC_HOME_SLIDES_TAG = 'public-home-slides'

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

/** Earn rate and active rewards edited in Warsztat → Klienci / Marketing. Throws on a read error so it is never cached. */
export const getCachedLoyalty = unstable_cache(
  async (): Promise<PublicLoyalty> => {
    const admin = createAdminClient()
    const [settings, rewards] = await Promise.all([
      admin.from('restaurant_settings').select(`loyalty_points, loyalty_spend, ${TIER_SETTINGS_COLUMNS}`).eq('id', 1).maybeSingle(),
      admin.from('loyalty_rewards').select('key, name, note, cost, menu_value, image').eq('active', true).order('sort').order('key'),
    ])
    if (settings.error) throw settings.error
    if (rewards.error) throw rewards.error
    return {
      rate: settings.data ? { points: Number(settings.data.loyalty_points), spend: Number(settings.data.loyalty_spend) } : DEFAULT_LOYALTY_RATE,
      tiers: tierSettingsFromRow(settings.data),
      rewards: (rewards.data ?? []).map((reward) => ({
        key: reward.key,
        name: reward.name,
        note: reward.note ?? '',
        cost: Number(reward.cost),
        value: Number(reward.menu_value),
        image: reward.image || '/placeholder.svg',
      })),
    }
  },
  ['public-loyalty'],
  { tags: [PUBLIC_LOYALTY_TAG], revalidate: SAFETY_REVALIDATE_SECONDS },
)

/** Raw slider settings; the route joins the burger of the week with the (separately cached) catalog. Throws on a read error. */
export const getCachedHomeSlides = unstable_cache(
  async (): Promise<HomeSlidesSettings> => {
    const { data, error } = await createAdminClient()
      .from('home_slides_settings')
      .select('slide_order, hidden_slides, burger_week_enabled, burger_week_product_id, burger_week_title, burger_week_text, burger_week_until')
      .eq('id', 1)
      .maybeSingle()
    if (error) throw error
    return {
      order: normalizeSlideOrder(data?.slide_order),
      hidden: (data?.hidden_slides ?? []).filter(isHomeSlideId),
      burger_week: {
        enabled: data?.burger_week_enabled ?? false,
        product_id: data?.burger_week_product_id ?? null,
        title: data?.burger_week_title ?? 'Burger tygodnia',
        text: data?.burger_week_text ?? '',
        until: data?.burger_week_until ?? null,
      },
    }
  },
  ['public-home-slides'],
  { tags: [PUBLIC_HOME_SLIDES_TAG], revalidate: SAFETY_REVALIDATE_SECONDS },
)

/** Wraps a workshop mutation so the public cache is refreshed only after a successful write. */
export function invalidatesPublic<R extends Response | undefined>(tags: string[], handler: (request: Request) => Promise<R>) {
  return async (request: Request): Promise<R> => {
    const response = await handler(request)
    if (response?.ok) for (const tag of tags) revalidateTag(tag, { expire: 0 })
    return response
  }
}
