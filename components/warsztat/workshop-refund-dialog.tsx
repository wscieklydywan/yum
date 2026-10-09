'use client'

import { useMemo, useState } from 'react'
import { Minus, Plus, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createRefund, formatMoney, renderReceiptHtml, type PaymentMethod } from '@/lib/fiscal-receipt'
import { refundableQuantity, type KitchenOrder } from './order-data'
import { IssuesAlert, PaymentPicker, PendingDocumentBar, ReceiptPreview } from './workshop-print-dialog'
import { useDocumentPrinter } from './use-document-printer'

const reasons = ['Danie zepsute / reklamacja', 'Pomyłka w zamówieniu', 'Klient zrezygnował', 'Brak produktu']

export function WorkshopRefundDialog({ order, onClose }: { order: KitchenOrder | null; onClose: () => void }) {
  return <Dialog open={!!order} onOpenChange={(open) => { if (!open) onClose() }}>
    <DialogContent className="workshop-dashboard flex max-h-[92dvh] flex-col gap-4 overflow-y-auto sm:max-w-md">
      {order && <RefundForm key={order.databaseId} order={order} onClose={onClose} />}
    </DialogContent>
  </Dialog>
}

function RefundForm({ order, onClose }: { order: KitchenOrder; onClose: () => void }) {
  const printer = useDocumentPrinter()
  const refundable = order.items.filter((item) => item.id && refundableQuantity(item) > 0)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [reason, setReason] = useState(reasons[0])
  const [payment, setPayment] = useState<PaymentMethod>('cash')
  const lines = Object.entries(quantities).filter(([, quantity]) => quantity > 0).map(([itemId, quantity]) => ({ itemId, quantity }))
  const draft = useMemo(() => createRefund(order, lines, reason, payment), [order, JSON.stringify(lines), reason, payment]) // eslint-disable-line react-hooks/exhaustive-deps
  const shown = printer.pending ?? draft.receipt
  const html = useMemo(() => renderReceiptHtml(shown, { fiscal: printer.adapter.fiscal }), [shown, printer.adapter.fiscal])

  function close() {
    if (!printer.busy) onClose()
  }

  async function submit() {
    if (!order.databaseId || draft.issues.length) return
    if (await printer.issue(order.databaseId, { kind: 'refund', payment, reason, lines })) onClose()
  }

  return <>
    <DialogHeader>
      <DialogTitle>Zwrot · {order.id}</DialogTitle>
      <DialogDescription>Wybierz zafiskalizowane pozycje do zwrotu. Powstanie protokół zwrotu, a kasa fiskalna (po podłączeniu) zarejestruje zwrot.</DialogDescription>
    </DialogHeader>

    {printer.pending ? <PendingDocumentBar busy={printer.busy} onRetry={() => void printer.retry().then((ok) => ok && onClose())} onDiscard={() => void printer.discard()} /> : <>
      {refundable.length === 0 ? <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Nic do zwrotu — najpierw musi zostać wydrukowany paragon.</p> : <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {refundable.map((item) => {
          const max = refundableQuantity(item)
          const value = quantities[item.id!] ?? 0
          const set = (next: number) => setQuantities((current) => ({ ...current, [item.id!]: Math.min(max, Math.max(0, next)) }))
          return <li key={item.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{item.name}</p>
              <p className="text-xs text-muted-foreground">Na paragonie: {max} szt. · {item.unitPrice?.toFixed(2).replace('.', ',')} zł</p>
            </div>
            <div role="group" aria-label={`Ilość do zwrotu: ${item.name}`} className="flex h-8 items-center rounded-lg border border-border">
              <button type="button" aria-label="Mniej" onClick={() => set(value - 1)} disabled={value <= 0} className="grid size-8 place-items-center disabled:opacity-40"><Minus className="size-3.5" aria-hidden="true" /></button>
              <span className="w-6 text-center font-semibold tabular-nums" aria-live="polite">{value}</span>
              <button type="button" aria-label="Więcej" onClick={() => set(value + 1)} disabled={value >= max} className="grid size-8 place-items-center disabled:opacity-40"><Plus className="size-3.5" aria-hidden="true" /></button>
            </div>
          </li>
        })}
      </ul>}

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Powód zwrotu</legend>
        <div className="flex flex-wrap gap-1.5">
          {reasons.map((option) => <button key={option} type="button" aria-pressed={reason === option} onClick={() => setReason(option)} className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${reason === option ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>{option}</button>)}
        </div>
        <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={120} aria-label="Powód zwrotu (własny opis)" className="mt-1 h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </fieldset>

      <PaymentPicker value={payment} onChange={setPayment} legend="Zwrot formą" />
      {lines.length > 0 && <IssuesAlert issues={draft.issues} />}
    </>}

    {(printer.pending || lines.length > 0) && <ReceiptPreview html={html} title={`Podgląd protokołu zwrotu ${order.id}`} />}

    <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
      <p className="text-sm font-semibold tabular-nums">{shown.total > 0 ? `-${formatMoney(shown.total)} zł` : ''}</p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={close} disabled={printer.busy}>Zamknij</Button>
        {!printer.pending && <Button variant="destructive" onClick={() => void submit()} disabled={printer.busy || lines.length === 0 || draft.issues.length > 0}><Undo2 data-icon="inline-start" />{printer.busy ? 'Zapisywanie…' : 'Zwróć i drukuj'}</Button>}
      </div>
    </DialogFooter>
  </>
}
