import 'server-only'
import { reportRangeStart } from './day-report'
import type { SupabaseClient } from '@supabase/supabase-js'
import { parsePaymentSplit } from './payment-split'
import { CASH_METHODS, type DayChecklist, type CashMethod, type CashMethodTotals, type CashMismatchedOrder, type CashMovement, type CashSummary, type CashUnassignedOrder } from './cash-report-types'

const round = (value: number) => Math.round(value * 100) / 100

type MovementRow = { id: string; kind: CashMovement['kind']; amount: number | string; reason: string; signed_by: string; created_at: string }

export async function loadCashMovements(admin: SupabaseClient, from: string, to: string): Promise<CashMovement[] | null> {
  const { data, error } = await admin.from('cash_movements').select('id, kind, amount, reason, signed_by, created_at').gte('created_at', from).lte('created_at', to).order('created_at')
  if (error) return null
  return ((data ?? []) as MovementRow[]).map((row) => ({ id: row.id, kind: row.kind, amount: Number(row.amount), reason: row.reason, signedBy: row.signed_by, createdAt: row.created_at }))
}

/** Orders from delivery platforms are paid in their apps, never at the bar, so they get their own "Platformy" column. */
const PLATFORM_SOURCES = new Set(['pyszne', 'ubereats', 'uber', 'glovo', 'wolt', 'bolt'])
const isPlatformOrder = (order: Pick<OrderRow, 'source'>) => !!order.source && PLATFORM_SOURCES.has(order.source)

type OrderRow = { id: string; number: number; status: string; type: string; source: string | null; total: number | string | null; discount: number | string | null; delivery_fee: number | string | null; payment_method: string | null; payment_split: unknown; receipt_payment_method: string | null; created_at: string }
type DocumentRow = { kind: string; status: string; total_grosze: number | null; payload: { payment?: string } | null }

const isMethod = (value: unknown): value is CashMethod => typeof value === 'string' && (CASH_METHODS as readonly string[]).includes(value)

export function resolveMethod(order: Pick<OrderRow, 'payment_method' | 'source'>): CashMethod | null {
  if (isPlatformOrder(order)) return 'online'
  if (isMethod(order.payment_method)) return order.payment_method
  return null
}

/** The reporting window: the open day, or the last closed day (incl. late orders) until the next one opens. */
export async function cashReportPeriod(admin: SupabaseClient) {
  const now = new Date().toISOString()
  const { data: settings } = await admin.from('restaurant_settings').select('day_open, day_opened_at').eq('id', 1).maybeSingle()
  if (settings?.day_open && settings.day_opened_at) return { from: await reportRangeStart(admin, settings.day_opened_at), to: now }
  const { data: last } = await admin.from('day_reports').select('opened_at, closed_at').order('closed_at', { ascending: false }).limit(1).maybeSingle()
  if (last?.opened_at) return { from: await reportRangeStart(admin, last.opened_at), to: last.closed_at ?? now }
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return { from: start.toISOString(), to: now }
}

/**
 * Which reports the current day (or, while closed, the last closed day) already has.
 * A cash report counts for the day when its period reaches into the day – also one saved
 * during the day before anybody closed it (e.g. the day then closed itself at midnight).
 */
export async function dayChecklist(admin: SupabaseClient): Promise<DayChecklist | null> {
  const settings = await admin.from('restaurant_settings').select('day_open, day_opened_at').eq('id', 1).maybeSingle()
  if (settings.error) return null
  let openedAt: string | null = null
  let closedAt: string | null = null
  let receipts = 0
  const dayOpen = !!settings.data?.day_open && !!settings.data.day_opened_at
  if (dayOpen) openedAt = settings.data!.day_opened_at
  else {
    const last = await admin.from('day_reports').select('opened_at, closed_at, summary').order('closed_at', { ascending: false }).limit(1).maybeSingle()
    if (last.error) return null
    openedAt = last.data?.opened_at ?? null
    closedAt = last.data?.closed_at ?? null
    receipts = Number((last.data?.summary as { receipts?: number } | null)?.receipts ?? 0)
  }
  if (!openedAt) return { dayOpen, openedAt, closedAt, cashReportAt: null, cashLocked: false, fiscalReportAt: null, fiscalRequired: false }

  const [cash, fiscal] = await Promise.all([
    admin.from('cash_reports').select('created_at').gt('period_to', openedAt).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('fiscal_daily_reports').select('printed_at').gte('printed_at', openedAt).order('printed_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (cash.error || fiscal.error) return null
  const cashReportAt = cash.data?.created_at ?? null
  return {
    dayOpen,
    openedAt,
    closedAt,
    cashReportAt,
    cashLocked: !dayOpen && !!cashReportAt && !!closedAt && cashReportAt >= closedAt,
    fiscalReportAt: fiscal.data?.printed_at ?? null,
    // A day without any printed receipt has nothing to close on the till (POSNET rejects repeated zero reports).
    fiscalRequired: dayOpen || receipts > 0,
  }
}

/**
 * 'open' – the day is running; 'pending' – the closed day still needs its cash report;
 * 'reported' – a report saved during the day covers it, another one may still be saved;
 * 'done' – a report was saved after closing, so no other report is allowed until the next day opens.
 */
export async function cashReportState(admin: SupabaseClient): Promise<'open' | 'pending' | 'reported' | 'done' | null> {
  const checklist = await dayChecklist(admin)
  if (!checklist) return null
  if (checklist.dayOpen || !checklist.closedAt) return 'open'
  if (!checklist.cashReportAt) return 'pending'
  return checklist.cashLocked ? 'done' : 'reported'
}

/** After a day is closed, the cash report for it must be saved before the next day can be opened. */
export async function cashReportPending(admin: SupabaseClient): Promise<boolean | null> {
  const state = await cashReportState(admin)
  return state === null ? null : state === 'pending'
}

export async function buildCashSummary(admin: SupabaseClient, from: string, to: string): Promise<{ summary: CashSummary; unassigned: CashUnassignedOrder[]; mismatched: CashMismatchedOrder[] } | null> {
  const [orders, documents, movementRows] = await Promise.all([
    admin.from('orders').select('id, number, status, type, source, total, discount, delivery_fee, payment_method, payment_split, receipt_payment_method, created_at').gte('created_at', from).lte('created_at', to).order('created_at'),
    admin.from('order_documents').select('kind, status, total_grosze, payload').gte('created_at', from).lte('created_at', to),
    loadCashMovements(admin, from, to),
  ])
  if (orders.error || documents.error || !movementRows) return null
  const movements = movementRows

  const rows = (orders.data ?? []) as OrderRow[]
  const completed = rows.filter((order) => order.status !== 'cancelled')
  const cancelled = rows.filter((order) => order.status === 'cancelled')
  const docs = ((documents.data ?? []) as DocumentRow[]).filter((doc) => doc.status !== 'void')
  const refundDocs = docs.filter((doc) => doc.kind === 'refund')

  const totals = new Map<CashMethod, CashMethodTotals>(CASH_METHODS.map((method) => [method, { method, orders: 0, sales: 0, refunds: 0, refundsValue: 0, net: 0 }]))
  const unassigned: CashUnassignedOrder[] = []
  const mismatched: CashMismatchedOrder[] = []
  const platforms = new Map<string, { orders: number; sales: number }>()
  for (const order of completed) {
    const total = Number(order.total ?? 0)
    if (order.source && isPlatformOrder(order)) {
      const platform = platforms.get(order.source) ?? { orders: 0, sales: 0 }
      platform.orders += 1
      platform.sales += total
      platforms.set(order.source, platform)
      const entry = totals.get('online')!
      entry.orders += 1
      entry.sales += total
      continue
    }
    const split = parsePaymentSplit(order.payment_split)
    const receiptMethod = order.receipt_payment_method
    if (isMethod(receiptMethod)) {
      const paid = split ? 'split' : isMethod(order.payment_method) ? order.payment_method : null
      if (paid && paid !== receiptMethod) mismatched.push({ id: order.id, number: order.number, total: round(total), type: order.type, source: order.source ?? 'yummy', createdAt: order.created_at, receiptMethod, paymentMethod: paid })
    }
    if (split) {
      // Each part lands in its own column; the order counts once per method it was paid with.
      for (const part of split) {
        const entry = totals.get(part.method)!
        entry.orders += 1
        entry.sales += part.amount / 100
      }
      continue
    }
    const method = resolveMethod(order)
    if (!method) {
      unassigned.push({ id: order.id, number: order.number, total: round(total), type: order.type, source: order.source ?? 'yummy', createdAt: order.created_at })
      continue
    }
    const entry = totals.get(method)!
    entry.orders += 1
    entry.sales += total
  }
  for (const doc of refundDocs) {
    const method = isMethod(doc.payload?.payment) ? doc.payload.payment : 'cash'
    const entry = totals.get(method)!
    entry.refunds += 1
    entry.refundsValue += Math.abs(doc.total_grosze ?? 0) / 100
  }
  const methods = [...totals.values()].map((entry) => ({ ...entry, sales: round(entry.sales), refundsValue: round(entry.refundsValue), net: round(entry.sales - entry.refundsValue) }))

  const sales = completed.reduce((sum, order) => sum + Number(order.total ?? 0), 0)
  const refundsValue = refundDocs.reduce((sum, doc) => sum + Math.abs(doc.total_grosze ?? 0) / 100, 0)
  return {
    unassigned,
    mismatched,
    summary: {
      orders: completed.length,
      sales: round(sales),
      refunds: refundDocs.length,
      refundsValue: round(refundsValue),
      net: round(sales - refundsValue),
      discounts: round(completed.reduce((sum, order) => sum + Number(order.discount ?? 0), 0)),
      deliveryFees: round(completed.reduce((sum, order) => sum + Number(order.delivery_fee ?? 0), 0)),
      cancelledOrders: cancelled.length,
      cancelledValue: round(cancelled.reduce((sum, order) => sum + Number(order.total ?? 0), 0)),
      printedReceipts: docs.filter((doc) => doc.kind === 'receipt' && doc.status === 'printed').length,
      pendingReceipts: docs.filter((doc) => doc.kind === 'receipt' && doc.status === 'pending').length,
      methods,
      platforms: [...platforms].map(([source, value]) => ({ source, orders: value.orders, sales: round(value.sales) })).sort((a, b) => b.sales - a.sales),
      unassignedOrders: unassigned.length,
      unassignedValue: round(unassigned.reduce((sum, order) => sum + order.total, 0)),
      cashIn: round(movements.filter((entry) => entry.kind === 'deposit').reduce((sum, entry) => sum + entry.amount, 0)),
      cashOut: round(movements.filter((entry) => entry.kind === 'withdrawal').reduce((sum, entry) => sum + entry.amount, 0)),
      movements,
    },
  }
}
