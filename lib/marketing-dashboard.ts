export const MARKETING_DASHBOARD_KEY = '/api/workshop/marketing/dashboard'
export const MARKETING_STATS_KEY = '/api/workshop/marketing/stats'

/**
 * Fallback comparison when the previous month is not a usable baseline. `rolling` compares the last 7 days with
 * the 7 days before; `snapshot` compares today's value of a rolling metric with its value a week ago.
 */
export type WeekTrend = { value: number; previous: number; comparable: boolean; kind: 'rolling' | 'snapshot' }

export type Trend = { value: number; previous: number; comparable?: boolean; week?: WeekTrend }

export type DashboardAlert = {
  id: string
  tone: 'danger' | 'warning' | 'info'
  title: string
  detail: string
  target: string
}

export type ScheduleItem = {
  id: string
  date: string
  kind: 'promo' | 'event' | 'content' | 'code'
  title: string
  detail: string
  target: string
}

export type ActivityDay = { date: string; customers: number; orders: number; allOrders: number; revenue: number }

export type LifecycleSegment = 'active' | 'atRisk' | 'newInactive' | 'dormant'
export type Lifecycle = Record<LifecycleSegment, number> & { total: number }

export type SalesChannel = { source: string; label: string; orders: number; revenue: number }

export const CHANNEL_LABELS: Record<string, string> = { yummy: 'Strona www', app: 'Aplikacja (PWA)', kiosk: 'Kiosk', own: 'Na miejscu / telefon', pyszne: 'Pyszne.pl', glovo: 'Glovo' }

export type MarketingKpi = {
  period: { from: string; previousFrom: string; previousTo: string; comparable?: boolean }
  activeCustomers: Trend & { total: number; newMembers: number; buyers: number }
  revenue: Trend & { orders: number; previousOrders: number; avgBasket: number; savings: number; allOrders: number; allRevenue: number; clubShare: number }
  repeatRate: Trend & { customers: number; repeatCustomers: number }
  rewardCost: Trend & { costRatio: number | null; budgetPercent: number | null; discounts: number; clubDiscounts: number; otherDiscounts: number; wheel: number; wheelSpins: number; rewards: number }
  sales: Trend & { orders: number; previousOrders: number; days: number; avgBasket: number; channels: SalesChannel[] }
  lifecycle: Lifecycle
}

export type ProgramsSummary = {
  club: { rate: string; tiers: number; rewards: number; members: number }
  customers: { total: number; newMembers: number; pendingRecovery: number }
  promos: { active: number; codes: number; maxDiscount: number }
  games: { wheelEnabled: boolean; wheelPrizes: number; halloween: 'live' | 'upcoming' | 'ended'; halloweenEnds: string; advent: 'off' | 'teaser' | 'live'; adventStarts: string }
  content: { visibleSlides: number; totalSlides: number; burgerWeek: boolean; burgerWeekUntil: string | null }
}

export type MarketingDashboard = {
  generatedAt: string
  kpi: MarketingKpi
  programs: ProgramsSummary
  installs: { total: number; month: number; active30: number; ios: number; android: number; pushDevices: number }
  budget: { limit: number | null; spent: number }
  alerts: DashboardAlert[]
  schedule: ScheduleItem[]
}

export type MarketingStats = {
  generatedAt: string
  kpi: MarketingKpi
  activity: ActivityDay[]
  tiers: { name: string; count: number; percent: number }[]
  stars: { earned: number; redeemed: number; redemptionRate: number; balance: number; balanceValue: number | null; claimedRewards: number; claimedCodes: number }
  topRewards: { name: string; count: number; stars: number }[]
  budget: { limit: number | null; spent: number }
}

export async function dashboardFetcher<T>(url: string): Promise<T> {
  const response = await fetch(url)
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error ?? 'Nie udało się wczytać danych.')
  return data
}

/**
 * Month-over-month change, or null when the previous period cannot serve as a baseline: it had no
 * recorded activity yet (e.g. the system or club started mid-month), or the base is so small that any
 * percentage would be noise (0,07 zł → 581 zł is not "+415 107%").
 */
export function trendPercent({ value, previous, comparable }: Trend) {
  if (comparable === false || previous <= 0) return null
  if (value > 0 && previous / value < 0.1) return null
  return Math.round(((value - previous) / previous) * 100)
}

export type TrendChange = { value: number; basis: 'month' | 'week' | 'weekAgo'; unit: '%' | ' pp' }

export const TREND_BASIS_LABEL: Record<TrendChange['basis'], { short: string; long: string }> = {
  month: { short: '', long: 'względem tego samego okresu poprzedniego miesiąca' },
  week: { short: '7 dni', long: 'ostatnie 7 dni względem poprzednich 7 dni' },
  weekAgo: { short: 'tydz.', long: 'względem stanu sprzed tygodnia' },
}

/**
 * The comparison shown on a KPI: month-over-month when last month is a real baseline, otherwise the
 * weekly fallback, otherwise nothing. Rates (points) only compare month-over-month.
 */
export function trendChange(trend: Trend, points = false): TrendChange | null {
  if (points) {
    const value = trendPoints(trend)
    return value === null ? null : { value, basis: 'month', unit: ' pp' }
  }
  const monthly = trendPercent(trend)
  if (monthly !== null) return { value: monthly, basis: 'month', unit: '%' }
  if (!trend.week) return null
  const weekly = trendPercent(trend.week)
  if (weekly === null) return null
  return { value: weekly, basis: trend.week.kind === 'rolling' ? 'week' : 'weekAgo', unit: '%' }
}

/** Difference in percentage points — the honest comparison for values that are already rates. */
export function trendPoints({ value, previous, comparable }: Trend) {
  if (comparable === false) return null
  return Math.round(value - previous)
}

/** The previous period counts as a baseline only once it had real order traffic. */
export const MIN_BASELINE_ORDERS = 20
