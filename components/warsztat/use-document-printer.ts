'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import useSWR from 'swr'
import { defaultReceiptAdapter, RECEIPT_REQUIRES_POSNET, type FiscalReceipt, type PaymentMethod, type PaymentPart, type ReceiptPrinterAdapter, type ReceiptRecoveryStatus, type RefundRequestLine } from '@/lib/fiscal-receipt'
import { getReceiptPrinterAdapter } from '@/lib/native-posnet'
import { TRAINING_NOTE, useTrainingSandbox } from './training/training-sandbox'
import { toastPrinterError } from './workshop-daily-fiscal-report'

export type DocumentRequest =
  | { kind: 'receipt'; payment: PaymentMethod; split?: PaymentPart[]; buyerNip?: string; paid?: boolean; cashReceived?: number }
  | { kind: 'refund'; payment: PaymentMethod; reason: string; lines: RefundRequestLine[] }

async function readError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? fallback
}

/**
 * Issues a receipt/refund on the server first (which reserves the items so they cannot be billed twice),
 * then prints it. A failed print keeps the document pending so it can be retried with the same id or voided.
 */
async function fetchStoredDocument(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(await readError(response, 'Nie udało się wczytać zaległego paragonu.'))
  const body = (await response.json()) as { document: FiscalReceipt; status: string }
  return body.status === 'pending' ? body.document : null
}

/** Documents whose print failed on this device; the card offers „Ponów” right away instead of waiting out „Drukowanie…”. */
const failedHere = new Set<string>()
const failedListeners = new Set<() => void>()
let failedVersion = 0

function setFailedHere(id: string, failed: boolean) {
  if (failed === failedHere.has(id)) return
  if (failed) failedHere.add(id)
  else failedHere.delete(id)
  failedVersion++
  failedListeners.forEach((listener) => listener())
}

export function useFailedHere(id: string | undefined) {
  useSyncExternalStore(
    (onChange) => { failedListeners.add(onChange); return () => { failedListeners.delete(onChange) } },
    () => failedVersion,
    () => 0,
  )
  return !!id && failedHere.has(id)
}

function markPrinting(id: string) {
  setFailedHere(id, false)
  void fetch(`/api/workshop/documents/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'printing' }) }).catch(() => null)
}

/** `resumeDocumentId` loads a document left pending by an earlier, interrupted print so it can be retried or voided. */
export function useDocumentPrinter(preferredAdapter?: ReceiptPrinterAdapter, resumeDocumentId?: string) {
  const [adapter, setAdapter] = useState<ReceiptPrinterAdapter>(preferredAdapter ?? defaultReceiptAdapter)
  const [localPending, setLocalPending] = useState<FiscalReceipt | null>(null)
  const [finishedIds, setFinishedIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [recoveryStatus, setRecoveryStatus] = useState<ReceiptRecoveryStatus | null>(null)
  const sandbox = useTrainingSandbox()
  const { data: stored } = useSWR(resumeDocumentId && !sandbox ? `/api/workshop/documents/${resumeDocumentId}` : null, fetchStoredDocument, { revalidateOnFocus: false })
  const pending = localPending ?? (stored && !finishedIds.includes(stored.id) ? stored : null)
  const pendingId = pending?.id

  function setPending(document: FiscalReceipt | null) {
    if (!document && pending) setFinishedIds((ids) => [...ids, pending.id])
    setLocalPending(document)
  }

  useEffect(() => {
    let mounted = true
    const refreshAdapter = () => {
      void (preferredAdapter ? Promise.resolve(preferredAdapter) : getReceiptPrinterAdapter()).then((resolved) => {
        if (mounted) setAdapter(resolved)
      }).catch((error: unknown) => {
        if (!mounted) return
        toast.error(error instanceof Error ? error.message : 'Nie udało się odczytać konfiguracji drukarki.')
        setAdapter(defaultReceiptAdapter)
      })
    }
    refreshAdapter()
    window.addEventListener('posnet-configuration-changed', refreshAdapter)
    return () => {
      mounted = false
      window.removeEventListener('posnet-configuration-changed', refreshAdapter)
    }
  }, [preferredAdapter])

  useEffect(() => {
    let mounted = true
    setRecoveryStatus(null)
    if (!pendingId || !adapter.getRecoveryStatus) return () => { mounted = false }
    void adapter.getRecoveryStatus(pendingId).then((status) => {
      if (mounted) setRecoveryStatus(status)
    }).catch((error: unknown) => {
      if (mounted) toast.error(error instanceof Error ? error.message : 'Nie udało się odczytać stanu polecenia POSNET.')
    })
    return () => { mounted = false }
  }, [adapter, pendingId])

  async function printAndConfirm(document: FiscalReceipt, print: () => Promise<void> = () => adapter.print(document)) {
    try {
      await print()
    } catch (error) {
      setPending(document)
      setFailedHere(document.id, true)
      if (adapter.getRecoveryStatus) {
        try {
          setRecoveryStatus(await adapter.getRecoveryStatus(document.id))
        } catch (statusError) {
          toastPrinterError(statusError, 'Nie udało się odczytać stanu polecenia POSNET.')
        }
      }
      toastPrinterError(error, 'Nie udało się wydrukować.', 'Dokument pozostaje nierozliczony. Sprawdź stan drukarki przed ponowieniem.')
      return false
    }
    const response = await fetch(`/api/workshop/documents/${document.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'printed' }) }).catch(() => null)
    if (!response?.ok) {
      setPending(document)
      setFailedHere(document.id, true)
      toast.error('Wydrukowano, ale nie zapisano potwierdzenia.', { description: 'Kliknij „Ponów”, kasa rozpozna ten sam dokument po ID.' })
      return false
    }
    setPending(null)
    setRecoveryStatus(null)
    const label = document.kind === 'refund' ? 'Zwrot' : 'Paragon'
    if (adapter.fiscal && document.kind === 'receipt') toast.success(`${label} ${document.orderNumber} wysłany do kasy fiskalnej`)
    else if (document.kind === 'refund') {
      const description = adapter.id === 'posnet-thermal-xl2-online'
        ? 'POSNET wydrukował ogólny zwrot towaru (niefiskalny); szczegóły są w systemie Yummy.'
        : adapter.fiscal
          ? 'Zwrot przekazano do drukarki; wydruk jest niefiskalny i nie stanowi korekty fiskalnej.'
          : 'Szczegółowy protokół zwrotu został wydrukowany niefiskalnie.'
      toast.success(`${label} ${document.orderNumber} zapisany`, { description })
    }
    else toast.success(`${label} ${document.orderNumber} zapisany`, { description: 'Wydruk niefiskalny — fiskalny wyda kasa po podłączeniu.' })
    return true
  }

  async function issue(orderDatabaseId: string, request: DocumentRequest) {
    if (busy) return false
    if (sandbox) {
      sandbox.issueDocument(orderDatabaseId, request)
      toast.success(request.kind === 'refund' ? 'Zwrot zapisany (szkolenie)' : 'Paragon „wydrukowany” (szkolenie)', { description: TRAINING_NOTE })
      return true
    }
    if (request.kind === 'receipt' && !adapter.fiscal) {
      toast.error(RECEIPT_REQUIRES_POSNET)
      return false
    }
    setBusy(true)
    try {
      const response = await fetch(`/api/workshop/orders/${orderDatabaseId}/documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) }).catch(() => null)
      if (!response) { toast.error('Brak połączenia z serwerem.'); return false }
      if (!response.ok) { toast.error(await readError(response, 'Nie udało się wystawić dokumentu.')); return false }
      const { document, resumed } = (await response.json()) as { document: FiscalReceipt; resumed?: boolean }
      if (resumed) markPrinting(document.id)
      if (resumed) toast('Dokańczam poprzedni, niewydrukowany paragon', { description: 'Najpierw wydrukuj albo anuluj zaległy dokument.' })
      return await printAndConfirm(document)
    } finally {
      setBusy(false)
    }
  }

  async function retry() {
    if (!pending || busy) return false
    if (pending.kind === 'receipt' && !adapter.fiscal) {
      toast.error(RECEIPT_REQUIRES_POSNET, { description: 'Dokończ wydruk na tablecie z kasą albo anuluj zaległy paragon.' })
      return false
    }
    setBusy(true)
    markPrinting(pending.id)
    try { return await printAndConfirm(pending) } finally { setBusy(false) }
  }

  async function forceRetry() {
    const printAgain = adapter.forceRetryReceipt
    if (!pending || pending.kind !== 'receipt' || !printAgain || busy) return false
    setBusy(true)
    markPrinting(pending.id)
    try {
      return await printAndConfirm(pending, () => printAgain(pending))
    } finally {
      setBusy(false)
    }
  }

  async function discard() {
    if (!pending || busy) return false
    setBusy(true)
    try {
      if (adapter.canVoidDocument) {
        try {
          if (!(await adapter.canVoidDocument(pending.id))) {
            toast.error('Nie można bezpiecznie anulować dokumentu.', { description: 'Drukarka może już przetwarzać paragon. Odzyskaj wynik wydruku albo sprawdź kasę przed dalszym działaniem.' })
            return false
          }
        } catch (error) {
          toastPrinterError(error, 'Nie udało się sprawdzić stanu drukarki.')
          return false
        }
      }
      const response = await fetch(`/api/workshop/documents/${pending.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'void' }) }).catch(() => null)
      if (!response?.ok) { toast.error(response ? await readError(response, 'Nie udało się anulować dokumentu.') : 'Brak połączenia z serwerem.'); return false }
      setPending(null)
      toast('Dokument anulowany', { description: 'Pozycje wróciły do rozliczenia.' })
      return true
    } finally {
      setBusy(false)
    }
  }

  return {
    adapter,
    pending,
    busy,
    recoveryStatus,
    /** Receipts may only go to a real fiscal device (POSNET via the Android bridge); training mode never prints. */
    receiptsAllowed: Boolean(sandbox) || adapter.fiscal,
    canForceRetry: Boolean(pending && recoveryStatus?.matchesDocument && recoveryStatus.recoverable && adapter.forceRetryReceipt),
    issue,
    retry,
    forceRetry,
    discard,
    reset: () => setPending(null),
  }
}
