import 'server-only'
import { cache } from 'react'
import { getCachedLoyalty, getCachedRestaurantSettings, getCachedWheelConfig } from '@/lib/public-cache'
import { FALLBACK_LOYALTY } from '@/lib/loyalty-public'
import { DEFAULT_WHEEL_CONFIG } from '@/lib/marketing'
import { deliveryRadius } from '@/lib/order-settings'
import { DELIVERY_RADIUS_KM } from '@/lib/restaurant'
import type { SiteFacts } from '@/lib/seo'

/** Everything the public site shows that staff can change in Warsztat – one read per request. */
export const getPublicInfo = cache(async () => {
  const [settings, loyalty, wheel] = await Promise.all([
    getCachedRestaurantSettings().catch(() => null),
    getCachedLoyalty().catch(() => FALLBACK_LOYALTY),
    getCachedWheelConfig().catch(() => DEFAULT_WHEEL_CONFIG),
  ])
  return {
    openingHours: settings?.openingHours ?? null,
    radiusKm: settings ? deliveryRadius(settings.deliveryZones) : DELIVERY_RADIUS_KM,
    loyalty,
    wheel,
  }
})

export type PublicInfo = Awaited<ReturnType<typeof getPublicInfo>>

export const siteFacts = (info: PublicInfo): SiteFacts => ({
  openingHours: info.openingHours,
  radiusKm: info.radiusKm,
  rate: info.loyalty.rate,
  wheelEnabled: info.wheel.enabled,
})
