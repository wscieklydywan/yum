import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { MANAGER_ROLES, authorizeRoles } from '@/lib/workshop-auth'
import { cashReportFromRow, type CashReportRow, type FiscalDailyReportRecord } from '@/lib/cash-report-types'

export async function GET() {
  const auth = await authorizeRoles([...MANAGER_ROLES, 'kelner'])
  if ('response' in auth) return auth.response

  const admin = createAdminClient()
  const [cash, fiscal] = await Promise.all([
    admin.from('cash_reports').select('*').order('created_at', { ascending: false }).limit(90),
    admin.from('fiscal_daily_reports').select('id, printed_at, source, note').order('printed_at', { ascending: false }).limit(90),
  ])
  if (cash.error || fiscal.error) return NextResponse.json({ error: 'Nie udało się pobrać raportów kasowych.' }, { status: 503 })

  const fiscalReports: FiscalDailyReportRecord[] = (fiscal.data ?? []).map((row) => ({ id: row.id, printedAt: row.printed_at, source: row.source, note: row.note }))
  return NextResponse.json(
    { reports: ((cash.data ?? []) as CashReportRow[]).map(cashReportFromRow), fiscal: fiscalReports },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
