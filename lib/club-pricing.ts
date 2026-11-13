import { codeDiscount, type CheckoutCode } from './checkout-codes'

const round = (value: number) => Math.round(value * 100) / 100

/**
 * Loyalty (status) discount rules:
 * - it is counted only from products at regular prices – pieces covered by a promotion (happy hours, N-th item,
 *   free next-order reward etc.) are left out of its base instead of getting a second discount,
 * - free-item codes and gifts never block it – they combine with the status discount on the remaining products,
 * - price codes (percent / amount) don't stack with it: the customer gets whichever is cheaper for them.
 */
export function clubPricing({
  productsValue,
  promotionDiscount,
  regularValue,
  code,
  tierPercent,
}: {
  productsValue: number
  promotionDiscount: number
  /** Value of products at regular prices. Defaults to the value left after promotions. */
  regularValue?: number
  code: Pick<CheckoutCode, 'discountType' | 'discountValue' | 'items'> | null
  tierPercent: number
}) {
  const afterPromotion = Math.max(0, productsValue - promotionDiscount)
  const tierBase = Math.min(afterPromotion, Math.max(0, regularValue ?? afterPromotion))
  const codeAmount = codeDiscount(afterPromotion, code)
  const tierAmount = round((tierBase * Math.max(0, tierPercent)) / 100)
  const priceCode = Boolean(code?.discountType && code.discountValue)
  const useTier = tierAmount > 0 && (!priceCode || tierAmount > codeAmount)
  const useCode = Boolean(code) && (!useTier || !priceCode)
  const discount = round(Math.min(productsValue, promotionDiscount + (useTier ? tierAmount : 0) + (useCode ? codeAmount : 0)))
  return {
    discount,
    tierAmount: useTier ? tierAmount : 0,
    codeAmount: useCode ? codeAmount : 0,
    /** A price code was entered but the status discount is better, so the code stays unused. */
    codeSkipped: Boolean(code) && !useCode,
  }
}
