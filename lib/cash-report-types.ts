export const CASH_METHODS = ['cash', 'card', 'transfer', 'online'] as const
export type CashMethod = (typeof CASH_METHODS)[number]

export const cashMethodLabels: Record<CashMethod, string> = {
  cash: 'Gotówka',
  card: 'Karta',
  transfer: 'Przelew',
  online: 'Online (platformy)',
}

/** Bar can assign these by hand; "online" is reserved for delivery platforms paid in-app. */
export const ASSIGNABLE_METHODS = ['cash', 'card', 'transfer'] as const satisfies readonly CashMethod[]

export type CashMethodTotals = { method: CashMethod; orders: number; sales: number; refunds: number; refundsValue: number; net: number }

export type CashUnassignedOrder = { id: string; number: number; total: number; type: string; source: string; createdAt: string }

export type CashSummary = {
  orders: number
  sales: number
  refunds: number
  refundsValue: number
  net: number
  discounts: number
  deliveryFees: number
  cancelledOrders: number
  cancelledValue: number
  printedReceipts: number
  methods: CashMethodTotals[]
  unassignedOrders: number
  unassignedValue: number
}

export type CashReportRecord = {
  id: string
  periodFrom: string
  periodTo: string
  summary: CashSummary
  openingCash: number
  countedCash: number
  expectedCash: number
  difference: number
  note: string | null
  createdAt: string
  createdBy: string | null
}

export type CashReportResponse = {
  periodFrom: string
  periodTo: string
  summary: CashSummary
  unassigned: CashUnassignedOrder[]
  history: CashReportRecord[]
}

export const MAX_CASH_AMOUNT = 1_000_000

export const expectedCashFor = (summary: CashSummary, openingCash: number) =>
  Math.round((openingCash + (summary.methods.find((m) => m.method === 'cash')?.net ?? 0)) * 100) / 100
