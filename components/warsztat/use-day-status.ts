'use client'

import useSWR, { mutate as mutateCache } from 'swr'
import type { CashReportStatusResponse } from '@/lib/cash-report-types'

export const CASH_REPORT_STATUS_KEY = '/api/workshop/cash-report/status'

async function fetchStatus(url: string): Promise<CashReportStatusResponse> {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (!response.ok) throw new Error('Nie udało się sprawdzić raportu kasowego.')
  return response.json()
}

/** Cash report and fiscal daily report of the running day (or of the last closed day). */
export function useDayStatus(enabled = true) {
  const { data } = useSWR(enabled ? CASH_REPORT_STATUS_KEY : null, fetchStatus)
  return data ?? null
}

/** Records a fiscal daily report so the system knows it was done for this day. */
export async function recordFiscalDailyReport(source: 'posnet' | 'manual', recovered = false) {
  const response = await fetch('/api/workshop/fiscal-daily-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, recovered }),
  }).catch(() => null)
  void mutateCache(CASH_REPORT_STATUS_KEY)
  void mutateCache('/api/workshop/reports')
  void mutateCache('/api/workshop/reports/cash')
  return !!response?.ok
}
