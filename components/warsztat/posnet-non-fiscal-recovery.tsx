'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PosnetPrinter, type PendingNonFiscalFooterStatus } from '@/lib/native-posnet'
import { toastPrinterError } from './workshop-daily-fiscal-report'

type NormalizedStatus = {
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

function normalize(value: PendingNonFiscalFooterStatus | null | undefined): NormalizedStatus {
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

/**
 * Shown only when the APK reports `nonFiscalRecoverySupport`. Calls exclusively
 * `getPendingNonFiscalFooterStatus()` and `retryNonFiscalFooter()` — never printReceipt or any fiscal method.
 */
export function PosnetNonFiscalRecovery({ disabled }: { disabled?: boolean }) {
  const [status, setStatus] = useState<NormalizedStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setStatus(normalize(await PosnetPrinter.getPendingNonFiscalFooterStatus()))
    } catch (error) {
      setLoadError(error instanceof Error && error.message ? error.message : 'Nie udało się odczytać statusu części niefiskalnej.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function retry() {
    if (retrying || !status?.pending) return
    setRetrying(true)
    try {
      await PosnetPrinter.retryNonFiscalFooter()
      toast.success('Ponowiono część niefiskalną. Paragon fiskalny nie był drukowany ponownie.')
    } catch (error) {
      toastPrinterError(error, 'Nie udało się ponowić części niefiskalnej.')
    } finally {
      setRetrying(false)
      void load()
    }
  }

  const busy = disabled || loading || retrying

  return (
    <div className="flex flex-col gap-2 border-t border-[#f0ece7] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#2b2622]">Część niefiskalna paragonu</h3>
        <Button type="button" variant="ghost" size="sm" onClick={() => void load()} disabled={busy}>
          <RefreshCw data-icon="inline-start" aria-hidden="true" />{loading ? 'Sprawdzanie…' : 'Sprawdź status'}
        </Button>
      </div>

      <div aria-live="polite">
        {loadError && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900">{loadError}</p>}
        {!loadError && !status && <p className="text-xs text-[#9a928a]">Odczytywanie statusu…</p>}
        {!loadError && status && !status.pending && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Brak oczekującej części niefiskalnej.</p>}
        {!loadError && status?.pending && <div className="flex flex-col gap-1 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="font-semibold">Oczekuje część niefiskalna{status.orderNumber ? ` zamówienia ${status.orderNumber}` : ''}</p>
          <p className="text-xs text-amber-900">Paragon fiskalny został już wydrukowany — nie wydrukowała się tylko stopka (ramka, gratisy, tekst, QR).</p>
          {(status.since || status.attempts !== null || status.receiptId) && <p className="text-xs text-amber-900">
            {[status.since && `od ${status.since}`, status.attempts !== null && `prób: ${status.attempts}`, status.receiptId && `ID ${status.receiptId}`].filter(Boolean).join(' · ')}
          </p>}
          {status.error && <p className="break-words text-xs text-amber-900">Błąd: {status.error}</p>}
        </div>}
      </div>

      {status?.pending && <>
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs leading-relaxed text-[#48423d]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <span>Ponowienie może wydrukować treść stopki drugi raz, jeśli część z niej już wyszła z drukarki. Paragon fiskalny nie zostanie powtórzony.</span>
        </p>
        <div>
          <Button variant="outline" onClick={() => void retry()} disabled={busy}>
            <RotateCcw data-icon="inline-start" aria-hidden="true" />{retrying ? 'Ponawianie…' : 'Ponów tylko część niefiskalną'}
          </Button>
        </div>
      </>}
    </div>
  )
}
