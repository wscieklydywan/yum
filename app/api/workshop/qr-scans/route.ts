import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'
import { PRIVATE_CACHE } from '@/lib/marketing-kpis-server'

const DAY = 86_400_000

type SummaryRow = { campaign: string; total: number; month: number; week: number; ios: number; android: number; last_at: string | null }

export async function GET() {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response

  const admin = createAdminClient()
  const now = new Date()
  const month = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' }).slice(0, 7)
  const monthFrom = new Date(`${month}-01T00:00:00+01:00`).toISOString()
  const weekFrom = new Date(now.getTime() - 7 * DAY).toISOString()

  const [summary, installs] = await Promise.all([
    admin.rpc('qr_scan_summary', { p_month_from: monthFrom, p_week_from: weekFrom }),
    admin.from('app_installs').select('device_id', { count: 'exact', head: true }).eq('app', 'club'),
  ])

  if (summary.error) {
    const missing = summary.error.code === 'PGRST202' || summary.error.code === '42P01' || summary.error.code === '42883'
    if (!missing) console.error('[qr-scans]', summary.error)
    return NextResponse.json({ rows: [], total: 0, month: 0, week: 0, installs: installs.count ?? 0, available: false }, { headers: PRIVATE_CACHE })
  }

  const rows = ((summary.data ?? []) as SummaryRow[]).map((row) => ({
    campaign: row.campaign,
    total: Number(row.total),
    month: Number(row.month),
    week: Number(row.week),
    ios: Number(row.ios),
    android: Number(row.android),
    lastAt: row.last_at,
  }))
  const sum = (key: 'total' | 'month' | 'week') => rows.reduce((acc, row) => acc + row[key], 0)
  return NextResponse.json({ rows, total: sum('total'), month: sum('month'), week: sum('week'), installs: installs.count ?? 0, available: true }, { headers: PRIVATE_CACHE })
}
