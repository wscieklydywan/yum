'use client'

import { useMemo, useState } from 'react'
import { Banknote, CreditCard, Landmark, Printer, RotateCcw, TriangleAlert, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createReceipt, formatMoney, paymentLabels, renderReceiptHtml, type PaymentMethod } from '@/lib/fiscal-receipt'
import type { KitchenOrder } from './order-data'
import { useDocumentPrinter } from './use-document-printer'

export const paymentMethods = Object.keys(paymentLabels) as PaymentMethod[]

export const paymentIcons: Record<PaymentMethod, LucideIcon> = { cash: Banknote, card: CreditCard, transfer: Landmark }

export function PaymentPicker({ value, onChange, legend = 'Forma płatności' }: { value: PaymentMethod; onChange: (method: PaymentMethod) => void; legend?: string }) {
  return <fieldset className="flex flex-col gap-1.5">
    <legend className="mb-1.5 text-xs font-medium text-muted-foreground">{legend}</legend>
    <div className="grid grid-cols-3 gap-2">
      {paymentMethods.map((method) => {
        const Icon = paymentIcons[method] ?? Banknote
        return <label key={method} className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-border px-2 py-3 text-center text-sm font-semibold transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
          <input type="radio" name={legend} value={method} checked={value === method} onChange={() => onChange(method)} className="sr-only" />
          <Icon className="size-6" aria-hidden="true" />
          {paymentLabels[method]}
        </label>
      })}
    </div>
  </fieldset>
}

const QUICK_NOTES = [20, 50, 100, 200]

/**
 * Parses what the cashier typed as złoty and returns grosze: "100" → 10000, "100,50" / "100.5" → 10050 / 10050,
 * "1 000,50" / "1.000,50" → 100050. A separator followed by 1–2 digits is the decimal point; anything else is a thousands separator.
 */
export function parseZlotyToGrosze(input: string): number {
  const cleaned = input.replace(/[^\d.,]/g, '')
  if (!/\d/.test(cleaned)) return NaN
  const lastSeparator = Math.max(cleaned.lastIndexOf(','), cleaned.lastIndexOf('.'))
  const fraction = lastSeparator >= 0 ? cleaned.slice(lastSeparator + 1) : ''
  const isDecimal = lastSeparator >= 0 && fraction.length <= 2
  const whole = (isDecimal ? cleaned.slice(0, lastSeparator) : cleaned).replace(/[.,]/g, '')
  const grosze = isDecimal ? fraction.padEnd(2, '0') : '00'
  return Number(whole || '0') * 100 + Number(grosze)
}

/** Cash helper: staff types the banknote they received and immediately sees the change to give back. */
export function CashChange({ total }: { total: number }) {
  const [received, setReceived] = useState('')
  // `total` is in grosze (like formatMoney expects); the typed amount is in złoty.
  const amount = parseZlotyToGrosze(received)
  const hasAmount = Number.isFinite(amount)
  const change = amount - total
  const notes = QUICK_NOTES.filter((note) => note * 100 >= total).slice(0, 3)

  return <div className="flex flex-col gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 lg:p-4">
    <label className="flex flex-col gap-1.5 text-xs font-semibold text-emerald-900 lg:text-sm">
      Otrzymana kwota (gotówka)
      <div className="relative">
        <input value={received} onChange={(event) => setReceived(event.target.value.replace(/[^\d.,]/g, ''))} inputMode="decimal" placeholder={formatMoney(total)} className="h-11 w-full rounded-lg border border-emerald-200 bg-white px-3 pr-10 text-base font-bold tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 lg:h-12 lg:text-lg" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">zł</span>
      </div>
    </label>
    <div className="flex flex-wrap gap-1.5">
      <button type="button" onClick={() => setReceived(formatMoney(total))} className="h-9 rounded-lg border border-emerald-200 bg-white px-3 text-xs font-bold text-emerald-900 hover:bg-emerald-100 lg:h-10 lg:text-sm">Odliczone</button>
      {notes.map((note) => <button key={note} type="button" onClick={() => setReceived(String(note))} className="h-9 rounded-lg border border-emerald-200 bg-white px-3 text-xs font-bold tabular-nums text-emerald-900 hover:bg-emerald-100 lg:h-10 lg:text-sm">{note} zł</button>)}
    </div>
    <div aria-live="polite" className="flex items-baseline justify-between gap-2">
      <span className="text-xs font-semibold text-emerald-900 lg:text-sm">{hasAmount && change < 0 ? 'Brakuje' : 'Reszta do wydania'}</span>
      <span className={`text-2xl font-black tabular-nums lg:text-3xl ${hasAmount && change < 0 ? 'text-red-700' : 'text-emerald-800'}`}>{hasAmount ? `${formatMoney(Math.abs(change))} zł` : '—'}</span>
    </div>
  </div>
}

export function IssuesAlert({ issues }: { issues: string[] }) {
  if (!issues.length) return null
  return <div role="alert" className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
    <ul className="flex flex-col gap-0.5">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
  </div>
}

export function ReceiptPreview({ html, title }: { html: string; title: string }) {
  return <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-muted p-3">
    <iframe title={title} srcDoc={html} sandbox="" className="mx-auto block h-[38dvh] w-full max-w-[300px] rounded-md bg-white shadow-sm lg:h-[44dvh]" />
  </div>
}

export function PendingDocumentBar({ busy, onRetry, onDiscard }: { busy: boolean; onRetry: () => void; onDiscard: () => void }) {
  return <div role="status" className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
    <p className="font-semibold">Dokument nie został wydrukowany.</p>
    <p>Pozycje są zarezerwowane, żeby nie trafiły na dwa paragony. Ponów wydruk albo anuluj dokument.</p>
    <div className="flex gap-2">
      <Button size="sm" onClick={onRetry} disabled={busy}><RotateCcw data-icon="inline-start" />Ponów wydruk</Button>
      <Button size="sm" variant="outline" onClick={onDiscard} disabled={busy}>Anuluj dokument</Button>
    </div>
  </div>
}

export function WorkshopPrintDialog({ order, onClose }: { order: KitchenOrder | null; onClose: () => void }) {
  const printer = useDocumentPrinter()
  const [payment, setPayment] = useState<PaymentMethod>('cash')
  const [buyerNip, setBuyerNip] = useState('')
  const draft = useMemo(() => (order ? createReceipt(order, payment, buyerNip) : null), [order, payment, buyerNip])
  const shown = printer.pending ?? draft?.receipt ?? null
  const previewHtml = useMemo(() => (shown ? renderReceiptHtml(shown, { fiscal: printer.adapter.fiscal }) : ''), [shown, printer.adapter.fiscal])
  const blocked = !draft || draft.issues.length > 0 || !order?.databaseId

  function close() {
    if (printer.busy) return
    setBuyerNip('')
    setPayment('cash')
    printer.reset()
    onClose()
  }

  async function print() {
    if (!order?.databaseId || blocked) return
    if (await printer.issue(order.databaseId, { kind: 'receipt', payment, buyerNip })) close()
  }

  return <Dialog open={!!order} onOpenChange={(open) => { if (!open) close() }}>
    <DialogContent className="workshop-dashboard flex max-h-[92dvh] flex-col gap-4 overflow-y-auto sm:max-w-lg lg:max-w-4xl lg:p-8">
      <DialogHeader>
        <DialogTitle>{draft?.receipt.supplement ? 'Paragon dopłaty' : 'Paragon'} {order?.id}</DialogTitle>
        <DialogDescription>{draft?.receipt.supplement
          ? 'Część zamówienia jest już na paragonie. Ten paragon obejmie tylko pozycje dodane później.'
          : printer.adapter.fiscal ? 'Paragon zostanie wydrukowany na kasie fiskalnej.' : 'Kasa fiskalna nie jest podłączona — wydruk będzie oznaczony jako niefiskalny (papier 80 mm).'}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex flex-col gap-4 lg:flex-1">
          {printer.pending ? <PendingDocumentBar busy={printer.busy} onRetry={() => void printer.retry().then((ok) => ok && close())} onDiscard={() => void printer.discard()} /> : <>
            <PaymentPicker value={payment} onChange={setPayment} />
            {payment === 'cash' && shown && <CashChange key={order?.id} total={shown.total} />}
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
              NIP nabywcy (opcjonalnie)
              <input value={buyerNip} onChange={(event) => setBuyerNip(event.target.value)} inputMode="numeric" maxLength={13} placeholder="np. 6342915620" className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            <IssuesAlert issues={draft?.issues ?? []} />
          </>}
          {shown && <div className="hidden rounded-xl bg-muted/60 p-4 lg:block">
            <p className="text-xs font-medium text-muted-foreground">Do zapłaty</p>
            <p className="text-3xl font-bold tabular-nums">{formatMoney(shown.total)} zł</p>
          </div>}
        </div>
        {shown && <div className="lg:w-[280px] lg:shrink-0"><ReceiptPreview html={previewHtml} title={`Podgląd paragonu ${order?.id}`} /></div>}
      </div>

      <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
        <p className="text-sm font-semibold tabular-nums">{shown ? `${formatMoney(shown.total)} zł` : ''}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={close} disabled={printer.busy}>Zamknij</Button>
          {!printer.pending && <Button onClick={() => void print()} disabled={printer.busy || blocked}><Printer data-icon="inline-start" />{printer.busy ? 'Drukowanie…' : 'Drukuj paragon'}</Button>}
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
