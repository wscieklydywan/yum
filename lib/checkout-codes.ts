import type { CouponItem } from './coupons'

export const GUEST_PROMO_CODE = 'YUMMY10'
export const GUEST_PROMO_PERCENT = 10

export type CheckoutCode = {
  kind: 'coupon' | 'promo' | 'guest'
  code: string
  reward: string
  items: CouponItem[]
  discountType: 'percent' | 'amount' | null
  discountValue: number | null
}

export const GUEST_CHECKOUT_CODE: CheckoutCode = {
  kind: 'guest',
  code: GUEST_PROMO_CODE,
  reward: `Rabat ${GUEST_PROMO_CODE}`,
  items: [],
  discountType: 'percent',
  discountValue: GUEST_PROMO_PERCENT,
}

export function codeDiscount(subtotal: number, code: Pick<CheckoutCode, 'discountType' | 'discountValue'> | null) {
  if (!code?.discountType || !code.discountValue || subtotal <= 0) return 0
  const value = Number(code.discountValue)
  const raw = code.discountType === 'percent' ? (subtotal * Math.min(value, 100)) / 100 : value
  return Math.round(Math.min(raw, subtotal) * 100) / 100
}

export function describeCodeBenefit(code: CheckoutCode) {
  if (code.discountType === 'percent') return `-${Number(code.discountValue)}% na zamówienie`
  if (code.discountType === 'amount') return `-${Number(code.discountValue)} zł na zamówienie`
  return code.items.map((item) => `${item.quantity}× ${item.name} gratis`).join(', ')
}

export const CHECKOUT_CODE_ERRORS: Record<string, string> = {
  not_authenticated: 'Zaloguj się do Yummy Club, aby użyć tego kodu.',
  promo_invalid: 'Taki kod nie istnieje, wygasł lub należy do innego konta.',
  promo_expired: 'Ten kod stracił ważność.',
  promo_exhausted: 'Limit użyć tego kodu został wyczerpany.',
  promo_already_used: 'Ten kod został już przez Ciebie wykorzystany.',
  promo_points_only: 'Ten kod dodaje punkty – wpisz go w Yummy Club.',
}

export function checkoutCodeError(message: string | undefined) {
  return (message && CHECKOUT_CODE_ERRORS[message]) || 'Nie udało się sprawdzić kodu.'
}
