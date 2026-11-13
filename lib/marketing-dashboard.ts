export const MARKETING_DASHBOARD_KEY = '/api/workshop/marketing/dashboard'
export const MARKETING_STATS_KEY = '/api/workshop/marketing/stats'

export type Trend = { value: number; previous: number }

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
  period: { from: string; previousFrom: string; previousTo: string }
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

export function trendPercent({ value, previous }: Trend) {
  if (previous === 0) return value > 0 ? 100 : 0
  return Math.round(((value - previous) / previous) * 100)
}

/** Difference in percentage points — the honest comparison for values that are already rates. */
export function trendPoints({ value, previous }: Trend) {
  return Math.round(value - previous)
}
