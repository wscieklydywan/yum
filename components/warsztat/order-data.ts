import type { PackagingKind } from '@/lib/packaging'

export type OrderStatus = 'new' | 'preparing' | 'ready' | 'handed_off' | 'cancelled'
export type ActiveOrderStatus = Extract<OrderStatus, 'new' | 'preparing' | 'ready'>
export const activeStatuses: ActiveOrderStatus[] = ['new', 'preparing', 'ready']

export type Station = 'kitchen' | 'cashier'
export const stationLabels: Record<Station, string> = { kitchen: 'Kuchnia', cashier: 'Bar' }

export type OrderItem = {
  /** Stable item id assigned by the database; receipts and refunds reference items by it. */
  id?: string
  quantity: number
  /** Units already on a receipt (printed or being printed). Maintained by the server only. */
  receipted?: number
  /** Units refunded from a receipt. Maintained by the server only. */
  refunded?: number
  /** Added by the bar after the order was placed. */
  added?: boolean
  name: string
  options?: string
  station?: Station
  done?: boolean
  cancelled?: boolean
  problem?: string
  /** Gross unit price in PLN including options, set server-side when the order is created. */
  unitPrice?: number
  vat?: 'A' | 'B' | 'C' | 'D'
  /** Takeaway packaging line – billed and printed on the receipt, but never shown on station boards. */
  packaging?: PackagingKind
}

export const isPackaging = (item: OrderItem) => Boolean(item.packaging)

export type IndexedOrderItem = OrderItem & { index: number }

export type OrderAction = 'accept' | 'toggle_item' | 'report_problem' | 'resolve_problem' | 'cancel_item' | 'hand_off' | 'cancel_order' | 'restore_order' | 'undo_hand_off'

export function stationItems(order: KitchenOrder, station: Station): IndexedOrderItem[] {
  return order.items
    .map((item, index) => ({ ...item, index }))
    .filter((item) => (item.station ?? 'kitchen') === station && !item.cancelled && !item.packaging)
}

export function stationProgress(order: KitchenOrder, station: Station) {
  const items = stationItems(order, station)
  return { items, done: items.filter((item) => item.done).length, total: items.length }
}

export function orderProblems(order: KitchenOrder): IndexedOrderItem[] {
  return order.items.map((item, index) => ({ ...item, index })).filter((item) => item.problem && !item.cancelled)
}

export function pendingItems(order: KitchenOrder): IndexedOrderItem[] {
  return order.items.map((item, index) => ({ ...item, index })).filter((item) => !item.cancelled && !item.done && !item.packaging)
}

function withDerivedStatus(order: KitchenOrder): KitchenOrder {
  if (order.status !== 'preparing' && order.status !== 'ready') return order
  const active = order.items.filter((item) => !item.cancelled)
  const ready = active.length > 0 && active.every((item) => item.done)
  return { ...order, status: ready ? 'ready' : 'preparing', readyAt: ready ? order.readyAt ?? new Date().toISOString() : undefined }
}

// Mirrors public.workshop_order_action + orders_workflow trigger so the UI reacts before the realtime echo arrives.
export function applyOrderAction(order: KitchenOrder, action: OrderAction, index?: number, value?: string): KitchenOrder {
  const updateItem = (patch: (item: OrderItem) => OrderItem) => order.items.map((item, itemIndex) => itemIndex === index ? patch(item) : item)
  switch (action) {
    case 'accept': return withDerivedStatus({ ...order, status: 'preparing' })
    case 'toggle_item': return withDerivedStatus({ ...order, items: updateItem(({ problem: _problem, ...item }) => ({ ...item, done: value === 'true' })) })
    case 'report_problem': return withDerivedStatus({ ...order, items: updateItem((item) => ({ ...item, problem: value || 'Problem', done: false })) })
    case 'resolve_problem': return { ...order, items: updateItem(({ problem: _problem, ...item }) => item) }
    case 'cancel_item': return withDerivedStatus({ ...order, items: updateItem(({ problem: _problem, ...item }) => ({ ...item, cancelled: value !== 'false' })) })
    case 'hand_off': return { ...order, status: 'handed_off', handedOff: true, handedOffAt: new Date().toISOString() }
    case 'cancel_order': return { ...order, status: 'cancelled', cancelledFrom: order.status, cancelledAt: new Date().toISOString() }
    case 'restore_order': return withDerivedStatus({ ...order, status: (order.cancelledFrom ?? 'new') === 'new' ? 'new' : 'preparing', cancelledFrom: undefined, cancelledAt: undefined, cancelReason: undefined })
    case 'undo_hand_off': return withDerivedStatus({ ...order, status: 'ready', handedOff: false, handedOffAt: undefined })
  }
}

export const receiptedQuantity = (item: OrderItem) => item.receipted ?? 0
export const refundableQuantity = (item: OrderItem) => Math.max(0, (item.receipted ?? 0) - (item.refunded ?? 0))
export const hasRefundableItems = (order: KitchenOrder) => order.items.some((item) => refundableQuantity(item) > 0)
export const isBillable = (item: OrderItem) => !item.cancelled && item.unitPrice !== 0
export const hasUnbilledItems = (order: KitchenOrder) => order.items.some((item) => isBillable(item) && receiptedQuantity(item) < item.quantity)

export function formatItem(item: OrderItem) {
  return `${item.quantity}× ${item.name}`
}

export type OrderSource = 'yummy' | 'own' | 'glovo' | 'pyszne'

export const orderSources: Record<OrderSource, { label: string; tag: string; logo?: string }> = {
  yummy: { label: 'Strona Yummy', tag: '' },
  own: { label: 'Własne', tag: '[Własne]' },
  glovo: { label: 'Glovo', tag: '[Glovo]', logo: '/images/glovo.webp' },
  pyszne: { label: 'Pyszne.pl', tag: '[Pyszne.pl]', logo: '/images/pyszne.webp' },
}

export function resolveOrderSource(source: string | null | undefined, note: string | null | undefined): { source: OrderSource; note?: string } {
  if (source && source in orderSources) return { source: source as OrderSource, note: note ?? undefined }
  for (const [key, meta] of Object.entries(orderSources) as [OrderSource, (typeof orderSources)[OrderSource]][]) {
    if (meta.tag && note?.startsWith(meta.tag)) return { source: key, note: note.slice(meta.tag.length).trim() || undefined }
  }
  return { source: 'yummy', note: note ?? undefined }
}

export type OrderType = KitchenOrder['type']

/**
 * Visual language for order types, shared by the bar and the kitchen.
 * `headStartMinutes` is how much earlier an order "feels" in the kitchen queue:
 * a guest waiting at the counter jumps ahead, but a delivery that waits long enough still rises to the top.
 */
export const orderTypeMeta: Record<OrderType, { short: string; tone: 'onsite' | 'pickup' | 'delivery'; headStartMinutes: number; priority: string }> = {
  Stacjonarnie: { short: 'Na miejscu', tone: 'onsite', headStartMinutes: 10, priority: 'Gość czeka' },
  'Odbiór osobisty': { short: 'Na wynos', tone: 'pickup', headStartMinutes: 5, priority: 'Odbiór' },
  Dostawa: { short: 'Dowóz', tone: 'delivery', headStartMinutes: 0, priority: 'Kurier' },
}

/** How many minutes before a scheduled time the kitchen should start; deliveries also need courier travel time. */
export const scheduledLeadMinutes = (order: Pick<KitchenOrder, 'type'>) => order.type === 'Dostawa' ? 35 : 20

export function kitchenUrgency(order: KitchenOrder, now: number | null) {
  const scheduled = order.scheduledFor ? Date.parse(order.scheduledFor) : NaN
  // A scheduled order ranks like a fresh order exactly when its lead time starts, and sinks below everything before that.
  if (Number.isFinite(scheduled) && now !== null) return scheduledLeadMinutes(order) - (scheduled - now) / 60000
  const received = order.receivedAt ? Date.parse(order.receivedAt) : NaN
  const waited = now !== null && Number.isFinite(received) ? (now - received) / 60000 : 0
  return waited + orderTypeMeta[order.type].headStartMinutes
}

export type KitchenOrder = {
  id: string
  databaseId?: string
  status: OrderStatus
  customer: string
  phone: string
  type: 'Dostawa' | 'Odbiór osobisty' | 'Stacjonarnie'
  created: string
  receivedAt?: string
  readyAt?: string
  handedOffAt?: string
  cancelledAt?: string
  cancelledFrom?: OrderStatus
  cancelReason?: string
  eta: string
  /** ISO time the customer wants the order for; undefined means as soon as possible. */
  scheduledFor?: string
  address?: string
  postcode?: string
  items: OrderItem[]
  note?: string
  prepMinutes?: number
  readyMinutes?: number
  paused?: boolean
  handedOff?: boolean
  source?: OrderSource
  discount?: number
  deliveryFee?: number
  total?: number
  paymentMethod?: string
}

export const initialOrders: KitchenOrder[] = [
  {
    id: '#1048', status: 'new', customer: 'Kamil Nowak', phone: '+48 500 123 456', type: 'Dostawa', created: '15:24', eta: '30–40 min',
    address: 'ul. Przykładowa 12/3', postcode: '44-200 Rybnik',
    items: [{ quantity: 1, name: 'Classic Burger', options: 'Medium, bez cebuli' }, { quantity: 1, name: 'Frytki klasyczne' }, { quantity: 1, name: 'Coca-Cola 0,5 l' }],
    note: 'Proszę bez cebuli w burgerze.',
  },
  {
    id: '#1049', status: 'new', customer: 'Anna Kowalska', phone: '+48 501 222 333', type: 'Odbiór osobisty', created: '15:25', eta: 'Odbiór za 20 min',
    items: [{ quantity: 2, name: 'Cheese Burger' }, { quantity: 1, name: 'Onion Rings' }, { quantity: 1, name: 'Lemoniada' }],
  },
  {
    id: '#1051', status: 'new', customer: 'Piotr Malinowski', phone: '+48 501 444 555', type: 'Dostawa', created: '15:26', eta: '35–45 min',
    address: 'ul. Słoneczna 8', postcode: '44-200 Rybnik',
    items: [{ quantity: 1, name: 'BBQ Burger', options: 'Bez cebuli' }, { quantity: 1, name: 'Frytki belgijskie' }],
  },
  {
    id: '#1052', status: 'new', customer: 'Klient stacjonarny', phone: '', type: 'Stacjonarnie', created: '15:27', eta: 'Na miejscu',
    items: [{ quantity: 1, name: 'Cheese Burger' }, { quantity: 1, name: 'Frytki klasyczne' }],
    note: 'Zakup przy ladzie · bez danych klienta.',
  },
  {
    id: '#1046', status: 'preparing', customer: 'Piotr Zieliński', phone: '+48 501 555 666', type: 'Dostawa', created: '15:18', eta: '25–35 min', prepMinutes: 6,
    address: 'ul. Kwiatowa 4', postcode: '44-200 Rybnik',
    items: [{ quantity: 1, name: 'BBQ Burger', options: 'Bez cebuli' }, { quantity: 1, name: 'Frytki klasyczne' }],
  },
  {
    id: '#1045', status: 'preparing', customer: 'Marta Wiśniewska', phone: '+48 501 777 888', type: 'Odbiór osobisty', created: '15:17', eta: 'Odbiór za 15 min', prepMinutes: 7,
    items: [{ quantity: 1, name: 'Classic Burger', options: 'Extra bekon' }, { quantity: 1, name: 'Frytki belgijskie' }],
  },
  {
    id: '#1044', status: 'preparing', customer: 'Jakub Wójcik', phone: '+48 501 333 444', type: 'Dostawa', created: '15:16', eta: '20–30 min', prepMinutes: 8,
    address: 'ul. Rybnicka 21', postcode: '44-200 Rybnik',
    items: [{ quantity: 1, name: 'Spicy Burger' }, { quantity: 1, name: 'Onion Rings' }],
  },
  {
    id: '#1047', status: 'preparing', customer: 'Oliwia Kamińska', phone: '+48 501 111 222', type: 'Odbiór osobisty', created: '15:19', eta: 'Odbiór za 10 min', prepMinutes: 4,
    items: [{ quantity: 1, name: 'Chicken Burger' }, { quantity: 1, name: 'Frytki klasyczne' }],
  },
  {
    id: '#1043', status: 'ready', customer: 'Magda Lewandowska', phone: '+48 501 666 777', type: 'Odbiór osobisty', created: '15:12', eta: 'Gotowe', readyMinutes: 2,
    items: [{ quantity: 1, name: 'Classic Burger' }, { quantity: 1, name: 'Frytki klasyczne' }],
  },
  {
    id: '#1042', status: 'ready', customer: 'Tomasz Krawczyk', phone: '+48 501 888 999', type: 'Dostawa', created: '15:10', eta: 'Gotowe', readyMinutes: 4,
    address: 'ul. Powstańców 16', postcode: '44-200 Rybnik',
    items: [{ quantity: 1, name: 'Cheese Burger' }, { quantity: 1, name: 'Frytki belgijskie' }],
  },
]

export const statusLabels: Record<OrderStatus, string> = {
  new: 'Nowe',
  preparing: 'W przygotowaniu',
  ready: 'Gotowe',
  handed_off: 'Wydane',
  cancelled: 'Anulowane',
}

export const statusStyles: Record<OrderStatus, { accent: string; pale: string; dot: string }> = {
  new: { accent: 'text-primary', pale: 'bg-primary/10', dot: 'bg-primary' },
  preparing: { accent: 'text-amber-700', pale: 'bg-amber-500/10', dot: 'bg-amber-500' },
  ready: { accent: 'text-emerald-700', pale: 'bg-emerald-500/10', dot: 'bg-emerald-500' },
  handed_off: { accent: 'text-muted-foreground', pale: 'bg-muted', dot: 'bg-muted-foreground' },
  cancelled: { accent: 'text-muted-foreground', pale: 'bg-muted', dot: 'bg-muted-foreground' },
}
