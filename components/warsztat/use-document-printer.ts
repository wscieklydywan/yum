'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { defaultReceiptAdapter, type FiscalReceipt, type PaymentMethod, type ReceiptPrinterAdapter, type RefundRequestLine } from '@/lib/fiscal-receipt'

export type DocumentRequest =
  | { kind: 'receipt'; payment: PaymentMethod; buyerNip?: string }
  | { kind: 'refund'; payment: PaymentMethod; reason: string; lines: RefundRequestLine[] }

async function readError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? fallback
}

/**
 * Issues a receipt/refund on the server first (which reserves the items so they cannot be billed twice),
 * then prints it. A failed print keeps the document pending so it can be retried with the same id or voided.
 */
export function useDocumentPrinter(adapter: ReceiptPrinterAdapter = defaultReceiptAdapter) {
  const [pending, setPending] = useState<FiscalReceipt | null>(null)
  const [busy, setBusy] = useState(false)

  async function printAndConfirm(document: FiscalReceipt) {
    try {
      await adapter.print(document)
    } catch (error) {
      setPending(document)
      toast.error(error instanceof Error ? error.message : 'Nie udało się wydrukować.', { description: 'Dokument czeka na ponowny wydruk.' })
      return false
    }
    const response = await fetch(`/api/workshop/documents/${document.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'printed' }) }).catch(() => null)
    if (!response?.ok) {
      setPending(document)
      toast.error('Wydrukowano, ale nie zapisano potwierdzenia.', { description: 'Kliknij „Ponów”, kasa rozpozna ten sam dokument po ID.' })
      return false
    }
    setPending(null)
    const label = document.kind === 'refund' ? 'Zwrot' : 'Paragon'
    if (adapter.fiscal) toast.success(`${label} ${document.orderNumber} wysłany do kasy fiskalnej`)
    else toast.success(`${label} ${document.orderNumber} zapisany`, { description: 'Wydruk niefiskalny — fiskalny wyda kasa po podłączeniu.' })
    return true
  }

  async function issue(orderDatabaseId: string, request: DocumentRequest) {
    if (busy) return false
    setBusy(true)
    try {
      const response = await fetch(`/api/workshop/orders/${orderDatabaseId}/documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) }).catch(() => null)
      if (!response) { toast.error('Brak połączenia z serwerem.'); return false }
      if (!response.ok) { toast.error(await readError(response, 'Nie udało się wystawić dokumentu.')); return false }
      const { document, resumed } = (await response.json()) as { document: FiscalReceipt; resumed?: boolean }
      if (resumed) toast('Dokańczam poprzedni, niewydrukowany paragon', { description: 'Najpierw wydrukuj albo anuluj zaległy dokument.' })
      return await printAndConfirm(document)
    } finally {
      setBusy(false)
    }
  }

  async function retry() {
    if (!pending || busy) return false
    setBusy(true)
    try { return await printAndConfirm(pending) } finally { setBusy(false) }
  }

  async function discard() {
    if (!pending || busy) return false
    setBusy(true)
    try {
      const response = await fetch(`/api/workshop/documents/${pending.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'void' }) }).catch(() => null)
      if (!response?.ok) { toast.error(response ? await readError(response, 'Nie udało się anulować dokumentu.') : 'Brak połączenia z serwerem.'); return false }
      setPending(null)
      toast('Dokument anulowany', { description: 'Pozycje wróciły do rozliczenia.' })
      return true
    } finally {
      setBusy(false)
    }
  }

  return { adapter, pending, busy, issue, retry, discard, reset: () => setPending(null) }
}
