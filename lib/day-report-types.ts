export type DaySummary = {
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
  byType: { name: string; orders: number; revenue: number }[]
  bySource: { name: string; orders: number; revenue: number }[]
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
