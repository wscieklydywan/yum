export type OrderStatus = 'new' | 'preparing' | 'ready'

export type KitchenOrder = {
  id: string
  status: OrderStatus
  customer: string
  phone: string
  type: 'Dostawa' | 'Odbiór osobisty' | 'Stacjonarnie'
  created: string
  eta: string
  address?: string
  postcode?: string
  items: { quantity: number; name: string; options?: string }[]
  note?: string
  prepMinutes?: number
  readyMinutes?: number
  paused?: boolean
  handedOff?: boolean
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
}

export const statusStyles: Record<OrderStatus, { accent: string; pale: string; dot: string }> = {
  new: { accent: 'text-primary', pale: 'bg-primary/10', dot: 'bg-primary' },
  preparing: { accent: 'text-amber-700', pale: 'bg-amber-500/10', dot: 'bg-amber-500' },
  ready: { accent: 'text-emerald-700', pale: 'bg-emerald-500/10', dot: 'bg-emerald-500' },
}
