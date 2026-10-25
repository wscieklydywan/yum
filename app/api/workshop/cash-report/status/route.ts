import { NextResponse } from 'next/server'
import { ensureBusinessDay } from "@/lib/business-day-server"
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles } from '@/lib/workshop-auth'
import { dayChecklist } from '@/lib/cash-report'

const BAR_ROLES = ['admin', 'szef', 'kelner'] as const

export async function GET() {
  const auth = await authorizeRoles(BAR_ROLES)
  if ('response' in auth) return auth.response

  const admin = createAdminClient()
  await ensureBusinessDay(admin)
  const checklist = await dayChecklist(admin)
  if (!checklist) return NextResponse.json({ error: 'Nie udało się sprawdzić raportu kasowego.' }, { status: 503 })
  const pending = !checklist.dayOpen && !!checklist.closedAt && !checklist.cashReportAt
  return NextResponse.json({ pending, checklist }, { headers: { 'Cache-Control': 'no-store' } })
}
