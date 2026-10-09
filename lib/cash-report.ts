import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CASH_METHODS, type CashMethod, type CashMethodTotals, type CashSummary, type CashUnassignedOrder } from './cash-report-types'

const round = (value: number) => Math.round(value * 100) / 100

/** Orders from delivery platforms are paid in their apps, never at the bar. */
const PLATFORM_SOURCES = new Set(['pyszne', 'ubereats', 'uber', 'glovo', 'wolt', 'bolt'])

type OrderRow = { id: string; number: number; status: string; type: string; source: string | null; total: number | string | null; discount: number | string | null; delivery_fee: number | string | null; payment_method: string | null; created_at: string }
type DocumentRow = { kind: string; status: string; total_grosze: number | null; payload: { payment?: string } | null }

const isMethod = (value: unknown): value is CashMethod => typeof value === 'string' && (CASH_METHODS as readonly string[]).includes(value)

export function resolveMethod(order: Pick<OrderRow, 'payment_method' | 'source'>): CashMethod | null {
  if (isMethod(order.payment_method)) return order.payment_method
  if (order.source && PLATFORM_SOURCES.has(order.source)) return 'online'
  return null
}

/** The reporting window: the open day, or the last closed day (incl. late orders) until the next one opens. */
export async function cashReportPeriod(admin: SupabaseClient) {
  const now = new Date().toISOString()
  const { data: settings } = await admin.from('restaurant_settings').select('day_open, day_opened_at').eq('id', 1).maybeSingle()
  if (settings?.day_open && settings.day_opened_at) return { from: settings.day_opened_at as string, to: now }
  const { data: last } = await admin.from('day_reports').select('opened_at').order('closed_at', { ascending: false }).limit(1).maybeSingle()
  if (last?.opened_at) return { from: last.opened_at as string, to: now }
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return { from: start.toISOString(), to: now }
}

export async function buildCashSummary(admin: SupabaseClient, from: string, to: string): Promise<{ summary: CashSummary; unassigned: CashUnassignedOrder[] } | null> {
  const [orders, documents] = await Promise.all([
    admin.from('orders').select('id, number, status, type, source, total, discount, delivery_fee, payment_method, created_at').gte('created_at', from).lte('created_at', to).order('created_at'),
    admin.from('order_documents').select('kind, status, total_grosze, payload').gte('created_at', from).lte('created_at', to),
  ])
  if (orders.error || documents.error) return null

  const rows = (orders.data ?? []) as OrderRow[]
  const completed = rows.filter((order) => order.status !== 'cancelled')
  const cancelled = rows.filter((order) => order.status === 'cancelled')
  const docs = ((documents.data ?? []) as DocumentRow[]).filter((doc) => doc.status !== 'voided')
  const refundDocs = docs.filter((doc) => doc.kind === 'refund')

  const totals = new Map<CashMethod, CashMethodTotals>(CASH_METHODS.map((method) => [method, { method, orders: 0, sales: 0, refunds: 0, refundsValue: 0, net: 0 }]))
  const unassigned: CashUnassignedOrder[] = []
  for (const order of completed) {
    const total = Number(order.total ?? 0)
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
      methods,
      unassignedOrders: unassigned.length,
      unassignedValue: round(unassigned.reduce((sum, order) => sum + order.total, 0)),
    },
  }
}
