import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { MANAGER_ROLES, authorizeRoles } from '@/lib/workshop-auth'
import { buildDaySummary } from '@/lib/day-report'
import type { DaySummary, MonthlyReportsResponse } from '@/lib/day-report-types'
import { isMonthId, monthIdOf, monthIdsSince, monthRange } from '@/lib/month-range'

const LIVE_TTL_MS = 3 * 60 * 1000

export async function GET(request: NextRequest) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response

  const admin = createAdminClient()
  const now = new Date()
  const current = monthIdOf(now)

  const { data: first, error: firstError } = await admin.from('orders').select('created_at').order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (firstError) return NextResponse.json({ error: 'Nie udało się pobrać raportów.' }, { status: 503 })
  const months = monthIdsSince(first?.created_at ? monthIdOf(first.created_at) : current, now)

  const requested = request.nextUrl.searchParams.get('month')
  const id = isMonthId(requested) && months.includes(requested) ? requested : months[0]
  const { from, to } = monthRange(id)
  const live = id === current

  const respond = (summary: DaySummary, businessDays: number, closedAt: string) => {
    const body: MonthlyReportsResponse = { months, report: { id, openedAt: from, closedAt, summary, live, businessDays } }
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  }

  const { data: cached } = await admin.from('monthly_reports').select('summary, business_days, computed_at').eq('month', id).maybeSingle()
  if (cached && (!live || now.getTime() - new Date(cached.computed_at).getTime() < LIVE_TTL_MS)) {
    return respond(cached.summary as DaySummary, cached.business_days, live ? cached.computed_at : to)
  }

  const until = live ? now.toISOString() : to
  const [summary, days, settings, pending] = await Promise.all([
    buildDaySummary(admin, from, until, undefined, !live),
    admin.from('day_reports').select('id', { count: 'exact', head: true }).gte('opened_at', from).lt('opened_at', to),
    admin.from('restaurant_settings').select('day_open, day_opened_at').eq('id', 1).maybeSingle(),
    admin.from('day_reports').select('id', { count: 'exact', head: true }).is('finalized_at', null).lt('opened_at', to),
  ])
  if (!summary) return NextResponse.json({ error: 'Nie udało się policzyć raportu miesięcznego.' }, { status: 503 })

  const openedAt = settings.data?.day_open ? settings.data.day_opened_at : null
  const openInMonth = Boolean(openedAt && openedAt >= from && openedAt < to)
  const businessDays = (days.count ?? 0) + (openInMonth ? 1 : 0)

  // A finished month is frozen only once no business day that started in it is still collecting orders.
  const settled = live || (!pending.error && (pending.count ?? 0) === 0 && !(openedAt && openedAt < to))
  if (settled) {
    await admin.from('monthly_reports').upsert({ month: id, summary, business_days: businessDays, computed_at: now.toISOString() })
  }

  return respond(summary, businessDays, until)
}
