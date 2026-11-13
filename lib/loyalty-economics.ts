import type { LoyaltyRate } from './loyalty-rate'

export const REWARDS_ADMIN_KEY = '/api/workshop/rewards'
export const HALLOWEEN_ADMIN_KEY = '/api/workshop/halloween'
export const DEFAULT_FOOD_COST_PERCENT = 30

/** Pozycja kuponu. `product_id` wskazuje produkt z menu; bez niego to stara, opisowa pozycja. */
export type RewardItem = { product_id?: string; name: string; quantity: number; choice?: boolean }

export type LoyaltyReward = {
  key: string
  name: string
  note: string
  cost: number
  menu_value: number
  items: RewardItem[]
  image: string
  active: boolean
  sort: number
}

export type RewardStats = { uses: number; total: number; periodUses: number; periodTotal: number }

export type RewardMenuProduct = { id: string; name: string; price: number; image: string; category_id: string; category: string }

export type RewardsAdminData = {
  foodCostPercent: number
  rate: LoyaltyRate
  rewards: (LoyaltyReward & { stats: RewardStats })[]
  products: RewardMenuProduct[]
}

/** Wartość kuponu w cenach menu, liczona z aktualnych cen produktów. `null` gdy kupon nie jest powiązany z menu. */
export function linkedMenuValue(items: RewardItem[], productPrice: (id: string) => number | undefined) {
  const linked = items.filter((item) => item.product_id)
  if (!linked.length) return null
  return linked.reduce((sum, item) => sum + (productPrice(item.product_id!) ?? 0) * item.quantity, 0)
}

/** Poziomy ekonomii dla propozycji: jaki % obrotu lokal oddaje w koszcie surowca. */
export const REWARD_BUDGETS = [
  { key: 'saver', label: 'Oszczędnie', businessCostPercent: 1 },
  { key: 'balanced', label: 'Zbalansowanie', businessCostPercent: 1.5 },
  { key: 'generous', label: 'Hojnie', businessCostPercent: 2 },
] as const

/**
 * Ile Stars powinien kosztować kupon, żeby koszt surowca był równy `businessCostPercent` obrotu,
 * który klient musi wydać na zebranie punktów. Zaokrąglone w górę do „ładnej” liczby.
 */
export function suggestedStarCost(menuValue: number, rate: LoyaltyRate, foodCostPercent: number, businessCostPercent: number) {
  const zlPerStar = spendPerStar(rate)
  if (!(menuValue > 0) || !Number.isFinite(zlPerStar) || zlPerStar <= 0 || businessCostPercent <= 0) return 1
  const realCost = (menuValue * foodCostPercent) / 100
  const raw = realCost / (businessCostPercent / 100) / zlPerStar
  const step = raw < 100 ? 5 : raw < 500 ? 10 : 50
  return Math.max(step, Math.ceil(raw / step) * step)
}

export type HalloweenSettings = {
  starts_at: string
  ends_at: string
  daily_games: number
  points_per_star: number
  max_stars_per_game: number
  daily_star_cap: number
  prizes: HalloweenPrizeConfig[]
  runner_up_stars: number
  showcase_until: string
}

export type HalloweenPrizeItem = { name: string; quantity: number }
export type HalloweenPrizeConfig = { place: number; title: string; short: string; items: HalloweenPrizeItem[] }

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

type RewardForValue = Pick<LoyaltyReward, 'cost' | 'menu_value' | 'active'>

/**
 * Wartość 1 Star dla klienta w cenach menu (zł). Jedna definicja dla całej aplikacji:
 * najwięcej, ile klient może dostać za 1 Star – z katalogu nagród albo z płacenia Stars w koszyku (gdy włączone).
 */
export function starMenuValue(rewards: RewardForValue[], pointsPaymentValue = 0) {
  const best = rewards.filter((reward) => reward.active).reduce((max, reward) => Math.max(max, menuValuePerStar(reward)), 0)
  return Math.max(best, pointsPaymentValue > 0 ? pointsPaymentValue : 0)
}

/** Realny koszt 1 Star dla lokalu (zł) = wartość w menu × koszt surowca. Służy do wyceny Stars w kole i w grze. */
export function starRealCost(rewards: RewardForValue[], foodCostPercent: number, pointsPaymentValue = 0) {
  return (starMenuValue(rewards, pointsPaymentValue) * foodCostPercent) / 100
}

export const STAR_VALUE_KEY = '/api/workshop/star-value'

export type StarValue = {
  /** Ile zł zakupów daje 1 Star. */
  spendPerStar: number
  /** Ile 1 Star jest wart dla klienta w cenach menu. */
  menuValue: number
  /** Ile 1 Star realnie kosztuje lokal (surowiec). */
  realCost: number
  foodCostPercent: number
  /** Skąd pochodzi wartość: katalog nagród czy płacenie Stars w koszyku. */
  source: 'rewards' | 'payment' | 'none'
  /** Wartość 1 Star wynikająca z samego katalogu nagród (bez płacenia Stars). */
  catalogValue: number
  pointsPayment: { enabled: boolean; value: number }
  /** % wydanych pieniędzy, który wraca do klienta w cenach menu. */
  returnPercent: number
  /** % obrotu, który lokal realnie oddaje (surowiec). */
  costPercent: number
}

export function buildStarValue(input: { rewards: RewardForValue[]; rate: LoyaltyRate; foodCostPercent: number; pointsPayment: { enabled: boolean; value: number } }): StarValue {
  const spend = spendPerStar(input.rate)
  const catalogValue = starMenuValue(input.rewards)
  const paymentValue = input.pointsPayment.enabled ? input.pointsPayment.value : 0
  const menuValue = Math.max(catalogValue, paymentValue)
  const realCost = (menuValue * input.foodCostPercent) / 100
  const validSpend = Number.isFinite(spend) && spend > 0
  return {
    spendPerStar: spend,
    menuValue,
    realCost,
    foodCostPercent: input.foodCostPercent,
    source: menuValue <= 0 ? 'none' : paymentValue > catalogValue ? 'payment' : 'rewards',
    catalogValue,
    pointsPayment: input.pointsPayment,
    returnPercent: validSpend ? (menuValue / spend) * 100 : 0,
    costPercent: validSpend ? (realCost / spend) * 100 : 0,
  }
}

const preciseMoney = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 2, maximumFractionDigits: 3 })
/** Kwoty poniżej 1 zł pokazujemy w groszach (np. „2,4 gr”), żeby było jasne, o jakich wartościach mowa. */
export function formatStarMoney(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 zł'
  if (value < 1) return `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 }).format(value * 100)} gr`
  return preciseMoney.format(value)
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
