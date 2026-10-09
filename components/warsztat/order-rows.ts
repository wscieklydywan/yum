import { resolveOrderSource, type KitchenOrder, type OrderStatus } from './order-data'

export const orderColumns = 'id, number, status, type, customer, phone, address, postcode, items, note, eta, scheduled_for, paused, handed_off, created_at, ready_at, handed_off_at, cancelled_at, cancelled_from, cancel_reason, source, discount, delivery_fee, total, payment_method'

export type DatabaseOrder = {
  id: string
  number: number | string
  status: OrderStatus
  type: KitchenOrder['type']
  customer: string
  phone: string
  address: string | null
  postcode: string | null
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
}

export function toKitchenOrder(row: DatabaseOrder): KitchenOrder {
  const createdAt = new Date(row.created_at)
  const { source, note } = resolveOrderSource(row.source, row.note)
  return {
    source,
    id: `#${row.number}`,
    databaseId: row.id,
    status: row.status,
    customer: row.customer,
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
    items: row.items ?? [],
    note,
    paused: row.paused,
    handedOff: row.handed_off,
    discount: Number(row.discount ?? 0),
    deliveryFee: Number(row.delivery_fee ?? 0),
    total: Number(row.total ?? 0),
    paymentMethod: row.payment_method ?? undefined,
  }
}
