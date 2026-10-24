import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DaySummary, VatBreakdown } from './day-report-types'
import type { OrderItem } from '@/components/warsztat/order-data'
import { allocateByVat, productVatWeights, serviceVatWeights } from './fiscal-receipt'
import { FOOD_VAT, isVatLetter, VAT_RATES, type VatLetter } from './vat'

type RowItem = { quantity?: number; name?: string; unitPrice?: number; cancelled?: boolean; refunded?: number; vat?: string; packaging?: OrderItem['packaging'] }

type OrderRow = {
  id: string
  status: string
  type: string
  source: string | null
  items: RowItem[] | null
  discount: number | string | null
  delivery_fee: number | string | null
  total: number | string | null
  created_at: string
}

export type VatOrderRow = Pick<OrderRow, 'status' | 'items' | 'discount' | 'delivery_fee' | 'created_at'>

const round = (value: number) => Math.round(value * 100) / 100
const grosze = (value: unknown) => {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? Math.round(number * 100) : 0
}

/** Gross per VAT letter for one order, mirroring the receipt rules (packaging/delivery follow the products, discount split proportionally). */
function orderVatWeights(order: VatOrderRow) {
  const items = (order.items ?? [])
    .filter((item) => !item.cancelled)
    .map((item) => ({
      ...item,
      quantity: Math.max(0, Number(item.quantity ?? 0) - Number(item.refunded ?? 0)),
      // Unverified products are prepared food in practice; the report estimates them at the food rate.
      vat: isVatLetter(item.vat) ? item.vat : item.packaging ? undefined : FOOD_VAT,
    })) as OrderItem[]
  const weights = productVatWeights(items)
  const groups = new Map<VatLetter, number>(weights)
  const add = (parts: [VatLetter, number][]) => { for (const [vat, part] of parts) groups.set(vat, (groups.get(vat) ?? 0) + part) }
  for (const item of items) {
    if (!item.packaging || item.quantity <= 0) continue
    add(allocateByVat(grosze(item.unitPrice) * item.quantity, serviceVatWeights(weights, item.packaging)))
  }
  const delivery = grosze(order.delivery_fee)
  if (delivery > 0) add(allocateByVat(delivery, serviceVatWeights(weights)))
  const entries = [...groups].filter(([, value]) => value > 0).sort(([a], [b]) => a.localeCompare(b))
  const gross = entries.reduce((sum, [, value]) => sum + value, 0)
  const discount = Math.min(Math.max(grosze(order.discount), 0), gross)
  if (discount > 0) for (const [vat, share] of allocateByVat(discount, entries)) groups.set(vat, (groups.get(vat) ?? 0) - share)
  return groups
}

/** Splits the day's gross (after refunds) across VAT rates in proportion to what was sold, so netto + VAT always equals brutto. */
export function buildVatSummary(orders: VatOrderRow[], gross: number): Pick<DaySummary, 'vat' | 'tax' | 'net'> {
  const totals = new Map<VatLetter, number>()
  for (const order of orders) {
    if (order.status === 'cancelled') continue
    for (const [vat, value] of orderVatWeights(order)) totals.set(vat, (totals.get(vat) ?? 0) + value)
  }
  const weights = [...totals].filter(([, value]) => value > 0).sort(([a], [b]) => a.localeCompare(b))
  const target = grosze(gross)
  const vat: VatBreakdown[] = (weights.length && target > 0 ? allocateByVat(target, weights) : []).map(([letter, part]) => {
    const rate = VAT_RATES[letter]
    const tax = Math.round((part * rate) / (100 + rate))
    return { vat: letter, rate, gross: part / 100, tax: tax / 100, net: (part - tax) / 100 }
  })
  const tax = vat.reduce((sum, group) => sum + group.tax, 0)
  return { vat, tax: round(tax), net: round(gross - tax) }
}

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

/**
 * A day's report covers everything since the previous day was closed, so orders that came in
 * while the restaurant was closed (and were accepted after opening) land in the day they were handled.
 */
export async function reportRangeStart(admin: SupabaseClient, openedAt: string) {
  const { data } = await admin.from('day_reports').select('closed_at').lt('closed_at', openedAt).order('closed_at', { ascending: false }).limit(1).maybeSingle()
  return data?.closed_at ? new Date(new Date(data.closed_at).getTime() + 1).toISOString() : openedAt
}

/** Rebuilds the frozen summary of the finalized day that contained the given moment (e.g. after deleting one of its orders). */
export async function recomputeFinalizedReport(admin: SupabaseClient, at: string) {
  const { data: report, error } = await admin
    .from('day_reports')
    .select('id, opened_at, closed_at, finalized_at')
    .not('finalized_at', 'is', null)
    .lte('opened_at', at)
    .gte('finalized_at', at)
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return false
  if (!report) return true
  const summary = await buildDaySummary(admin, report.opened_at, report.finalized_at, report.closed_at)
  if (!summary) return false
  const { error: updateError } = await admin.from('day_reports').update({ summary }).eq('id', report.id)
  return !updateError
}

export async function buildDaySummary(admin: SupabaseClient, from: string, to: string, closedAt?: string): Promise<DaySummary | null> {
  const [orders, documents] = await Promise.all([
    admin.from('orders').select('id, status, type, source, items, discount, delivery_fee, total, created_at').gte('created_at', from).lte('created_at', to),
    admin.from('order_documents').select('order_id, kind, status, total_grosze, created_at').gte('created_at', from).lte('created_at', to),
  ])
  if (orders.error || documents.error) return null

  const rows = (orders.data ?? []) as OrderRow[]
  const completed = rows.filter((order) => order.status !== 'cancelled')
  const cancelled = rows.filter((order) => order.status === 'cancelled')
  const closedTime = closedAt ? Date.parse(closedAt) : Infinity
  const late = completed.filter((order) => Date.parse(order.created_at) > closedTime)

  const revenue = completed.reduce((sum, order) => sum + Number(order.total ?? 0), 0)
  const docs = (documents.data ?? []) as { order_id: string; kind: string; status: string; total_grosze: number | null; created_at: string }[]
  const validDocs = docs.filter((doc) => doc.status !== 'void')
  const refunds = validDocs.filter((doc) => doc.kind === 'refund')
  const latestPrintedReceipt = new Map<string, (typeof docs)[number]>()
  for (const doc of docs) {
    if (doc.kind !== 'receipt' || doc.status !== 'printed') continue
    const current = latestPrintedReceipt.get(doc.order_id)
    if (!current || doc.created_at > current.created_at) latestPrintedReceipt.set(doc.order_id, doc)
  }
  const receipts = [...latestPrintedReceipt.values()]
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

  const PLATFORM_CHANNELS: Record<string, string> = { glovo: 'Glovo', pyszne: 'Pyszne.pl' }
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

  const productList = [...products].map(([name, value]) => ({ name, quantity: value.quantity, revenue: round(value.revenue) }))

  return {
    ...buildVatSummary(completed, round(revenue - refundsValue)),
    topProductsByRevenue: [...productList].sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity).slice(0, 10),
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
    topProducts: [...productList].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue).slice(0, 10),
    byType: group((order) => order.type),
    bySource: group((order) => order.source ?? 'yummy'),
    byChannel: group((order) => PLATFORM_CHANNELS[order.source ?? ''] ?? order.type),
    byHour: [...hours].map(([hour, count]) => ({ hour, orders: count })).sort((a, b) => a.hour - b.hour),
    openOrders: completed.filter((order) => OPEN_STATUSES.has(order.status)).length,
    lateOrders: late.length,
    lateRevenue: round(late.reduce((sum, order) => sum + Number(order.total ?? 0), 0)),
  }
}
