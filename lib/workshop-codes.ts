import type { SupabaseClient } from '@supabase/supabase-js'
import { GUEST_CHECKOUT_CODE, type CheckoutCode } from './checkout-codes'
import type { CouponItem } from './coupons'

export type WorkshopCode = CheckoutCode & { customer: string | null; customerId: string | null }

type Coupon = {
  user_id: string | null
  code: string
  reward: string
  items: CouponItem[] | null
  discount_type: 'percent' | 'amount' | null
  discount_value: number | null
  [column: string]: unknown
}

type Promo = {
  id: string
  code: string
  description: string
  reward_type: 'points' | 'free_item' | 'discount_percent' | 'discount_amount'
  product_name: string
  discount_value: number
  max_uses: number | null
  uses_count: number
  expires_at: string | null
  active: boolean
}

export type WorkshopCodeClaim = { code: WorkshopCode; release: () => Promise<void> }

export class WorkshopCodeError extends Error {}

export function normalizeWorkshopCode(value: unknown) {
  return typeof value === 'string' ? value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24) : ''
}

async function customerName(admin: SupabaseClient, userId: string | null) {
  if (!userId) return null
  const { data } = await admin.from('profiles').select('full_name, email').eq('id', userId).maybeSingle()
  return data?.full_name || data?.email?.split('@')[0] || 'Klient Yummy Club'
}

async function fromCoupon(admin: SupabaseClient, coupon: Coupon): Promise<WorkshopCode> {
  const items = coupon.discount_type ? [] : coupon.items?.length ? coupon.items : [{ name: coupon.reward, quantity: 1 }]
  return {
    kind: 'coupon',
    code: coupon.code,
    reward: coupon.reward,
    items,
    discountType: coupon.discount_type,
    discountValue: coupon.discount_value === null ? null : Number(coupon.discount_value),
    customer: await customerName(admin, coupon.user_id),
    customerId: coupon.user_id,
  }
}

function fromPromo(promo: Promo): WorkshopCode {
  return {
    kind: 'promo',
    code: promo.code,
    reward: `Kod ${promo.code}${promo.description ? ` · ${promo.description}` : ''}`,
    items: promo.reward_type === 'free_item' ? [{ name: promo.product_name || 'Darmowa pozycja', quantity: 1 }] : [],
    discountType: promo.reward_type === 'discount_percent' ? 'percent' : promo.reward_type === 'discount_amount' ? 'amount' : null,
    discountValue: promo.reward_type === 'free_item' ? null : Number(promo.discount_value),
    customer: null,
    customerId: null,
  }
}

function validatePromo(promo: Promo) {
  if (!promo.active) throw new WorkshopCodeError('Ten kod jest nieaktywny.')
  if (promo.expires_at && new Date(promo.expires_at) <= new Date()) throw new WorkshopCodeError('Ten kod stracił ważność.')
  if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) throw new WorkshopCodeError('Limit użyć tego kodu został wyczerpany.')
  if (promo.reward_type === 'points') throw new WorkshopCodeError('Ten kod dodaje punkty – klient wpisuje go w Yummy Club.')
}

const NOT_FOUND = 'Kod nie istnieje, został już wykorzystany albo wygasł.'

export async function previewWorkshopCode(admin: SupabaseClient, code: string): Promise<WorkshopCode> {
  if (code === GUEST_CHECKOUT_CODE.code) return { ...GUEST_CHECKOUT_CODE, customer: null, customerId: null }
  const { data: coupon } = await admin.from('reward_redemptions').select('*').eq('code', code).gt('expires_at', new Date().toISOString()).maybeSingle<Coupon>()
  if (coupon) return fromCoupon(admin, coupon)
  const { data: promo } = await admin.from('promo_codes').select('*').eq('code', code).maybeSingle<Promo>()
  if (!promo) throw new WorkshopCodeError(NOT_FOUND)
  validatePromo(promo)
  return fromPromo(promo)
}

export async function claimWorkshopCode(admin: SupabaseClient, code: string): Promise<WorkshopCodeClaim> {
  if (code === GUEST_CHECKOUT_CODE.code) return { code: { ...GUEST_CHECKOUT_CODE, customer: null, customerId: null }, release: async () => {} }

  // DELETE ... RETURNING is atomic: two cashiers cannot redeem the same personal coupon.
  const { data: coupon } = await admin.from('reward_redemptions').delete().eq('code', code).gt('expires_at', new Date().toISOString()).select('*').maybeSingle<Coupon>()
  if (coupon) {
    const { id: _id, ...restore } = coupon
    return { code: await fromCoupon(admin, coupon), release: async () => { await admin.from('reward_redemptions').insert(restore) } }
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: promo } = await admin.from('promo_codes').select('*').eq('code', code).maybeSingle<Promo>()
    if (!promo) throw new WorkshopCodeError(NOT_FOUND)
    validatePromo(promo)
    // Optimistic lock on uses_count keeps max_uses exact under concurrent redemptions.
    const { data: updated } = await admin.from('promo_codes').update({ uses_count: promo.uses_count + 1 }).eq('id', promo.id).eq('uses_count', promo.uses_count).select('id')
    if (updated?.length) {
      return {
        code: fromPromo(promo),
        release: async () => {
          const { data: current } = await admin.from('promo_codes').select('uses_count').eq('id', promo.id).maybeSingle()
          if (current) await admin.from('promo_codes').update({ uses_count: Math.max(0, current.uses_count - 1) }).eq('id', promo.id)
        },
      }
    }
  }
  throw new WorkshopCodeError('Nie udało się zarezerwować kodu. Spróbuj ponownie.')
}
