import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DaySummary } from './day-report-types'

type OrderRow = {
  id: string
  status: string
  type: string
  source: string | null
  items: { quantity?: number; name?: string; unitPrice?: number; cancelled?: boolean; refunded?: number }[] | null
  discount: number | string | null
  delivery_fee: number | string | null
  total: number | string | null
  created_at: string
}

const round = (value: number) => Math.round(value * 100) / 100

const OPEN_STATUSES = new Set(['new', 'preparing', 'ready'])

/**
 * A closed day keeps collecting orders until the next day is opened, so orders
 * finished after closing or added manually afterwards land in that day's report.
 */
export async function finalizePendingReport(admin: SupabaseClient, until: string) {
  const { data: pending, error } = await admin.from('day_reports').select('id, opened_at, closed_at').is('finalized_at', null).order('closed_at', { ascending: false }).limit(1).maybeSingle()
  if (error) return false
  if (!pending) return true
  const summary = await buildDaySummary(admin, pending.opened_at, until, pending.closed_at)
  if (!summary) return false
  const { error: updateError } = await admin.from('day_reports').update({ summary, finalized_at: until }).eq('id', pending.id)
  if (updateError) return false
  await admin.from('day_reports').update({ finalized_at: until }).is('finalized_at', null).neq('id', pending.id)
  return true
}

export async function buildDaySummary(admin: SupabaseClient, from: string, to: string, closedAt?: string): Promise<DaySummary | null> {
  const [orders, documents] = await Promise.all([
    admin.from('orders').select('id, status, type, source, items, discount, delivery_fee, total, created_at').gte('created_at', from).lte('created_at', to),
    admin.from('order_documents').select('kind, status, total_grosze').gte('created_at', from).lte('created_at', to),
  ])
  if (orders.error || documents.error) return null

  const rows = (orders.data ?? []) as OrderRow[]
  const completed = rows.filter((order) => order.status !== 'cancelled')
  const cancelled = rows.filter((order) => order.status === 'cancelled')
  const closedTime = closedAt ? Date.parse(closedAt) : Infinity
  const late = completed.filter((order) => Date.parse(order.created_at) > closedTime)

  const revenue = completed.reduce((sum, order) => sum + Number(order.total ?? 0), 0)
  const docs = (documents.data ?? []) as { kind: string; status: string; total_grosze: number | null }[]
  const validDocs = docs.filter((doc) => doc.status !== 'voided')
  const refunds = validDocs.filter((doc) => doc.kind === 'refund')
  const receipts = validDocs.filter((doc) => doc.kind === 'receipt')
  const refundsValue = refunds.reduce((sum, doc) => sum + Math.abs(doc.total_grosze ?? 0), 0) / 100

  const products = new Map<string, { quantity: number; revenue: number }>()
  for (const order of completed) {
    for (const item of order.items ?? []) {
      if (item.cancelled || !item.name) continue
      const quantity = Math.max(0, Number(item.quantity ?? 0) - Number(item.refunded ?? 0))
      if (!quantity) continue
      const entry = products.get(item.name) ?? { quantity: 0, revenue: 0 }
      entry.quantity += quantity
      entry.revenue += quantity * Number(item.unitPrice ?? 0)
      products.set(item.name, entry)
    }
  }

  const group = (key: (order: OrderRow) => string) => {
    const map = new Map<string, { orders: number; revenue: number }>()
    for (const order of completed) {
      const name = key(order)
      const entry = map.get(name) ?? { orders: 0, revenue: 0 }
      entry.orders += 1
      entry.revenue += Number(order.total ?? 0)
      map.set(name, entry)
    }
    return [...map].map(([name, value]) => ({ name, orders: value.orders, revenue: round(value.revenue) })).sort((a, b) => b.revenue - a.revenue)
  }

  const hourFormat = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Warsaw' })
  const hours = new Map<number, number>()
  for (const order of completed) {
    const hour = Number(hourFormat.format(new Date(order.created_at)))
    hours.set(hour, (hours.get(hour) ?? 0) + 1)
  }

  return {
    orders: completed.length,
    handedOff: completed.filter((order) => order.status === 'handed_off').length,
    cancelledOrders: cancelled.length,
    cancelledValue: round(cancelled.reduce((sum, order) => sum + Number(order.total ?? 0), 0)),
    revenue: round(revenue),
    refunds: refunds.length,
    refundsValue: round(refundsValue),
    netRevenue: round(revenue - refundsValue),
    averageOrder: completed.length ? round(revenue / completed.length) : 0,
    discounts: round(completed.reduce((sum, order) => sum + Number(order.discount ?? 0), 0)),
    deliveryFees: round(completed.reduce((sum, order) => sum + Number(order.delivery_fee ?? 0), 0)),
    receipts: receipts.length,
    receiptsValue: round(receipts.reduce((sum, doc) => sum + (doc.total_grosze ?? 0), 0) / 100),
    topProducts: [...products].map(([name, value]) => ({ name, quantity: value.quantity, revenue: round(value.revenue) })).sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue).slice(0, 10),
    byType: group((order) => order.type),
    bySource: group((order) => order.source ?? 'yummy'),
    byHour: [...hours].map(([hour, count]) => ({ hour, orders: count })).sort((a, b) => a.hour - b.hour),
    openOrders: completed.filter((order) => OPEN_STATUSES.has(order.status)).length,
    lateOrders: late.length,
    lateRevenue: round(late.reduce((sum, order) => sum + Number(order.total ?? 0), 0)),
  }
}
