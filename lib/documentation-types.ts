import type { CashReportRecord } from './cash-report-types'
import type { DaySummary } from './day-report-types'

export type DocumentationKind = 'financial' | 'cash' | 'users'

export type DocumentationDay = { id: string; openedAt: string; closedAt: string | null; summary: DaySummary }

export type DocumentationUser = {
  email: string
  fullName: string
  role: string
  phone: string
  points: number
  statusPoints: number
  createdAt: string
}

export type DocumentationResponse =
  | { kind: 'financial'; days: DocumentationDay[] }
  | { kind: 'cash'; cashReports: CashReportRecord[] }
  | { kind: 'users'; users: DocumentationUser[] }
