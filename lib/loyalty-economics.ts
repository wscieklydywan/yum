import type { LoyaltyRate } from './loyalty-rate'

export const REWARDS_ADMIN_KEY = '/api/workshop/rewards'
export const HALLOWEEN_ADMIN_KEY = '/api/workshop/halloween'
export const DEFAULT_FOOD_COST_PERCENT = 30

export type LoyaltyReward = {
  key: string
  name: string
  note: string
  cost: number
  menu_value: number
  image: string
  active: boolean
  sort: number
}

export type RewardStats = { uses: number; total: number; periodUses: number; periodTotal: number }

export type RewardsAdminData = {
  foodCostPercent: number
  rate: LoyaltyRate
  rewards: (LoyaltyReward & { stats: RewardStats })[]
}

export type HalloweenSettings = {
  starts_at: string
  ends_at: string
  daily_games: number
  points_per_star: number
  max_stars_per_game: number
  daily_star_cap: number
}

export type HalloweenAdminData = {
  settings: HalloweenSettings
  stats: { games: number; players: number; stars: number; flagged: number; today_games: number; today_stars: number }
}

/** Ile złotych klient musi wydać, żeby zdobyć 1 Star. */
export function spendPerStar(rate: LoyaltyRate) {
  return rate.points > 0 ? rate.spend / rate.points : Infinity
}

/** Wartość menu (zł) przypadająca na 1 Star dla danej nagrody. */
export function menuValuePerStar(reward: Pick<LoyaltyReward, 'cost' | 'menu_value'>) {
  return reward.cost > 0 ? reward.menu_value / reward.cost : 0
}

export function rewardEconomics(reward: Pick<LoyaltyReward, 'cost' | 'menu_value'>, rate: LoyaltyRate, foodCostPercent: number) {
  const spend = reward.cost * spendPerStar(rate)
  const realCost = (reward.menu_value * foodCostPercent) / 100
  return {
    /** Ile klient musi wydać w lokalu, żeby uzbierać na nagrodę. */
    spendNeeded: spend,
    /** Szacowany koszt surowca dla lokalu. */
    realCost,
    /** Jaki % wydanych pieniędzy wraca do klienta (w cenach menu). */
    customerReturnPercent: spend > 0 ? (reward.menu_value / spend) * 100 : 0,
    /** Jaki % obrotu kosztuje lokal ta nagroda (koszt surowca). */
    businessCostPercent: spend > 0 ? (realCost / spend) * 100 : 0,
  }
}

/**
 * Koszt 1 Star dla lokalu w najgorszym przypadku – liczony z nagrody, która daje klientowi
 * najwięcej menu za 1 Star. Służy do wyceny Stars rozdawanych w kole i w grze.
 */
export function starRealCost(rewards: Pick<LoyaltyReward, 'cost' | 'menu_value' | 'active'>[], foodCostPercent: number) {
  const best = rewards.filter((reward) => reward.active).reduce((max, reward) => Math.max(max, menuValuePerStar(reward)), 0)
  return (best * foodCostPercent) / 100
}

type WheelPrizeForCost = {
  reward_type: string
  points: number
  product_id: string | null
  discount_value: number
  cost_value: number
}

/**
 * Szacowany koszt pojedynczej wygranej w kole dla lokalu (zł).
 * Ręcznie wpisany „koszt nagrody” ma pierwszeństwo; bez niego liczymy z Stars, ceny menu lub kwoty rabatu.
 */
export function wheelPrizeCost(prize: WheelPrizeForCost, starCost: number, productPrice: (id: string) => number | undefined, foodCostPercent: number) {
  if (prize.reward_type === 'nothing') return { cost: 0, source: 'none' as const }
  if (prize.reward_type === 'points') return { cost: prize.points * starCost, source: 'stars' as const }
  if (prize.cost_value > 0) return { cost: prize.cost_value, source: 'manual' as const }
  if (prize.reward_type === 'free_item' && prize.product_id) {
    const price = productPrice(prize.product_id)
    if (price !== undefined) return { cost: (price * foodCostPercent) / 100, source: 'menu' as const }
  }
  if (prize.reward_type === 'discount_amount') return { cost: prize.discount_value, source: 'discount' as const }
  return { cost: 0, source: 'unknown' as const }
}

/** Liczba dni wydarzenia (zaokrąglona w górę). */
export function eventDays(startsAt: string, endsAt: string) {
  const ms = new Date(endsAt).getTime() - new Date(startsAt).getTime()
  return Number.isFinite(ms) && ms > 0 ? Math.ceil(ms / 86_400_000) : 0
}

const percent = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 })
export const formatPercent = (value: number) => `${percent.format(Number.isFinite(value) ? value : 0)}%`
