export type LoyaltyRate = { points: number; spend: number }

export const DEFAULT_LOYALTY_RATE: LoyaltyRate = { points: 1, spend: 10 }
export const MAX_LOYALTY_POINTS = 1000
export const MAX_LOYALTY_SPEND = 1000

/** Szacunek dla jednego zamówienia bez końcówki z poprzednich zakupów – dokładnie liczy private.loyalty_apply w bazie. */
export function purchasePoints(total: number, rate: LoyaltyRate) {
  if (!(total > 0) || !(rate.spend > 0)) return 0
  return Math.floor(total / rate.spend) * rate.points
}

export function describeRate(rate: LoyaltyRate) {
  const spend = Number.isInteger(rate.spend) ? String(rate.spend) : rate.spend.toFixed(2).replace('.', ',')
  return `${rate.points} pkt za każde ${spend} zł`
}
