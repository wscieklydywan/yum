import 'server-only'
import type { createAdminClient } from '@/lib/supabase/server'
import { CHANNEL_LABELS, type MarketingKpi } from '@/lib/marketing-dashboard'
import { wheelPrizeCost } from '@/lib/loyalty-economics'
import { loadStarValue } from '@/lib/star-value-server'

type Admin = ReturnType<typeof createAdminClient>

type RawKpis = {
  period: MarketingKpi['period']
  revenue: { value: number; previous: number; orders: number; previousOrders: number; savings: number; allOrders: number; allRevenue: number }
  active: { value: number; previous: number; total: number; newMembers: number; buyers: number }
  repeat: { customers: number; repeatCustomers: number; previousCustomers: number; previousRepeat: number }
  cost: { discounts: number; clubDiscounts: number; wheel: number; rewards: number; previous: number }
  sales: { revenue: number; previous: number; orders: number; previousOrders: number; days: number; channels: { source: string; orders: number; revenue: number }[] }
  lifecycle: MarketingKpi['lifecycle']
}

const round2 = (value: number) => Math.round(value * 100) / 100
const rate = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

/**
 * Wheel spins are logged with the prize's manual cost only, which is 0 for Stars prizes. The real cost is
 * priced here the same way as in the wheel editor: Stars × cost of 1 Star, menu price × food cost, or rabat.
 */
async function wheelCost(admin: Admin, period: MarketingKpi['period']) {
  const [counts, prizes, star] = await Promise.all([
    admin.rpc('wheel_spin_counts', { p_from: period.from, p_previous_from: period.previousFrom, p_previous_to: period.previousTo }),
    admin.from('wheel_prizes').select('id, reward_type, points, product_id, discount_value, cost_value'),
    loadStarValue(admin),
  ])
  if (counts.error || prizes.error || !star) return null
  const foodCost = star.foodCostPercent
  const starCost = star.realCost
  const productIds = (prizes.data ?? []).map((p) => p.product_id).filter((id): id is string => Boolean(id))
  const products = productIds.length ? await admin.from('menu_products').select('id, price').in('id', productIds) : { data: [] }
  const prices = new Map((products.data ?? []).map((p) => [String(p.id), Number(p.price)]))
  const costs = new Map(
    (prizes.data ?? []).map((p) => [
      String(p.id),
      wheelPrizeCost({ reward_type: p.reward_type, points: Number(p.points ?? 0), product_id: p.product_id, discount_value: Number(p.discount_value ?? 0), cost_value: Number(p.cost_value ?? 0) }, starCost, (id) => prices.get(id), foodCost).cost,
    ]),
  )
  let current = 0
  let previous = 0
  let spins = 0
  for (const row of (counts.data ?? []) as { ref_id: string; current_spins: number; previous_spins: number }[]) {
    const cost = costs.get(String(row.ref_id)) ?? 0
    current += cost * Number(row.current_spins)
    previous += cost * Number(row.previous_spins)
    spins += Number(row.current_spins)
  }
  return { current: round2(current), previous: round2(previous), spins }
}

/** All headline aggregates come from one Postgres call (`marketing_kpis`), so no table is paged into Node. */
export async function loadMarketingKpis(admin: Admin, budgetLimit: number | null) {
  const { data, error } = await admin.rpc('marketing_kpis')
  if (error || !data) return { kpi: null, error }
  const raw = data as RawKpis
  const priced = await wheelCost(admin, raw.period)
  const loggedWheel = round2(Number(raw.cost.wheel))
  const revenue = round2(Number(raw.revenue.value))
  const discounts = round2(Number(raw.cost.discounts))
  const clubDiscounts = round2(Number(raw.cost.clubDiscounts))
  const wheel = priced ? priced.current : loggedWheel
  const rewards = round2(Number(raw.cost.rewards))
  const cost = round2(discounts + wheel + rewards)
  const salesRevenue = round2(Number(raw.sales.revenue))
  const kpi: MarketingKpi = {
    period: raw.period,
    sales: {
      value: salesRevenue,
      previous: round2(Number(raw.sales.previous)),
      orders: raw.sales.orders,
      previousOrders: raw.sales.previousOrders,
      days: raw.sales.days,
      avgBasket: raw.sales.orders ? round2(salesRevenue / raw.sales.orders) : 0,
      channels: raw.sales.channels.map((channel) => ({
        source: channel.source,
        label: CHANNEL_LABELS[channel.source] ?? channel.source,
        orders: channel.orders,
        revenue: round2(Number(channel.revenue)),
      })),
    },
    activeCustomers: raw.active,
    revenue: {
      value: revenue,
      previous: round2(Number(raw.revenue.previous)),
      orders: raw.revenue.orders,
      previousOrders: raw.revenue.previousOrders,
      avgBasket: raw.revenue.orders ? round2(revenue / raw.revenue.orders) : 0,
      savings: round2(Number(raw.revenue.savings)),
      allOrders: raw.revenue.allOrders,
      allRevenue: round2(Number(raw.revenue.allRevenue)),
      clubShare: rate(raw.revenue.orders, raw.revenue.allOrders),
    },
    repeatRate: {
      value: rate(raw.repeat.repeatCustomers, raw.repeat.customers),
      previous: rate(raw.repeat.previousRepeat, raw.repeat.previousCustomers),
      customers: raw.repeat.customers,
      repeatCustomers: raw.repeat.repeatCustomers,
    },
    rewardCost: {
      value: cost,
      previous: round2(Number(raw.cost.previous) + (priced?.previous ?? 0)),
      wheelSpins: priced?.spins ?? 0,
      costRatio: salesRevenue > 0 ? Math.round((cost / salesRevenue) * 1000) / 10 : null,
      budgetPercent: budgetLimit ? Math.round((wheel / budgetLimit) * 100) : null,
      discounts,
      clubDiscounts,
      otherDiscounts: round2(discounts - clubDiscounts),
      wheel,
      rewards,
    },
    lifecycle: raw.lifecycle,
  }
  return { kpi, error: null }
}

export const PRIVATE_CACHE = { 'Cache-Control': 'private, max-age=60' }
