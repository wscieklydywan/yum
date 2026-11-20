import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'
import { TIER_SETTINGS_COLUMNS, tierSettingsFromRow } from '@/lib/club-tiers-server'
import { buildTiers } from '@/lib/loyalty'
import { loadMarketingKpis, PRIVATE_CACHE } from '@/lib/marketing-kpis-server'
import type { ActivityDay, MarketingStats } from '@/lib/marketing-dashboard'

type RawStats = {
  activity: ActivityDay[]
  tiers: { gold: number; silver: number; fan: number; balance: number }
  stars: { earned: number; redeemed: number }
  claimedRewards: number
  claimedCodes: number
  topRewards: MarketingStats['topRewards']
}

export async function GET() {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response

  const admin = createAdminClient()
  const [settings, rewards] = await Promise.all([
    admin.from('restaurant_settings').select(`wheel_monthly_budget, ${TIER_SETTINGS_COLUMNS}`).eq('id', 1).single(),
    admin.from('loyalty_rewards').select('cost, menu_value').eq('active', true),
  ])
  const s = settings.data as Record<string, unknown> | null
  if (settings.error || !s) {
    console.error('[marketing-stats]', settings.error)
    return NextResponse.json({ error: 'Nie udało się wczytać statystyk.' }, { status: 500 })
  }

  const tierList = buildTiers(tierSettingsFromRow(s))
  const silverMin = tierList[1]?.min ?? Number.MAX_SAFE_INTEGER
  const goldMin = tierList[2]?.min ?? Number.MAX_SAFE_INTEGER
  const budgetLimit = s.wheel_monthly_budget === null ? null : Number(s.wheel_monthly_budget)

  const [kpiResult, statsResult] = await Promise.all([
    loadMarketingKpis(admin, budgetLimit),
    admin.rpc('marketing_stats', { p_silver: silverMin, p_gold: goldMin }),
  ])
  if (!kpiResult.kpi || statsResult.error || !statsResult.data) {
    console.error('[marketing-stats]', kpiResult.error ?? statsResult.error)
    return NextResponse.json({ error: 'Nie udało się wczytać statystyk.' }, { status: 500 })
  }

  const raw = statsResult.data as RawStats
  const total = kpiResult.kpi.lifecycle.total
  const pct = (value: number) => (total ? Math.round((value / total) * 100) : 0)
  const rewardRows = rewards.data ?? []
  const costSum = rewardRows.reduce((acc, row) => acc + Number(row.cost ?? 0), 0)
  const menuValuePerStar = costSum > 0 ? rewardRows.reduce((acc, row) => acc + Number(row.menu_value ?? 0), 0) / costSum : null
  const balance = Number(raw.tiers.balance)
  const counts = [raw.tiers.gold, raw.tiers.silver, raw.tiers.fan]

  const body: MarketingStats = {
    generatedAt: new Date().toISOString(),
    kpi: kpiResult.kpi,
    activity: raw.activity.map((day) => ({ ...day, revenue: Math.round(Number(day.revenue) * 100) / 100 })),
    tiers: [...tierList].reverse().map((tier, index) => ({ name: tier.name, count: counts[index] ?? 0, percent: pct(counts[index] ?? 0) })),
    stars: {
      earned: Number(raw.stars.earned),
      redeemed: Number(raw.stars.redeemed),
      redemptionRate: raw.stars.earned ? Math.round((raw.stars.redeemed / raw.stars.earned) * 100) : 0,
      balance,
      balanceValue: menuValuePerStar === null ? null : Math.round(balance * menuValuePerStar * 100) / 100,
      claimedRewards: raw.claimedRewards,
      claimedCodes: raw.claimedCodes,
    },
    topRewards: raw.topRewards,
    budget: { limit: budgetLimit, spent: kpiResult.kpi.rewardCost.value },
  }
  return NextResponse.json(body, { headers: PRIVATE_CACHE })
}
