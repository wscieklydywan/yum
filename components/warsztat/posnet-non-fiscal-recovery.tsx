'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PosnetPrinter, type PendingNonFiscalFooterStatus } from '@/lib/native-posnet'
import { toastPrinterError } from './workshop-daily-fiscal-report'

export type NormalizedFooterStatus = {
  pending: boolean
  orderNumber: string | null
  receiptId: string | null
  error: string | null
  since: string | null
  attempts: number | null
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : typeof value === 'number' ? String(value) : null
}

function normalize(value: PendingNonFiscalFooterStatus | null | undefined): NormalizedFooterStatus {
  const raw = (value ?? {}) as Record<string, unknown>
  const since = raw.failedAt ?? raw.updatedAt ?? raw.createdAt
  return {
    pending: raw.pending === true,
    orderNumber: text(raw.orderNumber),
    receiptId: text(raw.receiptId),
    error: text(raw.lastError) ?? text(raw.error) ?? text(raw.message),
    since: typeof since === 'string' || typeof since === 'number' ? new Date(since).toLocaleString('pl-PL') : null,
    attempts: typeof raw.attempts === 'number' ? raw.attempts : null,
  }
}

export const POSNET_FOOTER_STATUS_EVENT = 'posnet-footer-status-changed'

/**
 * Reads the pending non-fiscal footer from the native bridge. Only calls
 * `getPendingNonFiscalFooterStatus()` and `retryNonFiscalFooter()` — never a fiscal print.
 * An APK without the method rejects the call, which is treated as "nothing pending".
 */
export function usePendingNonFiscalFooter(enabled: boolean) {
  const [status, setStatus] = useState<NormalizedFooterStatus | null>(null)
  const [retrying, setRetrying] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setStatus(normalize(await PosnetPrinter.getPendingNonFiscalFooterStatus()))
    } catch {
      setStatus(normalize(null))
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void refresh()
    const reload = () => { void refresh() }
    window.addEventListener('posnet-footer-configuration-changed', reload)
    window.addEventListener(POSNET_FOOTER_STATUS_EVENT, reload)
    return () => {
      window.removeEventListener('posnet-footer-configuration-changed', reload)
      window.removeEventListener(POSNET_FOOTER_STATUS_EVENT, reload)
    }
  }, [enabled, refresh])

  const retry = useCallback(async () => {
    if (retrying) return
    setRetrying(true)
    try {
      await PosnetPrinter.retryNonFiscalFooter()
      toast.success('Ponowiono część niefiskalną. Paragon fiskalny nie był drukowany ponownie.')
      await refresh()
    } catch (error) {
      toastPrinterError(error, 'Nie udało się ponowić części niefiskalnej.')
    } finally {
      setRetrying(false)
    }
  }, [retrying, refresh])

  return { status, pending: status?.pending === true, retrying, retry, refresh }
}

export function PendingNonFiscalFooterNotice({ status }: { status: NormalizedFooterStatus }) {
  if (!status.pending) return null
  const details = [status.since && `od ${status.since}`, status.attempts !== null && `prób: ${status.attempts}`, status.receiptId && `ID ${status.receiptId}`].filter(Boolean).join(' · ')
  return (
    <div role="status" className="flex flex-col gap-1 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
      <p className="font-semibold">Oczekuje część niefiskalna{status.orderNumber ? ` zamówienia ${status.orderNumber}` : ''}</p>
      <p className="text-xs text-amber-900">Paragon fiskalny został już wydrukowany — nie wydrukowała się tylko stopka (ramka, gratisy, tekst, QR). Ponowienie nie drukuje paragonu fiskalnego drugi raz.</p>
      {details && <p className="text-xs text-amber-900">{details}</p>}
      {status.error && <p className="break-words text-xs text-amber-900">Błąd: {status.error}</p>}
    </div>
  )
}
