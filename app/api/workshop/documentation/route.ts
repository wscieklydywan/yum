import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { MANAGER_ROLES, authorizeRoles } from '@/lib/workshop-auth'
import { cashReportFromRow, type CashReportRow } from '@/lib/cash-report-types'
import type { DaySummary } from '@/lib/day-report-types'
import type { DocumentationKind, DocumentationResponse, DocumentationUser } from '@/lib/documentation-types'

const KINDS: readonly DocumentationKind[] = ['financial', 'cash', 'users']
const DATE = /^\d{4}-\d{2}-\d{2}$/
const PAGE = 1000
const MAX_ROWS = 20000
const HIDDEN_USER_EMAILS = new Set(['wscieklydywan@gmail.com'])

function parseRange(params: URLSearchParams) {
  const from = params.get('from')
  const to = params.get('to')
  if (!from || !to || !DATE.test(from) || !DATE.test(to)) return null
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return null
  end.setDate(end.getDate() + 1)
  return { from: start.toISOString(), to: end.toISOString() }
}

export async function GET(request: NextRequest) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response

  const kind = request.nextUrl.searchParams.get('kind') as DocumentationKind | null
  if (!kind || !KINDS.includes(kind)) return NextResponse.json({ error: 'Nieznany typ dokumentu.' }, { status: 400 })

  const admin = createAdminClient()
  const headers = { 'Cache-Control': 'no-store' }

  if (kind === 'users') {
    const users: DocumentationUser[] = []
    for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
      const { data, error } = await admin
        .from('profiles')
        .select('email, full_name, role, phone, points, status_points, created_at')
        .order('created_at', { ascending: true })
        .range(offset, offset + PAGE - 1)
      if (error) return NextResponse.json({ error: 'Nie udało się pobrać bazy użytkowników.' }, { status: 503 })
      users.push(...(data ?? []).filter((row) => !HIDDEN_USER_EMAILS.has((row.email ?? '').trim().toLowerCase())).map((row) => ({
        email: row.email ?? '',
        fullName: row.full_name ?? '',
        role: row.role ?? 'klient',
        phone: row.phone ?? '',
        points: row.points ?? 0,
        statusPoints: row.status_points ?? 0,
        createdAt: row.created_at,
      })))
      if (!data || data.length < PAGE) break
    }
    const body: DocumentationResponse = { kind, users }
    return NextResponse.json(body, { headers })
  }

  const range = parseRange(request.nextUrl.searchParams)
  if (!range) return NextResponse.json({ error: 'Wybierz poprawny zakres dat.' }, { status: 400 })

  if (kind === 'financial') {
    const { data, error } = await admin
      .from('day_reports')
      .select('id, opened_at, closed_at, summary')
      .gte('opened_at', range.from)
      .lt('opened_at', range.to)
      .order('opened_at', { ascending: true })
      .limit(MAX_ROWS)
    if (error) return NextResponse.json({ error: 'Nie udało się pobrać raportów finansowych.' }, { status: 503 })
    const body: DocumentationResponse = {
      kind,
      days: (data ?? []).map((row) => ({ id: row.id, openedAt: row.opened_at, closedAt: row.closed_at, summary: row.summary as DaySummary })),
    }
    return NextResponse.json(body, { headers })
  }

  const { data, error } = await admin
    .from('cash_reports')
    .select('*')
    .gte('created_at', range.from)
    .lt('created_at', range.to)
    .order('created_at', { ascending: true })
    .limit(MAX_ROWS)
  if (error) return NextResponse.json({ error: 'Nie udało się pobrać raportów kasowych.' }, { status: 503 })
  const body: DocumentationResponse = { kind, cashReports: ((data ?? []) as CashReportRow[]).map(cashReportFromRow) }
  return NextResponse.json(body, { headers })
}
