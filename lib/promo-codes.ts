import { rewardSummary } from './wheel'

export const PROMO_REWARD_TYPES = ['points', 'free_item', 'discount_percent', 'discount_amount'] as const
export type PromoRewardType = (typeof PROMO_REWARD_TYPES)[number]

export const PROMO_REWARD_LABELS: Record<PromoRewardType, string> = {
  points: 'Darmowe punkty',
  free_item: 'Darmowa pozycja z menu',
  discount_percent: 'Rabat procentowy',
  discount_amount: 'Rabat kwotowy',
}

export type PromoCode = {
  id: string
  code: string
  description: string
  reward_type: PromoRewardType
  points: number
  product_id: string | null
  product_name: string
  discount_value: number
  coupon_hours: number
  max_uses: number | null
  per_user_limit: number
  uses_count: number
  expires_at: string | null
  active: boolean
  created_at: string
  cost_value: number
  budget: number | null
  spent: number
}

export const PROMO_FIELDS =
  'id, code, description, reward_type, points, product_id, product_name, discount_value, coupon_hours, max_uses, per_user_limit, uses_count, expires_at, active, created_at, cost_value, budget'

export function normalizePromoCode(value: string) {
  return value.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '').slice(0, 24)
}

export function promoRewardSummary(promo: Pick<PromoCode, 'reward_type' | 'points' | 'product_name' | 'discount_value'>) {
  return rewardSummary(promo)
}

export type PromoStatus = 'active' | 'inactive' | 'expired' | 'exhausted'

export function promoBudgetLeft(promo: Pick<PromoCode, 'budget' | 'spent' | 'cost_value'>) {
  return promo.budget === null ? null : Math.max(0, promo.budget - promo.spent)
}

export function promoStatus(promo: Pick<PromoCode, 'active' | 'expires_at' | 'max_uses' | 'uses_count' | 'budget' | 'spent' | 'cost_value'>, now = Date.now()): PromoStatus {
  if (!promo.active) return 'inactive'
  if (promo.expires_at && new Date(promo.expires_at).getTime() <= now) return 'expired'
  if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) return 'exhausted'
  const left = promoBudgetLeft(promo)
  if (left !== null && promo.cost_value > 0 && left < promo.cost_value) return 'exhausted'
  return 'active'
}

export const PROMO_STATUS_LABELS: Record<PromoStatus, string> = {
  active: 'Aktywny',
  inactive: 'Wyłączony',
  expired: 'Wygasł',
  exhausted: 'Wykorzystany',
}

export const PROMO_ERROR_MESSAGES: Record<string, string> = {
  promo_invalid: 'Taki kod nie istnieje lub jest nieaktywny.',
  promo_expired: 'Ten kod stracił ważność.',
  promo_exhausted: 'Limit użyć tego kodu został wyczerpany.',
  promo_already_used: 'Ten kod został już przez Ciebie wykorzystany.',
  not_authenticated: 'Zaloguj się, aby użyć kodu.',
}
