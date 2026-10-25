import { codeDiscount, type CheckoutCode } from './checkout-codes'

const round = (value: number) => Math.round(value * 100) / 100

/**
 * The status discount never stacks with a coupon or promo code: the customer gets whichever is cheaper for them.
 * Codes that add a free item always win, because their value isn't part of the order total.
 * Running promotions (happy hours etc.) still apply first in both cases.
 */
export function clubPricing({
  productsValue,
  promotionDiscount,
  code,
  tierPercent,
}: {
  productsValue: number
  promotionDiscount: number
  code: Pick<CheckoutCode, 'discountType' | 'discountValue' | 'items'> | null
  tierPercent: number
}) {
  const afterPromotion = Math.max(0, productsValue - promotionDiscount)
  const codeAmount = codeDiscount(afterPromotion, code)
  const tierAmount = round((afterPromotion * Math.max(0, tierPercent)) / 100)
  const codeHasGift = Boolean(code?.items?.length)
  const useTier = tierAmount > 0 && (!code || (!codeHasGift && tierAmount > codeAmount))
  const discount = round(Math.min(productsValue, promotionDiscount + (useTier ? tierAmount : codeAmount)))
  return {
    discount,
    tierAmount: useTier ? tierAmount : 0,
    codeAmount: useTier ? 0 : codeAmount,
    /** A code was entered but the status discount is better, so the code stays unused. */
    codeSkipped: useTier && Boolean(code),
  }
}
