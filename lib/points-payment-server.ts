import 'server-only'
import type { createAdminClient } from '@/lib/supabase/server'
import { DEFAULT_POINTS_PAYMENT, type PointsPaymentSettings } from '@/lib/points-payment'

type Admin = ReturnType<typeof createAdminClient>

/** Always fresh – ordering must validate against the current setting, never a cached one. */
export async function loadPointsPayment(admin: Admin): Promise<PointsPaymentSettings | null> {
  const { data, error } = await admin
    .from('restaurant_settings')
    .select('points_payment_enabled, points_payment_value, points_payment_max_percent, points_payment_earns_rest')
    .eq('id', 1)
    .maybeSingle()
  if (error) return null
  if (!data) return DEFAULT_POINTS_PAYMENT
  return {
    enabled: Boolean(data.points_payment_enabled),
    value: Number(data.points_payment_value),
    maxPercent: Number(data.points_payment_max_percent),
    earnsRest: data.points_payment_earns_rest !== false,
  }
}
