export type LoyaltyRate = { points: number; spend: number }

export const DEFAULT_LOYALTY_RATE: LoyaltyRate = { points: 1, spend: 1 }
export const MAX_LOYALTY_POINTS = 1000
export const MAX_LOYALTY_SPEND = 1000

/** Szacunek dla jednego zamówienia bez końcówki z poprzednich zakupów – dokładnie liczy private.loyalty_apply w bazie. */
export function purchasePoints(total: number, rate: LoyaltyRate) {
  if (!(total > 0) || !(rate.spend > 0)) return 0
  return Math.floor(total / rate.spend) * rate.points
}

const formatSpend = (spend: number) => (Number.isInteger(spend) ? String(spend) : spend.toFixed(2).replace('.', ','))

export function describeRate(rate: LoyaltyRate) {
  return `${rate.points} pkt za każde ${formatSpend(rate.spend)} zł`
}

/** Customer-facing wording, e.g. "1 Star za każdą wydaną 1 zł". */
export function describeStarRate(rate: LoyaltyRate) {
  return `${rate.points} ${rate.points === 1 ? 'Star' : 'Stars'} za każde wydane ${formatSpend(rate.spend)} zł`
}
