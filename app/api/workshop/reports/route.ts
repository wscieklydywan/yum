import { NextResponse } from 'next/server'
import { ensureBusinessDay } from "@/lib/business-day-server"
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'
import { MANAGER_ROLES, authorizeRoles } from '@/lib/workshop-auth'
import { buildDaySummary, buildVatSummary, type VatOrderRow } from '@/lib/day-report'
import type { DayReport, DaySummary } from '@/lib/day-report-types'

const PAGE = 1000

async function fetchVatOrders(admin: SupabaseClient, from: string, to: string) {
  const rows: VatOrderRow[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin.from('orders').select('status, items, discount, delivery_fee, created_at').gte('created_at', from).lte('created_at', to).order('created_at').range(offset, offset + PAGE - 1)
    if (error) return null
    rows.push(...((data ?? []) as VatOrderRow[]))
    if (!data || data.length < PAGE) return rows
  }
}

export async function GET() {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response

  const admin = createAdminClient()

  await ensureBusinessDay(admin)
  const [{ data: settings }, { data: rows, error }] = await Promise.all([
    admin.from('restaurant_settings').select('day_open, day_opened_at').eq('id', 1).maybeSingle(),
    admin.from('day_reports').select('id, opened_at, closed_at, finalized_at, summary').order('closed_at', { ascending: false }).limit(60),
  ])
  if (error) return NextResponse.json({ error: 'Nie udało się pobrać raportów.' }, { status: 503 })

  const now = new Date().toISOString()
  const reports: DayReport[] = (rows ?? []).map((row) => ({ id: row.id, openedAt: row.opened_at, closedAt: row.closed_at, summary: row.summary as DaySummary }))
  const latest = rows?.[0]
  if (latest && !latest.finalized_at && !settings?.day_open) {
    const summary = await buildDaySummary(admin, latest.opened_at, now, latest.closed_at)
    if (summary) reports[0] = { ...reports[0], summary, pending: true }
  }

  // Reports saved before VAT reporting get their VAT split computed on read from the same orders.
  const missing = (rows ?? []).map((row, index) => ({ row, index })).filter(({ index }) => !reports[index].summary.vat)
  if (missing.length) {
    const from = missing.reduce((min, { row }) => (row.opened_at < min ? row.opened_at : min), missing[0].row.opened_at)
    const orders = await fetchVatOrders(admin, from, now)
    if (orders) for (const { row, index } of missing) {
      const until = row.finalized_at ?? now
      const dayOrders = orders.filter((order) => order.created_at >= row.opened_at && order.created_at <= until)
      reports[index] = { ...reports[index], summary: { ...reports[index].summary, ...buildVatSummary(dayOrders, reports[index].summary.netRevenue) } }
    }
  }

  let live: DayReport | null = null
  if (settings?.day_open && settings.day_opened_at) {
    const summary = await buildDaySummary(admin, settings.day_opened_at, now)
    if (summary) live = { id: 'live', openedAt: settings.day_opened_at, closedAt: now, summary, live: true }
  }
  return NextResponse.json({ live, reports }, { headers: { 'Cache-Control': 'no-store' } })
}
