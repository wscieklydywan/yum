import { NextResponse } from 'next/server'
import { ensureBusinessDay } from "@/lib/business-day-server"
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles } from '@/lib/workshop-auth'
import { buildCashSummary, cashReportPeriod, cashReportState } from '@/lib/cash-report'
import { closeBusinessDay } from '@/lib/close-business-day'
import { loadOrderPaymentState, logPaymentChange, parsePaymentChangeAuthor, PAYMENT_CHANGE_SIGNATURE_REQUIRED, receiptPaymentChange } from '@/lib/payment-change'
import { ASSIGNABLE_METHODS, MAX_CASH_AMOUNT, cashReportFromRow, expectedCashFor, type CashReportRow } from '@/lib/cash-report-types'

const BAR_ROLES = ['admin', 'szef', 'kelner'] as const
const ALREADY_SAVED = 'Raport kasowy za ten dzień został już zapisany na innym urządzeniu.'

type ReportRow = CashReportRow
const toRecord = cashReportFromRow

const parseAmount = (raw: unknown) => {
  const value = typeof raw === 'string' ? Number(raw.replace(',', '.')) : raw
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_CASH_AMOUNT) return null
  return Math.round(value * 100) / 100
}

export async function GET() {
  const auth = await authorizeRoles(BAR_ROLES)
  if ('response' in auth) return auth.response

  const admin = createAdminClient()

  await ensureBusinessDay(admin)
  const period = await cashReportPeriod(admin)
  const [result, history, state, settings] = await Promise.all([
    buildCashSummary(admin, period.from, period.to),
    admin.from('cash_reports').select('*').order('created_at', { ascending: false }).limit(20),
    cashReportState(admin),
    admin.from('restaurant_settings').select('day_open').eq('id', 1).maybeSingle(),
  ])
  if (!result || history.error || !state) return NextResponse.json({ error: 'Nie udało się przygotować raportu kasowego.' }, { status: 503 })

  return NextResponse.json(
    { periodFrom: period.from, periodTo: period.to, summary: result.summary, unassigned: result.unassigned, mismatched: result.mismatched, history: ((history.data ?? []) as ReportRow[]).map(toRecord), locked: state === 'done', dayOpen: !!settings.data?.day_open },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

/** Saves the report. The summary is always recomputed on the server so the client cannot alter the totals. */
export async function POST(request: Request) {
  const auth = await authorizeRoles(BAR_ROLES)
  if ('response' in auth) return auth.response

  const body = (await request.json().catch(() => null)) as { countedCash?: unknown; openingCash?: unknown; note?: unknown; closeDay?: unknown } | null
  const countedCash = parseAmount(body?.countedCash)
  const openingCash = parseAmount(body?.openingCash ?? 0)
  if (countedCash === null) return NextResponse.json({ error: 'Wpisz policzoną gotówkę.' }, { status: 400 })
  if (openingCash === null) return NextResponse.json({ error: 'Nieprawidłowa kwota początkowa.' }, { status: 400 })
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 500) || null : null

  const admin = createAdminClient()

  await ensureBusinessDay(admin)
  const { data: settings, error: settingsError } = await admin.from('restaurant_settings').select('day_open').eq('id', 1).maybeSingle()
  if (settingsError) return NextResponse.json({ error: 'Nie udało się sprawdzić stanu dnia.' }, { status: 503 })
  // Saving the cash report always closes an open day, so the report covers exactly that day
  // and the day no longer waits for the automatic close at midnight.
  if (settings?.day_open) {
    const closed = await closeBusinessDay(admin, auth.user.id)
    // 409 means another device closed the day a moment ago – the report still belongs to that day.
    if (!closed.ok && closed.status !== 409) return NextResponse.json({ error: closed.error }, { status: closed.status })
  } else {
    const state = await cashReportState(admin)
    if (!state) return NextResponse.json({ error: 'Nie udało się sprawdzić raportu kasowego.' }, { status: 503 })
    if (state === 'done') return NextResponse.json({ error: ALREADY_SAVED, alreadySaved: true }, { status: 409 })
  }
  const period = await cashReportPeriod(admin)
  const result = await buildCashSummary(admin, period.from, period.to)
  if (!result) return NextResponse.json({ error: 'Nie udało się przygotować raportu kasowego.' }, { status: 503 })

  const difference = Math.round((countedCash - expectedCashFor(result.summary, openingCash)) * 100) / 100
  const { data, error } = await admin.from('cash_reports').insert({
    period_from: period.from,
    period_to: period.to,
    summary: result.summary,
    opening_cash: openingCash,
    counted_cash: countedCash,
    difference,
    note,
    created_by: auth.user.id,
  }).select('*').single()
  // The unique index on period_to stops two devices saving the same closed day at the same moment.
  if (error?.code === '23505') return NextResponse.json({ error: ALREADY_SAVED, alreadySaved: true }, { status: 409 })
  if (error || !data) return NextResponse.json({ error: 'Nie udało się zapisać raportu.' }, { status: 500 })

  return NextResponse.json({ report: toRecord(data as ReportRow) })
}

/**
 * Sets how an order was paid so it lands in the right column of the report.
 * Orders with a printed receipt need the cashier's name and a reason; the change is logged.
 */
export async function PATCH(request: Request) {
  const auth = await authorizeRoles(BAR_ROLES)
  if ('response' in auth) return auth.response

  const body = (await request.json().catch(() => null)) as { orderId?: unknown; method?: unknown; changedBy?: unknown; changeReason?: unknown } | null
  const orderId = typeof body?.orderId === 'string' ? body.orderId : ''
  const method = body?.method
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ error: 'Nieprawidłowe zamówienie.' }, { status: 400 })
  if (typeof method !== 'string' || !(ASSIGNABLE_METHODS as readonly string[]).includes(method)) return NextResponse.json({ error: 'Wybierz formę płatności.' }, { status: 400 })

  const admin = createAdminClient()

  await ensureBusinessDay(admin)
  const state = await loadOrderPaymentState(admin, orderId)
  if ('error' in state) return NextResponse.json({ error: state.error }, { status: 404 })
  if (state.order.status === 'cancelled') return NextResponse.json({ error: 'Anulowanego zamówienia nie można rozliczyć.' }, { status: 409 })
  const change = receiptPaymentChange(state.order, method)
  const author = parsePaymentChangeAuthor(body)
  if (change && !author) return NextResponse.json({ error: PAYMENT_CHANGE_SIGNATURE_REQUIRED, signatureRequired: true }, { status: 422 })

  // A single method replaces any earlier split, otherwise the report would still count the old parts.
  const { error } = await admin.from('orders').update({ payment_method: method, payment_split: null }).eq('id', orderId)
  if (error) return NextResponse.json({ error: 'Nie udało się zapisać formy płatności.' }, { status: 500 })
  if (change && author) await logPaymentChange(admin, orderId, change, author, auth.user.id)
  return NextResponse.json({ ok: true })
}
