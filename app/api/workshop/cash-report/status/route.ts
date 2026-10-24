import { NextResponse } from 'next/server'
import { ensureBusinessDay } from "@/lib/business-day-server"
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles } from '@/lib/workshop-auth'
import { cashReportPending } from '@/lib/cash-report'

const BAR_ROLES = ['admin', 'szef', 'kelner'] as const

export async function GET() {
  const auth = await authorizeRoles(BAR_ROLES)
  if ('response' in auth) return auth.response

  const admin = createAdminClient()
  await ensureBusinessDay(admin)
  const pending = await cashReportPending(admin)
  if (pending === null) return NextResponse.json({ error: 'Nie udało się sprawdzić raportu kasowego.' }, { status: 503 })
  return NextResponse.json({ pending }, { headers: { 'Cache-Control': 'no-store' } })
}
