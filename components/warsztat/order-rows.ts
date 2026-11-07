import { parsePaymentSplit } from '@/lib/payment-split'
import { displayCustomerName, resolveOrderSource, type KitchenOrder, type OrderStatus } from './order-data'

export const orderColumns = 'id, number, status, type, customer, phone, address, postcode, distance_km, items, note, eta, scheduled_for, paused, handed_off, created_at, ready_at, handed_off_at, cancelled_at, cancelled_from, cancel_reason, source, discount, delivery_fee, total, payment_method, paid_at, receipt_payment_method, cash_received_grosze, payment_split, buyer_nip, pending_receipt_id, pending_receipt_at, preferred_payment'

export type DatabaseOrder = {
  id: string
  number: number | string
  status: OrderStatus
  type: KitchenOrder['type']
  customer: string
  phone: string
  address: string | null
  postcode: string | null
  distance_km?: number | string | null
  items: KitchenOrder['items']
  note: string | null
  eta: string
  scheduled_for?: string | null
  paused: boolean
  handed_off: boolean
  created_at: string
  ready_at: string | null
  handed_off_at: string | null
  cancelled_at?: string | null
  cancelled_from?: OrderStatus | null
  cancel_reason?: string | null
  source?: string | null
  discount: number | string | null
  delivery_fee: number | string | null
  total: number | string | null
  payment_method?: string | null
  paid_at?: string | null
  receipt_payment_method?: string | null
  cash_received_grosze?: number | null
  payment_split?: unknown
  buyer_nip?: string | null
  pending_receipt_id?: string | null
  pending_receipt_at?: string | null
  preferred_payment?: string | null
}

export function toKitchenOrder(row: DatabaseOrder): KitchenOrder {
  const createdAt = new Date(row.created_at)
  const { source, note } = resolveOrderSource(row.source, row.note)
  return {
    source,
    id: `#${row.number}`,
    databaseId: row.id,
    status: row.status,
    customer: displayCustomerName(row.customer),
    phone: row.phone,
    type: row.type,
    created: createdAt.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' }),
    receivedAt: row.created_at,
    readyAt: row.ready_at ?? undefined,
    handedOffAt: row.handed_off_at ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    cancelledFrom: row.cancelled_from ?? undefined,
    cancelReason: row.cancel_reason ?? undefined,
    eta: row.eta,
    scheduledFor: row.scheduled_for ?? undefined,
    address: row.address ?? undefined,
    postcode: row.postcode ?? undefined,
    distanceKm: row.distance_km == null ? undefined : Number(row.distance_km),
    items: row.items ?? [],
    note,
    paused: row.paused,
    handedOff: row.handed_off,
    discount: Number(row.discount ?? 0),
    deliveryFee: Number(row.delivery_fee ?? 0),
    total: Number(row.total ?? 0),
    paymentMethod: row.payment_method ?? undefined,
    paidAt: row.paid_at ?? undefined,
    receiptPaymentMethod: row.receipt_payment_method ?? undefined,
    cashReceived: row.cash_received_grosze ?? undefined,
    paymentSplit: parsePaymentSplit(row.payment_split) ?? undefined,
    buyerNip: row.buyer_nip ?? undefined,
    pendingReceiptId: row.pending_receipt_id ?? undefined,
    pendingReceiptAt: row.pending_receipt_at ?? undefined,
    preferredPayment: row.preferred_payment === 'cash' || row.preferred_payment === 'card' ? row.preferred_payment : undefined,
  }
}
