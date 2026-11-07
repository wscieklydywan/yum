import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'
import { TIER_SETTINGS_COLUMNS, tierSettingsFromRow } from '@/lib/club-tiers-server'
import { buildTiers } from '@/lib/loyalty'
import { describeStarRate } from '@/lib/loyalty-rate'
import { HOME_SLIDE_IDS } from '@/lib/home-slides'
import { loadMarketingKpis, PRIVATE_CACHE } from '@/lib/marketing-kpis-server'
import type { DashboardAlert, MarketingDashboard, ScheduleItem } from '@/lib/marketing-dashboard'

const DAY = 86_400_000
const warsawDay = (value: Date | string) => new Date(value).toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' })
const shortDate = (value: string) => new Date(value).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Warsaw' })

export async function GET() {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response

  const admin = createAdminClient()
  const now = new Date()
  const today = warsawDay(now)
  const soon = new Date(now.getTime() + 14 * DAY).toISOString()

  // Config tables only (a handful of rows each); every heavy aggregate lives in the marketing_kpis SQL function.
  const [settings, promotions, codes, prizes, rewards, halloween, advent, slides, recovery] = await Promise.all([
    admin.from('restaurant_settings').select(`loyalty_points, loyalty_spend, wheel_enabled, wheel_monthly_budget, ${TIER_SETTINGS_COLUMNS}`).eq('id', 1).single(),
    admin.from('promotions').select('id, title, active, valid_from, valid_to, discount_percent').eq('active', true),
    admin.from('promo_codes').select('id, code, active, expires_at, max_uses, uses_count').eq('active', true),
    admin.from('wheel_prizes').select('id', { count: 'exact', head: true }).eq('active', true),
    admin.from('loyalty_rewards').select('id', { count: 'exact', head: true }).eq('active', true),
    admin.from('halloween_settings').select('starts_at, ends_at').eq('id', 1).maybeSingle(),
    admin.from('advent_settings').select('mode, starts_on, days').eq('id', 1).maybeSingle(),
    admin.from('home_slides_settings').select('hidden_slides, burger_week_enabled, burger_week_until').eq('id', 1).maybeSingle(),
    admin.from('points_recovery_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  const s = settings.data as Record<string, unknown> | null
  const budgetLimit = !s || s.wheel_monthly_budget === null ? null : Number(s.wheel_monthly_budget)
  const { kpi, error: kpiError } = await loadMarketingKpis(admin, budgetLimit)

  const failed = [settings, promotions, codes].find((result) => result.error)?.error ?? kpiError
  if (failed || !s || !kpi) {
    console.error('[marketing-dashboard]', failed)
    return NextResponse.json({ error: 'Nie udało się wczytać pulpitu marketingu.' }, { status: 500 })
  }

  const promoRows = promotions.data ?? []
  const runningPromos = promoRows.filter((p) => (!p.valid_from || p.valid_from <= today) && (!p.valid_to || p.valid_to >= today))
  const liveCodes = (codes.data ?? []).filter((c) => (!c.expires_at || c.expires_at > now.toISOString()) && (!c.max_uses || c.uses_count < c.max_uses))
  const hw = halloween.data
  const nowIso = now.toISOString()
  const halloweenState = !hw ? 'ended' : nowIso < hw.starts_at ? 'upcoming' : nowIso <= hw.ends_at ? 'live' : 'ended'
  const hidden: string[] = slides.data?.hidden_slides ?? []
  const monthCost = kpi.rewardCost.value
  const { lifecycle } = kpi
  const recoveryCount = recovery.count ?? 0

  const alerts: DashboardAlert[] = []
  if (recoveryCount > 0) alerts.push({ id: 'recovery', tone: 'danger', title: 'Prośby o stare punkty', detail: `${recoveryCount} ${recoveryCount === 1 ? 'czeka' : 'czekają'} na decyzję`, target: 'club-recovery' })
  if (budgetLimit !== null && budgetLimit > 0 && monthCost >= budgetLimit * 0.8) alerts.push({ id: 'budget', tone: monthCost >= budgetLimit ? 'danger' : 'warning', title: monthCost >= budgetLimit ? 'Budżet koła wyczerpany' : 'Budżet koła na wyczerpaniu', detail: `${Math.round((monthCost / budgetLimit) * 100)}% miesięcznego limitu`, target: 'overview-budget' })
  if (lifecycle.atRisk >= Math.max(5, lifecycle.total * 0.1)) alerts.push({ id: 'at-risk', tone: 'warning', title: `${lifecycle.atRisk} klientów przestało wracać`, detail: 'Brak aktywności od 30–90 dni — rozważ kod powrotny', target: 'codes' })
  if (hw && halloweenState === 'live' && new Date(hw.ends_at).getTime() - now.getTime() < 7 * DAY) alerts.push({ id: 'halloween', tone: 'warning', title: 'Kończy się gra Halloween', detail: `Do ${shortDate(hw.ends_at)} — sprawdź zwycięzców`, target: 'halloween' })
  if (slides.data?.burger_week_enabled && slides.data.burger_week_until && slides.data.burger_week_until < today) alerts.push({ id: 'burger', tone: 'warning', title: 'Burger tygodnia wygasł', detail: 'Ustaw nowy burger lub wyłącz slajd', target: 'home-slides' })
  if (runningPromos.length === 0 && liveCodes.length === 0) alerts.push({ id: 'no-promos', tone: 'info', title: 'Brak aktywnych promocji', detail: 'Klienci nie widzą teraz żadnej oferty', target: 'promotions' })
  if (!s.wheel_enabled) alerts.push({ id: 'wheel', tone: 'info', title: 'Koło fortuny wyłączone', detail: 'Klienci nie mogą teraz kręcić', target: 'wheel' })
  if (advent.data?.mode !== 'live' && advent.data?.starts_on && new Date(advent.data.starts_on) > now && new Date(advent.data.starts_on).getTime() - now.getTime() < 21 * DAY) alerts.push({ id: 'advent', tone: 'info', title: 'Zbliża się kalendarz adwentowy', detail: `Start ${shortDate(advent.data.starts_on)} — uzupełnij dni`, target: 'advent' })

  const schedule: ScheduleItem[] = []
  for (const p of promoRows) {
    if (p.valid_from && p.valid_from > today) schedule.push({ id: `p-start-${p.id}`, date: p.valid_from, kind: 'promo', title: p.title, detail: 'Start promocji', target: 'promotions' })
    if (p.valid_to && p.valid_to >= today) schedule.push({ id: `p-end-${p.id}`, date: p.valid_to, kind: 'promo', title: p.title, detail: 'Koniec promocji', target: 'promotions' })
  }
  for (const c of liveCodes) if (c.expires_at && c.expires_at < soon) schedule.push({ id: `c-${c.id}`, date: c.expires_at, kind: 'code', title: c.code, detail: 'Kod wygasa', target: 'codes' })
  if (hw && halloweenState === 'upcoming') schedule.push({ id: 'hw-start', date: hw.starts_at, kind: 'event', title: 'Halloween', detail: 'Start gry', target: 'halloween' })
  if (hw && halloweenState === 'live') schedule.push({ id: 'hw-end', date: hw.ends_at, kind: 'event', title: 'Halloween', detail: 'Koniec gry', target: 'halloween' })
  if (advent.data && advent.data.mode !== 'off' && advent.data.starts_on >= today) schedule.push({ id: 'advent', date: advent.data.starts_on, kind: 'event', title: 'Kalendarz adwentowy', detail: `Start · ${advent.data.days} dni`, target: 'advent' })
  if (slides.data?.burger_week_enabled && slides.data.burger_week_until && slides.data.burger_week_until >= today) schedule.push({ id: 'burger', date: slides.data.burger_week_until, kind: 'content', title: 'Burger tygodnia', detail: 'Koniec wyróżnienia', target: 'home-slides' })
  schedule.sort((a, b) => a.date.localeCompare(b.date))

  const body: MarketingDashboard = {
    generatedAt: nowIso,
    kpi,
    programs: {
      club: { rate: describeStarRate({ points: Number(s.loyalty_points ?? 1), spend: Number(s.loyalty_spend ?? 10) }), tiers: buildTiers(tierSettingsFromRow(s)).length, rewards: rewards.count ?? 0, members: lifecycle.total },
      customers: { total: lifecycle.total, newMembers: kpi.activeCustomers.newMembers, pendingRecovery: recoveryCount },
      promos: { active: runningPromos.length, codes: liveCodes.length, maxDiscount: Math.max(0, ...runningPromos.map((p) => Number(p.discount_percent ?? 0))) },
      games: { wheelEnabled: Boolean(s.wheel_enabled), wheelPrizes: prizes.count ?? 0, halloween: halloweenState, halloweenEnds: hw?.ends_at ?? '', advent: advent.data?.mode ?? 'off', adventStarts: advent.data?.starts_on ?? '' },
      content: { visibleSlides: HOME_SLIDE_IDS.filter((id) => !hidden.includes(id)).length, totalSlides: HOME_SLIDE_IDS.length, burgerWeek: Boolean(slides.data?.burger_week_enabled), burgerWeekUntil: slides.data?.burger_week_until ?? null },
    },
    budget: { limit: budgetLimit, spent: monthCost },
    alerts,
    schedule: schedule.slice(0, 5),
  }
  return NextResponse.json(body, { headers: PRIVATE_CACHE })
}
