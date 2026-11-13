import 'server-only'
import type { createAdminClient } from '@/lib/supabase/server'
import { DEFAULT_LOYALTY_RATE } from '@/lib/loyalty-rate'
import { buildStarValue, DEFAULT_FOOD_COST_PERCENT, type StarValue } from '@/lib/loyalty-economics'

type Admin = ReturnType<typeof createAdminClient>

/** Jedno źródło prawdy dla wartości 1 Star – używane przez pulpit, koło, grę i płacenie Stars. */
export async function loadStarValue(admin: Admin): Promise<StarValue | null> {
  const [settings, rewards] = await Promise.all([
    admin
      .from('restaurant_settings')
      .select('loyalty_points, loyalty_spend, food_cost_percent, points_payment_enabled, points_payment_value')
      .eq('id', 1)
      .maybeSingle(),
    admin.from('loyalty_rewards').select('cost, menu_value, active').eq('active', true),
  ])
  if (settings.error || rewards.error) return null
  const s = settings.data
  return buildStarValue({
    rewards: (rewards.data ?? []).map((r) => ({ cost: Number(r.cost), menu_value: Number(r.menu_value), active: true })),
    rate: s ? { points: Number(s.loyalty_points), spend: Number(s.loyalty_spend) } : DEFAULT_LOYALTY_RATE,
    foodCostPercent: s?.food_cost_percent != null ? Number(s.food_cost_percent) : DEFAULT_FOOD_COST_PERCENT,
    pointsPayment: { enabled: Boolean(s?.points_payment_enabled), value: Number(s?.points_payment_value ?? 0) },
  })
}
