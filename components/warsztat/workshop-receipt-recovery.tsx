'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { LoaderCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatMoney } from '@/lib/fiscal-receipt'
import type { PendingDocumentSummary } from '@/app/api/workshop/documents/route'
import { useDocumentPrinter } from './use-document-printer'
import { PendingDocumentBar } from './workshop-print-dialog'

export const RECOVER_RECEIPT_EVENT = 'posnet-recover-receipt'

export function openReceiptRecovery() {
  window.dispatchEvent(new Event(RECOVER_RECEIPT_EVENT))
}

async function fetchPending(url: string) {
  const response = await fetch(url)
  const body = (await response.json().catch(() => null)) as { documents?: PendingDocumentSummary[]; error?: string } | null
  if (!response.ok) throw new Error(body?.error ?? 'Nie udało się wczytać zaległych paragonów.')
  return body?.documents ?? []
}

function PendingDocumentRow({ document, onResolved }: { document: PendingDocumentSummary; onResolved: () => void }) {
  const printer = useDocumentPrinter(undefined, document.id)
  const time = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(document.createdAt))

  async function run(action: () => Promise<boolean>) {
    if (await action()) onResolved()
  }

  return <li className="flex flex-col gap-2 rounded-xl border border-border p-3">
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm font-bold">{document.kind === 'refund' ? 'Zwrot' : 'Paragon'} {document.orderNumber}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{time} · {formatMoney(document.total)} zł</span>
    </div>
    {printer.pending
      ? <PendingDocumentBar
          busy={printer.busy}
          fiscal={printer.adapter.fiscal}
          recoveryStatus={printer.recoveryStatus}
          onRetry={() => void run(printer.retry)}
          onDiscard={() => void run(printer.discard)}
          onForceRetry={printer.canForceRetry ? () => void run(printer.forceRetry) : undefined}
        />
      : <p className="flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Wczytywanie dokumentu…</p>}
  </li>
}

/** Global recovery for receipts left unconfirmed on POSNET – reachable from settings and from printer error toasts, without finding the order first. */
export function WorkshopReceiptRecoveryDialog() {
  const [open, setOpen] = useState(false)
  const { data, error, isLoading, mutate } = useSWR(open ? '/api/workshop/documents' : null, fetchPending, { revalidateOnFocus: false })

  useEffect(() => {
    const show = () => { setOpen(true); void mutate() }
    window.addEventListener(RECOVER_RECEIPT_EVENT, show)
    return () => window.removeEventListener(RECOVER_RECEIPT_EVENT, show)
  }, [mutate])

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Odzyskaj paragon</DialogTitle>
        <DialogDescription>
          Dokumenty, których wydruk nie został potwierdzony przez POSNET. „Odzyskaj / ponów” wysyła ten sam paragon z tym samym ID – jeśli już się wydrukował, kasa tylko potwierdzi wynik i odblokuje drukarkę.
        </DialogDescription>
      </DialogHeader>
      {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Szukam zaległych paragonów…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : 'Błąd wczytywania.'}</p>}
      {data && data.length === 0 && <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
        Brak nierozliczonych dokumentów w systemie. Jeśli drukarka nadal zgłasza nierozliczony paragon, sprawdź jej wyświetlacz i skontaktuj się z serwisem POSNET.
      </p>}
      {data && data.length > 0 && <ul className="flex flex-col gap-3">
        {data.map((document) => <PendingDocumentRow key={document.id} document={document} onResolved={() => void mutate()} />)}
      </ul>}
    </DialogContent>
  </Dialog>
}
