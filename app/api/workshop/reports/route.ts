import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { MANAGER_ROLES, authorizeRoles } from '@/lib/workshop-auth'
import { buildDaySummary } from '@/lib/day-report'
import type { DayReport, DaySummary } from '@/lib/day-report-types'

export async function GET() {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response

  const admin = createAdminClient()
  const [{ data: settings }, { data: rows, error }] = await Promise.all([
    admin.from('restaurant_settings').select('day_open, day_opened_at').eq('id', 1).maybeSingle(),
    admin.from('day_reports').select('id, opened_at, closed_at, finalized_at, summary').order('closed_at', { ascending: false }).limit(60),
  ])
  if (error) return NextResponse.json({ error: 'Nie udało się pobrać raportów.' }, { status: 503 })

  const reports: DayReport[] = (rows ?? []).map((row) => ({ id: row.id, openedAt: row.opened_at, closedAt: row.closed_at, summary: row.summary as DaySummary }))
  const latest = rows?.[0]
  if (latest && !latest.finalized_at && !settings?.day_open) {
    const summary = await buildDaySummary(admin, latest.opened_at, new Date().toISOString(), latest.closed_at)
    if (summary) reports[0] = { ...reports[0], summary, pending: true }
  }
  let live: DayReport | null = null
  if (settings?.day_open && settings.day_opened_at) {
    const now = new Date().toISOString()
    const summary = await buildDaySummary(admin, settings.day_opened_at, now)
    if (summary) live = { id: 'live', openedAt: settings.day_opened_at, closedAt: now, summary, live: true }
  }
  return NextResponse.json({ live, reports }, { headers: { 'Cache-Control': 'no-store' } })
}
