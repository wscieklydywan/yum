import type { VatLetter } from './vat'

/** Gross after refunds split by VAT rate; amounts in PLN. */
export type VatBreakdown = { vat: VatLetter; rate: number; gross: number; net: number; tax: number }

export type DaySummary = {
  /** Missing on reports saved before VAT reporting – the API fills it in on read. */
  vat?: VatBreakdown[]
  tax?: number
  net?: number
  orders: number
  handedOff: number
  cancelledOrders: number
  cancelledValue: number
  revenue: number
  refunds: number
  refundsValue: number
  netRevenue: number
  averageOrder: number
  discounts: number
  deliveryFees: number
  receipts: number
  receiptsValue: number
  topProducts: { name: string; quantity: number; revenue: number }[]
  /** Top 10 by revenue; older saved reports only have the quantity ranking. */
  topProductsByRevenue?: { name: string; quantity: number; revenue: number }[]
  byType: { name: string; orders: number; revenue: number }[]
  bySource: { name: string; orders: number; revenue: number }[]
  /** Order type, with Glovo / Pyszne.pl split out as their own channels. Missing on older saved reports. */
  byChannel?: { name: string; orders: number; revenue: number }[]
  byHour: { hour: number; orders: number }[]
  /** Orders still new/in preparation/ready (not handed off yet) when the summary was built. */
  openOrders?: number
  /** Orders created after the day was closed (manual, delayed sync, etc.) and appended to this report. */
  lateOrders?: number
  lateRevenue?: number
}

export type DayReport = {
  id: string
  openedAt: string
  closedAt: string
  summary: DaySummary
  live?: boolean
  /** Closed, but still collecting late orders until the next day is opened. */
  pending?: boolean
}
