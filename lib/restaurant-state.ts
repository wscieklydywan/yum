import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_HOURS, computeStatus, parseOpeningHours, type RestaurantSettings } from './restaurant-status'
import { DEFAULT_DELIVERY_ZONES, DEFAULT_MIN_ORDER, DEFAULT_PACKAGING_PRICES, parseDeliveryZones, parseFreeDeliveryFrom, parseMinOrder, parsePackagingPrices } from './order-settings'

export const SETTINGS_COLUMNS = 'kitchen_open, bar_open, day_open, day_opened_at, auto_hours, close_before_minutes, opening_hours, min_order_online, delivery_zones, packaging_prices, free_delivery_from, ordering_override_until'

export type SettingsRow = {
  kitchen_open: boolean
  bar_open: boolean
  day_open: boolean
  day_opened_at: string | null
  auto_hours: boolean
  close_before_minutes: number | null
  opening_hours: unknown
  min_order_online: number | string | null
  delivery_zones: unknown
  packaging_prices: unknown
  free_delivery_from: number | string | null
  ordering_override_until: string | null
}

export function toSettings(row: SettingsRow): RestaurantSettings {
  return {
    kitchenOpen: row.kitchen_open,
    barOpen: row.bar_open,
    dayOpen: row.day_open,
    dayOpenedAt: row.day_opened_at,
    autoHours: row.auto_hours,
    closeBeforeMinutes: row.close_before_minutes ?? 0,
    openingHours: parseOpeningHours(row.opening_hours) ?? DEFAULT_HOURS,
    minOrderOnline: parseMinOrder(row.min_order_online) ?? DEFAULT_MIN_ORDER,
    deliveryZones: parseDeliveryZones(row.delivery_zones) ?? DEFAULT_DELIVERY_ZONES,
    packagingPrices: parsePackagingPrices(row.packaging_prices) ?? DEFAULT_PACKAGING_PRICES,
    freeDeliveryFrom: parseFreeDeliveryFrom(row.free_delivery_from ?? null) ?? null,
    orderingOverrideUntil: row.ordering_override_until ?? null,
  }
}

export async function loadRestaurantSettings(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('restaurant_settings').select(SETTINGS_COLUMNS).eq('id', 1).maybeSingle()
  if (error || !data) return null
  return toSettings(data as SettingsRow)
}

export async function loadRestaurantStatus(supabase: SupabaseClient) {
  const settings = await loadRestaurantSettings(supabase)
  return settings ? computeStatus(settings) : null
}
