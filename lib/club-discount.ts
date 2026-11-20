import { allocatePromotions, type AppliedPromotion, type Promotion, type PromotionChannel, type PromotionLine } from './promotions'
import { codeDiscount, type CheckoutCode } from './checkout-codes'

export type ClubDiscount = {
  discount: number
  promotions: AppliedPromotion[]
  statusAmount: number
  codeAmount: number
  /** False when a price coupon lost to the fan-status discount – it is not consumed. */
  codeUsed: boolean
}

const round = (value: number) => Math.round(value * 100) / 100

function priceLines(lines: PromotionLine[], promotions: Promotion[], channel: PromotionChannel, statusPercent: number, date: Date) {
  const { applied, promotionAmount, fallbackAmount } = allocatePromotions(lines, promotions, channel, date, statusPercent)
  return { applied, promotionAmount, statusAmount: fallbackAmount }
}

/**
 * Promotions and the fan-status discount never stack on the same product – the better one wins per line.
 * A price coupon (percent / amount) does not combine with the status discount: whichever gives the lower total is used.
 * Free-item coupons always combine.
 */
export function clubOrderDiscount(
  lines: PromotionLine[],
  promotions: Promotion[],
  channel: PromotionChannel,
  statusPercent: number,
  code: Pick<CheckoutCode, 'discountType' | 'discountValue'> | null,
  date: Date = new Date(),
): ClubDiscount {
  const subtotal = round(lines.reduce((sum, line) => sum + Math.max(0, line.amount), 0))
  const plain = priceLines(lines, promotions, channel, 0, date)
  const plainCode = codeDiscount(subtotal - plain.promotionAmount, code)
  const withCode: ClubDiscount = {
    discount: round(Math.min(subtotal, plain.promotionAmount + plainCode)),
    promotions: plain.applied,
    statusAmount: 0,
    codeAmount: plainCode,
    codeUsed: !!code,
  }
  if (!(statusPercent > 0)) return withCode

  const status = priceLines(lines, promotions, channel, statusPercent, date)
  const withStatus: ClubDiscount = {
    discount: round(Math.min(subtotal, status.promotionAmount + status.statusAmount)),
    promotions: status.applied,
    statusAmount: status.statusAmount,
    codeAmount: 0,
    codeUsed: !!code && !code.discountType,
  }
  if (code?.discountType && withCode.discount > withStatus.discount) return withCode
  return withStatus
}
