'use client'

import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { CircleCheck, Printer, ReceiptText, Split, Undo2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createReceipt, formatMoney, isValidNip, paymentLabels, RECEIPT_REQUIRES_POSNET, type PaymentMethod } from '@/lib/fiscal-receipt'
import { hasUnbilledItems, isOrderPaid, isPaidOnline, type KitchenOrder } from './order-data'
import { CashSlot, cashSlotNote, IssuesAlert, isCashAmountValid, parseZlotyToGrosze, PaymentPicker, PendingDocumentBar } from './workshop-print-dialog'
import { useDocumentPrinter } from './use-document-printer'
import { useDialogSession } from './use-dialog-session'
import { createSplit, resolveSplit, SplitEditor, SplitKeypad, type SplitState } from './workshop-split-payment'
import { primaryMethod, splitLabel } from '@/lib/payment-split'
import { TRAINING_NOTE, useTrainingSandbox, type TrainingPayment } from './training/training-sandbox'
import { emptySignature, isSignatureValid, PaymentChangeSignature, signaturePayload } from './payment-change-signature'

const isPaymentMethod = (value: unknown): value is PaymentMethod => typeof value === 'string' && value in paymentLabels

export const paidLabel = (order: KitchenOrder) => isPaidOnline(order) ? `Opłacone w aplikacji · ${paymentLabels[isPaymentMethod(order.paymentMethod) ? order.paymentMethod : 'transfer']}`
  : order.paymentSplit ? `Opłacone · ${splitLabel(order.paymentSplit)}`
  : `Opłacone${isPaymentMethod(order.paymentMethod) ? ` · ${paymentLabels[order.paymentMethod]}` : ''}`

/**
 * One place to take money for an order. The default path pays and prints the receipt together;
 * paying without a receipt is the emergency path (e.g. printer down), and orders with a receipt already printed only confirm payment.
 */
function ReceiptMethodNote({ printed, chosen }: { printed: PaymentMethod; chosen: PaymentMethod }) {
  const differs = printed !== chosen
  return <div role="status" className={differs ? 'flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-950' : 'flex items-start gap-2 rounded-xl border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground'}>
    <ReceiptText className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
    <p>
      Paragon wydrukowany jako <strong className="text-foreground">{paymentLabels[printed]}</strong>.
      {differs && <> W systemie zapisze się <strong>{paymentLabels[chosen]}</strong> — nowego paragonu nie trzeba drukować.</>}
    </p>
  </div>
}

function BuyerNipField({ value, onChange, invalid, hint }: { value: string; onChange: (value: string) => void; invalid: boolean; hint: string }) {
  return <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
    NIP nabywcy (opcjonalnie)
    <input value={value} onChange={(event) => onChange(event.target.value)} inputMode="numeric" maxLength={13} placeholder="np. 6342915620" aria-invalid={invalid}
      className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive" />
    <span className={invalid ? 'text-[11px] font-semibold text-destructive' : 'text-[11px] font-normal'}>{invalid ? 'Nieprawidłowy NIP.' : hint}</span>
  </label>
}

type PaymentDialogProps = {
  order: KitchenOrder | null
  onClose: () => void
  /** Set when the dialog was opened from „Wydane” – a successful payment then also hands the order off. */
  onHandOff?: (order: KitchenOrder) => Promise<unknown> | void
}

export function WorkshopPaymentDialog(props: PaymentDialogProps) {
  const { current, open, session } = useDialogSession(props.order)
  return <PaymentDialog key={session} {...props} order={current} open={open} />
}

/** Used inside the „Rozlicz” dialog: renders only the content, with one fixed action instead of the legacy footer. */
export type EmbeddedPaymentProps = {
  mode: 'pay' | 'pay-and-print'
  switcher: ReactNode
  onLockChange: (locked: boolean) => void
  /** Called once when the printer fails and the receipt is left waiting for a retry. */
  onPrintFailed?: () => void
}

export function PaymentPanel(props: Omit<PaymentDialogProps, 'onHandOff'> & { embedded: EmbeddedPaymentProps }) {
  return <PaymentDialog {...props} open />
}

function PaymentDialog({ order, open, onClose, onHandOff, embedded }: PaymentDialogProps & { open: boolean; embedded?: EmbeddedPaymentProps }) {
  const printer = useDocumentPrinter()
  const sandbox = useTrainingSandbox()
  const [chosen, setChosen] = useState<PaymentMethod | null>(null)
  const [received, setReceived] = useState('')
  const [saving, setSaving] = useState(false)
  const [split, setSplit] = useState<SplitState | null>(null)
  const [buyerNip, setBuyerNip] = useState(order?.buyerNip ?? '')
  const [signature, setSignature] = useState(emptySignature)
  // Nothing is preselected on purpose: staff must consciously pick how the customer pays before the receipt prints.
  const method = chosen
  const unbilled = order ? hasUnbilledItems(order) : false
  const paid = order ? isOrderPaid(order) : false
  const normalizedNip = buyerNip.replace(/[\s-]/g, '')
  const nipInvalid = !!normalizedNip && !isValidNip(normalizedNip)
  // The receipt total does not depend on the payment method, so the split parts never feed back into it.
  const draft = useMemo(() => (order && unbilled ? createReceipt(order, method ?? 'cash', buyerNip, null) : null), [order, unbilled, method, buyerNip])
  const total = draft?.receipt.total ?? Math.round((order?.total ?? 0) * 100)
  const parts = split ? resolveSplit(split, total).parts : null
  const busy = saving || printer.busy
  const blocked = !order?.databaseId || (draft?.issues.length ?? 0) > 0 || !printer.receiptsAllowed
  const cashMissing = nipInvalid || (split ? !parts : !method || (method === 'cash' && !isCashAmountValid(received, total)))
  const printedMethod = isPaymentMethod(order?.receiptPaymentMethod) ? order.receiptPaymentMethod : null
  const needsSignature = !!printedMethod && !sandbox && (split ? true : !!method && method !== printedMethod)
  const signatureMissing = needsSignature && !isSignatureValid(signature)
  const signatureField = needsSignature ? <PaymentChangeSignature idPrefix={`pay-${order?.databaseId ?? 'order'}`} value={signature} onChange={setSignature} /> : null
  const nipField = <BuyerNipField value={buyerNip} onChange={setBuyerNip} invalid={nipInvalid} hint={unbilled ? 'Wydrukuje się na paragonie.' : 'Zapisze się przy zamówieniu i trafi na kolejny paragon.'} />
  const showCashSlot = !paid && !printer.pending
  const onLockChange = embedded?.onLockChange
  const locked = busy || !!printer.pending
  useEffect(() => { onLockChange?.(locked) }, [locked, onLockChange])
  const onPrintFailed = embedded?.onPrintFailed
  const printFailed = !!printer.pending && !printer.busy
  useEffect(() => { if (printFailed) onPrintFailed?.() }, [printFailed, onPrintFailed])

  function close() {
    if (busy) return
    onClose()
  }

  async function finish(target: KitchenOrder) {
    if (onHandOff) {
      setSaving(true)
      try { await onHandOff(target) } finally { setSaving(false) }
    }
    close()
  }

  async function request(init: RequestInit, success: string) {
    if (!order?.databaseId || busy) return false
    if (sandbox) {
      if (init.method === 'DELETE') sandbox.undoPayment(order.databaseId)
      else sandbox.recordPayment(order.databaseId, JSON.parse(String(init.body ?? '{}')) as TrainingPayment)
      toast.success(success, { description: TRAINING_NOTE })
      return true
    }
    setSaving(true)
    try {
      const response = await fetch(`/api/workshop/orders/${order.databaseId}/payment`, { ...init, headers: { 'Content-Type': 'application/json' } }).catch(() => null)
      const data = (await response?.json().catch(() => null)) as { error?: string } | null
      if (!response?.ok) throw new Error(data?.error || 'Nie udało się zapisać płatności.')
      toast.success(success)
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się zapisać płatności.')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function payOnly() {
    if (!order || cashMissing || signatureMissing) return
    const signed = needsSignature ? signaturePayload(signature) : {}
    if (parts) {
      if (await request({ method: 'POST', body: JSON.stringify({ split: parts, buyerNip: normalizedNip, ...signed }) }, `${order.id} opłacone · ${splitLabel(parts)}`)) await finish(order)
      return
    }
    if (!method) return
    const cashReceived = method === 'cash' ? parseZlotyToGrosze(received) : undefined
    if (await request({ method: 'POST', body: JSON.stringify({ method, cashReceived, buyerNip: normalizedNip, ...signed }) }, `${order.id} opłacone · ${paymentLabels[method]}`)) await finish(order)
  }

  async function undoPayment() {
    if (await request({ method: 'DELETE' }, `Cofnięto płatność ${order?.id}`)) close()
  }

  async function payAndPrint() {
    if (!order?.databaseId || blocked || cashMissing) return
    if (parts) {
      if (await printer.issue(order.databaseId, { kind: 'receipt', payment: primaryMethod(parts), split: parts, paid: true, buyerNip: normalizedNip })) await finish(order)
      return
    }
    if (!method) return
    if (await printer.issue(order.databaseId, { kind: 'receipt', payment: method, paid: true, buyerNip: normalizedNip, cashReceived: method === 'cash' ? parseZlotyToGrosze(received) : undefined })) await finish(order)
  }

  if (embedded) return <>
      {embedded.switcher}
      {paid && <p className="text-sm text-muted-foreground">Płatność jest już zapisana. Możesz ją cofnąć, jeśli została oznaczona przez pomyłkę.</p>}
      {paid ? <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
        <CircleCheck className="size-6 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-bold">{order && paidLabel(order)}</p>
          <p className="text-xs tabular-nums">{formatMoney(total)} zł{order?.paidAt ? ` · ${new Date(order.paidAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' })}` : ''}</p>
          {order?.paymentSplit && <ul className="mt-1 flex flex-col text-xs tabular-nums">
            {order.paymentSplit.map((part) => <li key={part.method}>{paymentLabels[part.method]}: <strong>{formatMoney(part.amount)} zł</strong></li>)}
          </ul>}
        </div>
      </div> : printer.pending ? <PendingDocumentBar
        fiscal={printer.pending.kind === 'receipt' && printer.adapter.fiscal}
        busy={printer.busy}
        recoveryStatus={printer.recoveryStatus}
        onRetry={() => void printer.retry().then((ok) => ok && close())}
        onForceRetry={printer.canForceRetry ? () => void printer.forceRetry().then((ok) => ok && close()) : undefined}
        onDiscard={() => void printer.discard()}
      /> : <div className="flex flex-col gap-3 md:grid md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,1fr)_20rem] md:grid-rows-[minmax(0,1fr)_auto] md:gap-x-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-3 md:col-start-1 md:row-start-1 md:min-h-0 md:overflow-y-auto md:pr-1">
          <div className="flex items-baseline justify-between rounded-xl bg-muted/60 px-4 py-3">
            <span className="text-xs font-medium text-muted-foreground">Do zapłaty</span>
            <span className="text-3xl font-black tabular-nums">{formatMoney(total)} zł</span>
          </div>
          {!split && !unbilled && isPaymentMethod(order?.receiptPaymentMethod) && <ReceiptMethodNote printed={order.receiptPaymentMethod} chosen={method ?? order.receiptPaymentMethod} />}
          {split ? <SplitEditor total={total} value={split} onChange={setSplit as Dispatch<SetStateAction<SplitState>>} /> : <PaymentPicker value={method} onChange={setChosen} legend="Klient płaci" />}
          {!split && !method && <p role="status" className="-mt-1 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">Zapytaj klienta i wybierz formę płatności.</p>}
          <button type="button" onClick={() => setSplit((current) => (current ? null : createSplit(method ?? 'cash')))} aria-pressed={!!split}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Split className="size-4" aria-hidden="true" />{split ? 'Jedna forma płatności' : 'Podziel płatność (np. karta + BLIK)'}
          </button>
          {embedded.mode !== 'pay-and-print' && signatureField}
          {nipField}
          <IssuesAlert issues={draft?.issues ?? []} />
          {unbilled && !printer.receiptsAllowed && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">{RECEIPT_REQUIRES_POSNET}</p>}
        </div>
        <div className="min-w-0 md:col-start-2 md:row-span-2 md:row-start-1 md:min-h-0">{split
          ? <SplitKeypad value={split} onChange={setSplit as Dispatch<SetStateAction<SplitState>>} tall />
          : <CashSlot active={method === 'cash'} note={method ? cashSlotNote[method] : 'Najpierw wybierz formę płatności.'} method={method} total={total} value={received} onChange={setReceived} vertical />}</div>
        <div className="flex flex-col md:col-start-1 md:row-start-2 md:justify-end">{embedded.mode === 'pay-and-print'
          ? <Button className="h-14 w-full text-base bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700" disabled={busy || blocked || cashMissing} onClick={() => void payAndPrint()}><Printer data-icon="inline-start" />{printer.busy ? 'Drukowanie…' : 'Opłać i drukuj paragon'}</Button>
          : <Button className="h-14 w-full text-base font-bold" disabled={busy || !order?.databaseId || cashMissing || signatureMissing} onClick={() => void payOnly()}><Wallet data-icon="inline-start" />{saving ? 'Zapisywanie…' : 'Zapisz płatność'}</Button>}</div>
      </div>}

      {paid && <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0 md:mt-auto">
        {!isPaidOnline(order!) && <Button variant="outline" className="h-11 text-amber-900" disabled={busy} onClick={() => void undoPayment()}><Undo2 data-icon="inline-start" />Cofnij płatność</Button>}
        <Button className="h-11" onClick={close}>Zamknij</Button>
      </DialogFooter>}
  </>

  return <Dialog open={open} onOpenChange={(next) => { if (!next) close() }}>
    <DialogContent className={`workshop-dashboard flex max-h-[calc(92dvh/var(--ui-zoom,1))] max-w-[calc((100vw-2rem)/var(--ui-zoom,1))] flex-col gap-4 overflow-y-auto sm:max-w-lg ${showCashSlot ? 'md:max-w-3xl' : ''}`}>
      <DialogHeader>
        <DialogTitle>{paid ? 'Zamówienie opłacone' : 'Opłać zamówienie'} {order?.id}</DialogTitle>
        <DialogDescription>{paid
          ? 'Płatność jest już zapisana. Możesz ją cofnąć, jeśli została oznaczona przez pomyłkę.'
          : onHandOff ? (unbilled ? 'Zamówienie nie jest opłacone ani nie ma paragonu. Przyjmij płatność i wydrukuj paragon, a zamówienie zostanie wydane.' : 'Zamówienie nie jest opłacone. Przyjmij płatność, a zamówienie zostanie wydane.')
          : unbilled ? 'Wybierz formę płatności — paragon wydrukuje się od razu.' : 'Paragon jest już wydany. Potwierdź, jak klient zapłacił.'}</DialogDescription>
      </DialogHeader>
      {paid ? <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
        <CircleCheck className="size-6 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-bold">{order && paidLabel(order)}</p>
          <p className="text-xs tabular-nums">{formatMoney(total)} zł{order?.paidAt ? ` · ${new Date(order.paidAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' })}` : ''}</p>
          {order?.paymentSplit && <ul className="mt-1 flex flex-col text-xs tabular-nums">
            {order.paymentSplit.map((part) => <li key={part.method}>{paymentLabels[part.method]}: <strong>{formatMoney(part.amount)} zł</strong></li>)}
          </ul>}
        </div>
      </div> : printer.pending ? <PendingDocumentBar
        fiscal={printer.pending.kind === 'receipt' && printer.adapter.fiscal}
        busy={printer.busy}
        recoveryStatus={printer.recoveryStatus}
        onRetry={() => void printer.retry().then((ok) => ok && close())}
        onForceRetry={printer.canForceRetry ? () => void printer.forceRetry().then((ok) => ok && close()) : undefined}
        onDiscard={() => void printer.discard()}
      /> : <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="flex min-w-0 flex-col gap-4 md:flex-1">
          <div className="flex items-baseline justify-between rounded-xl bg-muted/60 px-4 py-3">
            <span className="text-xs font-medium text-muted-foreground">Do zapłaty</span>
            <span className="text-2xl font-black tabular-nums">{formatMoney(total)} zł</span>
          </div>
          {!split && !unbilled && isPaymentMethod(order?.receiptPaymentMethod) && <ReceiptMethodNote printed={order.receiptPaymentMethod} chosen={method ?? order.receiptPaymentMethod} />}
          {split ? <SplitEditor total={total} value={split} onChange={setSplit as Dispatch<SetStateAction<SplitState>>} /> : <PaymentPicker value={method} onChange={setChosen} legend="Klient płaci" />}
          {!split && !method && <p role="status" className="-mt-1 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">Zapytaj klienta i wybierz formę płatności.</p>}
          <button type="button" onClick={() => setSplit((current) => (current ? null : createSplit(method ?? 'cash')))} aria-pressed={!!split}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Split className="size-4" aria-hidden="true" />{split ? 'Jedna forma płatności' : 'Podziel płatność (np. karta + BLIK)'}
          </button>
          {signatureField}
          {nipField}
          <IssuesAlert issues={draft?.issues ?? []} />
          {unbilled && !printer.receiptsAllowed && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">{RECEIPT_REQUIRES_POSNET}</p>}
        </div>
        <div className="min-w-0 md:w-[22rem] md:shrink-0">{split
          ? <SplitKeypad value={split} onChange={setSplit as Dispatch<SetStateAction<SplitState>>} />
          : <CashSlot active={method === 'cash'} note={method ? cashSlotNote[method] : 'Najpierw wybierz formę płatności.'} method={method} total={total} value={received} onChange={setReceived} />}</div>
      </div>}

      <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
        {paid ? <>
          {!isPaidOnline(order!) && <Button variant="outline" className="h-11 text-amber-900" disabled={busy} onClick={() => void undoPayment()}><Undo2 data-icon="inline-start" />Cofnij płatność</Button>}
          <Button className="h-11" onClick={close}>Zamknij</Button>
        </> : !printer.pending && (unbilled ? <>
          <Button className="h-12 text-sm font-bold" disabled={busy || blocked || cashMissing} onClick={() => void payAndPrint()}><Printer data-icon="inline-start" />{printer.busy ? 'Drukowanie…' : onHandOff ? 'Opłać, drukuj i wydaj' : 'Opłać i drukuj paragon'}</Button>
          {!onHandOff && <Button variant="outline" className="h-10 border-dashed bg-transparent text-xs font-medium text-muted-foreground shadow-none hover:bg-muted/60 hover:text-foreground" disabled={busy || !order?.databaseId || cashMissing || signatureMissing} onClick={() => void payOnly()}>Opłać bez paragonu</Button>}
        </> : <Button className="h-12 text-sm font-bold" disabled={busy || !order?.databaseId || cashMissing || signatureMissing} onClick={() => void payOnly()}><Wallet data-icon="inline-start" />{saving ? 'Zapisywanie…' : onHandOff ? 'Potwierdź płatność i wydaj' : 'Potwierdź płatność'}</Button>)}
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
