/** Paying with Stars in the cart. Edited in Warsztat → Marketing → Płacenie punktami, stored in restaurant_settings. */
export type PointsPaymentSettings = {
  enabled: boolean
  /** How many zł one Star takes off the receipt. */
  value: number
  /** Max share of the order (products + packaging, after other discounts) that can be paid with Stars. */
  maxPercent: number
  /** Whether the amount still paid after the Stars discount earns new Stars. */
  earnsRest: boolean
}

export type PublicPointsPayment = PointsPaymentSettings & { balance: number | null }

export const DEFAULT_POINTS_PAYMENT: PointsPaymentSettings = { enabled: false, value: 1, maxPercent: 100, earnsRest: true }
export const MAX_POINTS_PAYMENT_VALUE = 1000
export const MAX_POINTS_PER_ORDER = 100_000

export const WORKSHOP_POINTS_PAYMENT_KEY = '/api/workshop/points-payment'
export const PUBLIC_POINTS_PAYMENT_KEY = '/api/club/points-payment'

const round = (value: number) => Math.round(value * 100) / 100

/** Most Stars that can go towards an order worth `payable` zł, limited by the customer's balance. */
export function maxUsablePoints(payable: number, settings: PointsPaymentSettings, balance = Infinity) {
  if (!settings.enabled || !(settings.value > 0) || !(payable > 0)) return 0
  const cap = (payable * Math.min(100, Math.max(1, settings.maxPercent))) / 100
  return Math.max(0, Math.min(balance, Math.floor(round(cap) / settings.value + 1e-9)))
}

export function pointsDiscountValue(points: number, settings: Pick<PointsPaymentSettings, 'value'>) {
  return round(Math.max(0, points) * settings.value)
}

export const starsLabel = (points: number) => (points === 1 ? 'Star' : 'Stars')
