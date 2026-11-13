export type CouponItem = { name: string; quantity: number }

export type ActiveCoupon = {
  id: number
  code: string
  reward: string
  cost: number
  items: CouponItem[]
  expires_at: string
  created_at: string
}

export const COUPON_VALIDITY_HOURS = 24
export const ACTIVE_COUPONS_KEY = 'club-active-coupons'

export function normalizeCouponCode(value: string) {
  return value.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 6)
}

export function formatCouponExpiry(iso: string) {
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}
