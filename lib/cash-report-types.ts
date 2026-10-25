export const CASH_METHODS = ['cash', 'card', 'transfer', 'online'] as const
export type CashMethod = (typeof CASH_METHODS)[number]

export const cashMethodLabels: Record<CashMethod, string> = {
  cash: 'Gotówka',
  card: 'Karta',
  transfer: 'Przelew / BLIK',
  online: 'Platformy (Glovo, Pyszne.pl)',
}

/** Bar can assign these by hand; "online" is reserved for delivery platforms paid in-app. */
export const ASSIGNABLE_METHODS = ['cash', 'card', 'transfer'] as const satisfies readonly CashMethod[]

export type CashMethodTotals = { method: CashMethod; orders: number; sales: number; refunds: number; refundsValue: number; net: number }

export type CashUnassignedOrder = { id: string; number: number; total: number; type: string; source: string; createdAt: string }

/** Receipt printed with one method while the order is recorded as paid with another. */
export type CashMismatchedOrder = CashUnassignedOrder & { receiptMethod: CashMethod; paymentMethod: CashMethod | 'split' }

/** Sales per delivery platform (Glovo, Pyszne.pl…); the breakdown of the "Platformy" column. */
export type CashPlatformTotals = { source: string; orders: number; sales: number }

export type CashSummary = {
  /** Older saved reports predate the platform breakdown. */
  platforms?: CashPlatformTotals[]
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
  /** Older saved reports predate this field. */
  pendingReceipts?: number
  methods: CashMethodTotals[]
  unassignedOrders: number
  unassignedValue: number
  /** Older saved reports predate drawer movements. */
  cashIn?: number
  cashOut?: number
  movements?: CashMovement[]
}

export const CASH_MOVEMENT_KINDS = ['withdrawal', 'deposit'] as const
export type CashMovementKind = (typeof CASH_MOVEMENT_KINDS)[number]

export const cashMovementLabels: Record<CashMovementKind, string> = {
  withdrawal: 'Wypłata z kasy',
  deposit: 'Wpłata do kasy',
}

export type CashMovement = { id: string; kind: CashMovementKind; amount: number; reason: string; signedBy: string; createdAt: string }

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
  mismatched: CashMismatchedOrder[]
  history: CashReportRecord[]
  /** The closed day already has its cash report – no further report until the next day opens. */
  locked: boolean
  /** The day is still open – saving the report closes it. */
  dayOpen: boolean
  }

export const MAX_CASH_AMOUNT = 1_000_000

/** Reports of the running day, or of the last closed day while no day is open. */
export type DayChecklist = {
  dayOpen: boolean
  openedAt: string | null
  closedAt: string | null
  cashReportAt: string | null
  /** A cash report was saved after the day was closed – no further one until the next day. */
  cashLocked: boolean
  fiscalReportAt: string | null
  fiscalRequired: boolean
}

export type CashReportStatusResponse = { pending: boolean; checklist: DayChecklist }

export type FiscalDailyReportRecord = { id: string; printedAt: string; source: 'posnet' | 'manual'; note: string | null }

export type CashReportRow = { id: string; period_from: string; period_to: string; summary: CashSummary; opening_cash: number | string; counted_cash: number | string; difference: number | string; note: string | null; created_at: string; created_by: string | null }

export const cashReportFromRow = (row: CashReportRow): CashReportRecord => {
  const openingCash = Number(row.opening_cash)
  return {
    id: row.id,
    periodFrom: row.period_from,
    periodTo: row.period_to,
    summary: row.summary,
    openingCash,
    countedCash: Number(row.counted_cash),
    expectedCash: expectedCashFor(row.summary, openingCash),
    difference: Number(row.difference),
    note: row.note,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }
}

export const expectedCashFor = (summary: CashSummary, openingCash: number) =>
  Math.round((openingCash + (summary.methods.find((m) => m.method === 'cash')?.net ?? 0) + (summary.cashIn ?? 0) - (summary.cashOut ?? 0)) * 100) / 100
