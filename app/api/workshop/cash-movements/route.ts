import { NextResponse } from 'next/server'
import { ensureBusinessDay } from "@/lib/business-day-server"
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles } from '@/lib/workshop-auth'
import { cashReportPeriod, loadCashMovements } from '@/lib/cash-report'
import { CASH_MOVEMENT_KINDS, MAX_CASH_AMOUNT, type CashMovementKind } from '@/lib/cash-report-types'

const BAR_ROLES = ['admin', 'szef', 'kelner'] as const

/** Movements of the current cash report period, newest first. */
export async function GET() {
  const auth = await authorizeRoles(BAR_ROLES)
  if ('response' in auth) return auth.response

  const admin = createAdminClient()

  await ensureBusinessDay(admin)
  const period = await cashReportPeriod(admin)
  const movements = await loadCashMovements(admin, period.from, period.to)
  if (!movements) return NextResponse.json({ error: 'Nie udało się pobrać operacji kasowych.' }, { status: 503 })
  return NextResponse.json({ periodFrom: period.from, movements: movements.reverse() }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const auth = await authorizeRoles(BAR_ROLES)
  if ('response' in auth) return auth.response

  const body = (await request.json().catch(() => null)) as { kind?: unknown; amount?: unknown; reason?: unknown; signedBy?: unknown } | null
  const kind = body?.kind
  if (typeof kind !== 'string' || !(CASH_MOVEMENT_KINDS as readonly string[]).includes(kind)) return NextResponse.json({ error: 'Wybierz rodzaj operacji.' }, { status: 400 })

  const rawAmount = typeof body?.amount === 'string' ? Number(body.amount.replace(',', '.')) : body?.amount
  if (typeof rawAmount !== 'number' || !Number.isFinite(rawAmount) || rawAmount <= 0 || rawAmount > MAX_CASH_AMOUNT) return NextResponse.json({ error: 'Wpisz poprawną kwotę.' }, { status: 400 })
  const amount = Math.round(rawAmount * 100) / 100
  if (amount <= 0) return NextResponse.json({ error: 'Wpisz poprawną kwotę.' }, { status: 400 })

  const reason = typeof body?.reason === 'string' ? body.reason.trim().replace(/\s+/g, ' ').slice(0, 200) : ''
  if (!reason) return NextResponse.json({ error: 'Wpisz powód operacji.' }, { status: 400 })
  const signedBy = typeof body?.signedBy === 'string' ? body.signedBy.trim().replace(/\s+/g, ' ').slice(0, 60) : ''
  if (signedBy.length < 2) return NextResponse.json({ error: 'Podpisz operację swoim imieniem.' }, { status: 400 })

  const admin = createAdminClient()

  await ensureBusinessDay(admin)
  const { data, error } = await admin.from('cash_movements').insert({ kind: kind as CashMovementKind, amount, reason, signed_by: signedBy, created_by: auth.user.id }).select('id').single()
  if (error || !data) return NextResponse.json({ error: 'Nie udało się zapisać operacji.' }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}
