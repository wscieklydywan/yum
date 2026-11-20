import { DEFAULT_LOYALTY_RATE, type LoyaltyRate } from './loyalty-rate'
import { DEFAULT_TIER_SETTINGS, rewards as STATIC_REWARDS, type ClubTierSettings } from './loyalty'

/** Active reward from `loyalty_rewards`, as shown to customers. `value` = menu price in zł. */
export type PublicReward = { key: string; name: string; note: string; cost: number; value: number; image: string }

export type PublicLoyalty = { rate: LoyaltyRate; tiers: ClubTierSettings; rewards: PublicReward[] }

export const PUBLIC_LOYALTY_KEY = '/api/club/loyalty'

/** Used only when the database cannot be read; the workshop settings are the source of truth. */
export const FALLBACK_LOYALTY: PublicLoyalty = {
  rate: DEFAULT_LOYALTY_RATE,
  tiers: DEFAULT_TIER_SETTINGS,
  rewards: STATIC_REWARDS.map((reward) => ({ ...reward })),
}
