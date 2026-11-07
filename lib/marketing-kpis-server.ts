import 'server-only'
import type { createAdminClient } from '@/lib/supabase/server'
import { CHANNEL_LABELS, type MarketingKpi } from '@/lib/marketing-dashboard'

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

/** All headline aggregates come from one Postgres call (`marketing_kpis`), so no table is paged into Node. */
export async function loadMarketingKpis(admin: Admin, budgetLimit: number | null) {
  const { data, error } = await admin.rpc('marketing_kpis')
  if (error || !data) return { kpi: null, error }
  const raw = data as RawKpis
  const revenue = round2(Number(raw.revenue.value))
  const discounts = round2(Number(raw.cost.discounts))
  const clubDiscounts = round2(Number(raw.cost.clubDiscounts))
  const wheel = round2(Number(raw.cost.wheel))
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
      previous: round2(Number(raw.cost.previous)),
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
