'use client'

import { useEffect, useMemo, useState, useSyncExternalStore, type Dispatch, type MouseEvent, type PointerEvent, type ReactNode, type SetStateAction } from 'react'
import { Banknote, CreditCard, Delete, Landmark, Printer, RotateCcw, TriangleAlert, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createReceipt, formatMoney, paymentLabels, RECEIPT_REQUIRES_POSNET, type PaymentMethod, type ReceiptRecoveryStatus } from '@/lib/fiscal-receipt'
import { isOrderPaid, type KitchenOrder } from './order-data'
import { useDocumentPrinter } from './use-document-printer'
import { useDialogSession } from './use-dialog-session'

export const paymentMethods = Object.keys(paymentLabels) as PaymentMethod[]

export const paymentIcons: Record<PaymentMethod, LucideIcon> = { cash: Banknote, card: CreditCard, transfer: Landmark }

export function PaymentPicker({ value, onChange, legend = 'Forma płatności' }: { value: PaymentMethod | null; onChange: (method: PaymentMethod) => void; legend?: string }) {
  return <fieldset className="flex flex-col gap-1.5">
    <legend className="mb-1.5 text-xs font-medium text-muted-foreground">{legend}</legend>
    <div className="grid grid-cols-3 gap-2">
      {paymentMethods.map((method) => {
        const Icon = paymentIcons[method] ?? Banknote
        return <label key={method} className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-border px-2 py-3 text-center text-sm font-semibold transition-colors duration-100 ease-out hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
          <input type="radio" name={legend} value={method} checked={value === method} onChange={() => onChange(method)} className="sr-only" />
          <Icon className="size-6" aria-hidden="true" />
          {paymentLabels[method]}
        </label>
      })}
    </div>
  </fieldset>
}

const QUICK_NOTES = [20, 50, 100, 200]

const TABLET_QUERY = '(min-width: 768px)'

/** Phones get the system numeric keyboard; tablets and desktops get the on-screen keypad. */
export function useIsTabletOrDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(TABLET_QUERY)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    () => window.matchMedia(TABLET_QUERY).matches,
    () => true,
  )
}

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

/** Cash must have the received amount typed in and it has to cover the total (in grosze). */
export function isCashAmountValid(received: string, total: number) {
  const amount = parseZlotyToGrosze(received)
  return Number.isFinite(amount) && amount >= total
}

/** Cash helper: staff types the banknote they received and immediately sees the change to give back. */
export function applyKey(received: string, key: string) {
  if (key === 'back') return received.slice(0, -1)
  if (key === ',') return /[.,]/.test(received) ? received : `${received || '0'},`
  const [, fraction] = received.split(/[.,]/)
  if (fraction !== undefined && fraction.length >= 2) return received
  if (received === '0') return key
  if (received.replace(/[.,]/g, '').length >= 7) return received
  return received + key
}

/**
 * Fires on pointerdown instead of click: every finger registers instantly, even when taps overlap,
 * and the input keeps focus. Keyboard activation (Enter/Space → click with detail 0) still works.
 */
export function tapHandlers(action: () => void) {
  return {
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      action()
      // :active is unreliable when taps overlap, so flash directly on the element; no React render involved.
      // Only a start keyframe: the browser fades back to the element's own resting colour, so there is a single
      // smooth flash instead of jumping between CSS :hover/:active colours. Cancel any previous flash on this key first.
      const key = event.currentTarget
      key.getAnimations().forEach((animation) => animation.cancel())
      key.animate([{ backgroundColor: '#cbd5e1', transform: 'scale(0.96)' }], { duration: 180, easing: 'ease-out' })
    },
    onClick: (event: MouseEvent<HTMLButtonElement>) => { if (event.detail === 0) action() },
  }
}

export function CashChange({ total, value: received, onChange: setReceived, vertical = false }: { total: number; value: string; onChange: Dispatch<SetStateAction<string>>; vertical?: boolean }) {
  // `total` is in grosze (like formatMoney expects); the typed amount is in złoty.
  const amount = parseZlotyToGrosze(received)
  const hasAmount = Number.isFinite(amount)
  const change = amount - total
  const notes = QUICK_NOTES.filter((note) => note * 100 >= total).slice(0, 3)
  const short = hasAmount && change < 0
  const showKeypad = useIsTabletOrDesktop()

  // Functional update so rapid taps that land before a re-render are never lost.
  const press = (key: string) => setReceived((current) => applyKey(current, key))

  const quickClass = 'h-10 min-w-0 touch-manipulation select-none truncate rounded-lg border border-slate-300 bg-white px-2 text-xs font-bold tabular-nums text-slate-800 [-webkit-tap-highlight-color:transparent] [@media(hover:hover)]:hover:bg-slate-100'

  if (vertical) return <div className="flex h-full min-h-0 flex-col gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
    <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
      <span>Otrzymana kwota (gotówka) <span className="text-red-700" aria-hidden="true">*</span></span>
      <div className="relative">
        <input value={received} onChange={(event) => setReceived(event.target.value.replace(/[^\d.,]/g, ''))} inputMode={showKeypad ? 'none' : 'decimal'} required aria-required="true" aria-invalid={!hasAmount || short} placeholder={formatMoney(total)} className="h-12 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 pr-10 text-right text-2xl font-black tabular-nums text-slate-900 outline-none placeholder:font-semibold placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-slate-500" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">zł</span>
      </div>
    </label>
    <div className="grid grid-cols-4 gap-1.5">
      <button type="button" {...tapHandlers(() => setReceived(formatMoney(total)))} className={quickClass}>Odliczone</button>
      {notes.map((note) => <button key={note} type="button" {...tapHandlers(() => setReceived(String(note)))} className={quickClass}>{note} zł</button>)}
    </div>
    <div aria-live="polite" className={`flex min-h-14 shrink-0 items-center justify-between gap-x-2 rounded-lg px-3 py-1.5 ${short ? 'bg-red-50' : 'bg-slate-900'}`}>
      <span className={`shrink-0 text-sm font-semibold ${short ? 'text-red-800' : 'text-slate-300'}`}>{short ? 'Brakuje' : 'Reszta'}</span>
      <span className={`ml-auto whitespace-nowrap text-3xl font-black leading-tight tabular-nums ${short ? 'text-red-700' : 'text-white'}`}>{hasAmount ? `${formatMoney(Math.abs(change))} zł` : '—'}</span>
    </div>
    {showKeypad && <NumericKeypad onKey={press} tall className="min-h-0 flex-1" />}
  </div>

  return <div className="@container rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div className="flex flex-col gap-3 @md:flex-row @md:items-stretch">
      <div className="flex min-w-0 flex-col gap-2.5 @md:flex-1">
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
          <span>Otrzymana kwota (gotówka) <span className="text-red-700" aria-hidden="true">*</span></span>
          <div className="relative">
            <input value={received} onChange={(event) => setReceived(event.target.value.replace(/[^\d.,]/g, ''))} inputMode={showKeypad ? 'none' : 'decimal'} required aria-required="true" aria-invalid={!hasAmount || short} placeholder={formatMoney(total)} className="h-12 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 pr-10 text-right text-xl font-black tabular-nums text-slate-900 outline-none placeholder:font-semibold placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-slate-500" />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">zł</span>
          </div>
        </label>
        <div className="grid grid-cols-4 gap-1.5 @md:grid-cols-2">
          <button type="button" {...tapHandlers(() => setReceived(formatMoney(total)))} className={quickClass}>Odliczone</button>
          {notes.map((note) => <button key={note} type="button" {...tapHandlers(() => setReceived(String(note)))} className={quickClass}>{note} zł</button>)}
        </div>
        <div aria-live="polite" className={`mt-auto flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-x-2 rounded-lg px-3 py-1.5 ${short ? 'bg-red-50' : 'bg-slate-900'}`}>
          <span className={`shrink-0 text-sm font-semibold ${short ? 'text-red-800' : 'text-slate-300'}`}>{short ? 'Brakuje' : 'Reszta'}</span>
          <span className={`ml-auto whitespace-nowrap text-2xl font-black leading-tight tabular-nums @xs:text-3xl ${short ? 'text-red-700' : 'text-white'}`}>{hasAmount ? `${formatMoney(Math.abs(change))} zł` : '—'}</span>
        </div>
      </div>
      {showKeypad && <NumericKeypad onKey={press} className="shrink-0 @md:w-56" />}
    </div>
  </div>
}

const keyBaseClass = 'flex touch-manipulation select-none items-center justify-center rounded-lg border border-slate-200 bg-white font-bold tabular-nums text-slate-900 shadow-sm [-webkit-tap-highlight-color:transparent] [@media(hover:hover)]:hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500'

/**
 * `onKey` gets '0'–'9', ',' or 'back'; pass it through `applyKey` inside a functional state update.
 * `tall` stretches the 3×4 grid to fill its container (a portrait keypad like on a payment terminal).
 */
export function NumericKeypad({ onKey, className = '', tall = false }: { onKey: (key: string) => void; className?: string; tall?: boolean }) {
  const keyClass = `${keyBaseClass} ${tall ? 'min-h-11 text-2xl' : 'h-12 text-lg'}`
  return <div role="group" aria-label="Klawiatura numeryczna" className={`grid grid-cols-3 ${tall ? 'grid-rows-4 gap-2' : 'gap-1.5'} ${className}`}>
    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => <button key={digit} type="button" {...tapHandlers(() => onKey(digit))} className={keyClass}>{digit}</button>)}
    <button type="button" {...tapHandlers(() => onKey(','))} className={keyClass} aria-label="Przecinek">,</button>
    <button type="button" {...tapHandlers(() => onKey('0'))} className={keyClass}>0</button>
    <button type="button" {...tapHandlers(() => onKey('back'))} className={`${keyClass} text-slate-600`} aria-label="Usuń ostatnią cyfrę"><Delete className="size-5" aria-hidden="true" /></button>
  </div>
}

/**
 * Always reserves the cash panel's space on tablet/desktop, so switching gotówka/karta/przelew never resizes the dialog.
 * When cash isn't needed the panel stays in place invisibly and a short note sits on top of it. Phones only show it for cash.
 */
export function CashSlot({ active, note, method, total, value, onChange, vertical = false }: { active: boolean; note: string; method: PaymentMethod | null; total: number; value: string; onChange: Dispatch<SetStateAction<string>>; vertical?: boolean }) {
  const Icon = (method && paymentIcons[method]) || Banknote
  return <div className={`min-w-0 ${active ? 'grid' : 'hidden md:grid'} ${vertical ? 'md:h-full md:grid-rows-[minmax(0,1fr)]' : ''}`}>
    <div className={`min-h-0 [grid-area:1/1] ${active ? '' : 'invisible'}`} inert={!active} aria-hidden={!active}>
      <CashChange total={total} value={value} onChange={onChange} vertical={vertical} />
    </div>
    {!active && <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center text-sm font-medium text-muted-foreground [grid-area:1/1]">
      <Icon className="size-8" aria-hidden="true" />
      <p className="max-w-[16rem] text-pretty">{note}</p>
    </div>}
  </div>
}

export const cashSlotNote: Record<PaymentMethod, string> = {
  cash: 'Zaznacz „Klient już zapłacił”, żeby policzyć resztę.',
  card: 'Płatność kartą — przyjmij ją na terminalu.',
  transfer: 'Przelew — sprawdź, czy pieniądze wpłynęły.',
}

export function IssuesAlert({ issues }: { issues: string[] }) {
  if (!issues.length) return null
  return <div role="alert" className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
    <ul className="flex flex-col gap-0.5">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
  </div>
}

export function PendingDocumentBar({
  busy,
  onRetry,
  onDiscard,
  onForceRetry,
  recoveryStatus,
  fiscal = false,
}: {
  busy: boolean
  onRetry: () => void
  onDiscard: () => void
  onForceRetry?: () => void
  recoveryStatus?: ReceiptRecoveryStatus | null
  fiscal?: boolean
}) {
  const [confirmedNotPrinted, setConfirmedNotPrinted] = useState(false)
  return <div role="status" className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
    <p className="font-semibold">Brak potwierdzenia wydruku.</p>
    <p>{fiscal
      ? 'Pozycje są zarezerwowane. Odzyskaj wynik z POSNET albo sprawdź kasę — nie wysyłaj paragonu drugi raz, jeśli nie masz pewności, czy został wydrukowany.'
      : 'Pozycje są zarezerwowane, żeby nie trafiły na dwa dokumenty. Ponów wydruk albo anuluj dokument.'}</p>
    {fiscal && recoveryStatus && <p>
      Polecenie na tym urządzeniu: <code>{recoveryStatus.commandId || 'nieznane'}</code>
      {recoveryStatus.commandCount > 0 ? ` (${recoveryStatus.commandIndex + 1}/${recoveryStatus.commandCount})` : ''}
      {recoveryStatus.token ? <> · token <code>@{recoveryStatus.token}</code></> : ''}
      {!recoveryStatus.matchesDocument && ' · dotyczy innego dokumentu'}
    </p>}
    {fiscal && recoveryStatus?.fiscalEndMayHaveBeenSent && <p className="font-semibold">
      Komenda kończąca paragon mogła już dotrzeć do POSNET, ale jej odpowiedź nie jest potwierdzona. Nie ponawiaj wydruku, bo mógłby powstać drugi paragon.
    </p>}
    <div className="flex gap-2">
      <Button size="sm" onClick={() => { setConfirmedNotPrinted(false); onRetry() }} disabled={busy}><RotateCcw data-icon="inline-start" />{fiscal ? 'Odzyskaj / ponów' : 'Ponów wydruk'}</Button>
      <Button size="sm" variant="outline" onClick={onDiscard} disabled={busy}>Anuluj dokument</Button>
    </div>
    {onForceRetry && recoveryStatus?.matchesDocument && recoveryStatus.recoverable && !recoveryStatus.fiscalEndMayHaveBeenSent && <div className="flex flex-col gap-2 border-t border-amber-300 pt-2">
      <p>Tryb awaryjny sprawdzi, czy kasa jest bezczynna, i ponowi ten sam zapisany paragon. Użyj go tylko po sprawdzeniu drukarki na miejscu. Na czas operacji nie wysyłaj komend POSNET z innych urządzeń.</p>
      <label className="flex cursor-pointer items-start gap-2">
        <input type="checkbox" checked={confirmedNotPrinted} onChange={(event) => setConfirmedNotPrinted(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-amber-700" />
        <span>Potwierdzam, że sprawdziłem drukarkę na miejscu: paragon nie został wydrukowany, a kasa jest bezczynna.</span>
      </label>
      <Button size="sm" variant="destructive" onClick={() => { setConfirmedNotPrinted(false); onForceRetry() }} disabled={busy || !confirmedNotPrinted}>
        Sprawdź kasę i ponów ten sam paragon
      </Button>
    </div>}
  </div>
}

type PrintDialogProps = {
  order: KitchenOrder | null
  onClose: () => void
  /** Set when the dialog was opened from „Wydane” – printing then also hands the order off, with an option to skip the receipt. */
  onHandOff?: (order: KitchenOrder) => Promise<unknown> | void
}

export function WorkshopPrintDialog(props: PrintDialogProps) {
  const { current, open, session } = useDialogSession(props.order)
  return <PrintDialog key={session} {...props} order={current} open={open} />
}

/** Used inside the „Rozlicz” dialog: prints the receipt only, never marks the order as paid. */
export type EmbeddedPrintProps = {
  switcher: ReactNode
  onLockChange: (locked: boolean) => void
  /** Called once when the printer fails and the document is left waiting for a retry. */
  onPrintFailed?: () => void
}

export function PrintPanel(props: Omit<PrintDialogProps, 'onHandOff'> & { embedded: EmbeddedPrintProps }) {
  return <PrintDialog {...props} open />
}

function PrintDialog({ order, open, onClose, onHandOff, embedded }: PrintDialogProps & { open: boolean; embedded?: EmbeddedPrintProps }) {
  const printer = useDocumentPrinter(undefined, order?.pendingReceiptId)
  const [payment, setPayment] = useState<PaymentMethod>('cash')
  const [buyerNip, setBuyerNip] = useState(order?.buyerNip ?? '')
  const [received, setReceived] = useState('')
  const [handingOff, setHandingOff] = useState(false)
  const draft = useMemo(() => (order ? createReceipt(order, payment, buyerNip, null) : null), [order, payment, buyerNip])
  const shown = printer.pending ?? draft?.receipt ?? null
  const blocked = !draft || draft.issues.length > 0 || !order?.databaseId
  const alreadyPaid = order ? isOrderPaid(order) : false
  // Only ticked by hand – an order counts as paid only when the cashier confirms it.
  const [paidChoice, setPaidChoice] = useState<boolean | null>(null)
  const paidNow = !embedded && !alreadyPaid && (paidChoice ?? false)
  // Cash taken right now needs the received amount; a delivery paid later by the driver does not.
  const needsCash = payment === 'cash' && paidNow
  const cashMissing = needsCash && !!shown && !isCashAmountValid(received, shown.total)
  const busy = printer.busy || handingOff
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

  async function handOff(target: KitchenOrder) {
    if (!onHandOff) return
    setHandingOff(true)
    try { await onHandOff(target) } finally { setHandingOff(false) }
  }

  async function print() {
    if (!order?.databaseId || blocked || cashMissing) return
    if (!(await printer.issue(order.databaseId, { kind: 'receipt', payment, buyerNip, paid: paidNow, cashReceived: needsCash ? parseZlotyToGrosze(received) : undefined }))) return
    await handOff(order)
    close()
  }

  async function handOffWithoutReceipt() {
    if (!order || !alreadyPaid) return
    await handOff(order)
    close()
  }

  const showCashSlot = !embedded && !printer.pending && !alreadyPaid && !!shown

  if (embedded) return <>
      {embedded.switcher}
      <p className="text-xs text-muted-foreground">{draft?.receipt.supplement
        ? 'Część zamówienia jest już na paragonie. Ten paragon obejmie tylko pozycje dodane później.'
        : printer.receiptsAllowed ? `Paragon zostanie wydrukowany na kasie fiskalnej.${alreadyPaid ? '' : ' Zamówienie pozostanie nieopłacone.'}` : RECEIPT_REQUIRES_POSNET}</p>

      <div className="flex flex-col gap-4 md:min-h-0 md:flex-1 md:flex-row">
        <div className="flex min-w-0 flex-col gap-4 md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-1">
          {shown && <div className="flex items-baseline justify-between rounded-xl bg-muted/60 px-4 py-3">
            <span className="text-xs font-medium text-muted-foreground">Do zapłaty</span>
            <span className="text-3xl font-black tabular-nums">{formatMoney(shown.total)} zł</span>
          </div>}
          {printer.pending ? <PendingDocumentBar
            fiscal={printer.pending.kind === 'receipt' && printer.adapter.fiscal}
            busy={printer.busy}
            recoveryStatus={printer.recoveryStatus}
            onRetry={() => void printer.retry().then((ok) => ok && close())}
            onForceRetry={printer.canForceRetry ? () => void printer.forceRetry().then((ok) => ok && close()) : undefined}
            onDiscard={() => void printer.discard()}
          /> : <>
            <PaymentPicker value={payment} onChange={setPayment} />
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
              NIP nabywcy (opcjonalnie)
              <input value={buyerNip} onChange={(event) => setBuyerNip(event.target.value)} inputMode="numeric" maxLength={13} placeholder="np. 6342915620" className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            {alreadyPaid && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">Zamówienie jest już opłacone.</p>}
            <IssuesAlert issues={draft?.issues ?? []} />
          </>}
        </div>
      </div>

      <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
        <div className="flex flex-row items-center justify-end gap-2">
          <div className="flex gap-2">
            <Button variant="outline" className="h-12 px-5" onClick={close} disabled={busy}>Zamknij</Button>
            {!printer.pending && <Button className="h-12 px-5 text-sm font-bold" onClick={() => void print()} disabled={busy || blocked || !printer.receiptsAllowed}><Printer data-icon="inline-start" />{printer.busy ? 'Drukowanie…' : draft?.receipt.supplement ? 'Drukuj paragon dopłaty' : 'Drukuj paragon'}</Button>}
          </div>
        </div>
      </DialogFooter>
  </>

  return <Dialog open={open} onOpenChange={(next) => { if (!next) close() }}>
    <DialogContent className={`workshop-dashboard flex max-h-[calc(92dvh/var(--ui-zoom,1))] max-w-[calc((100vw-2rem)/var(--ui-zoom,1))] flex-col gap-4 overflow-y-auto sm:max-w-lg md:max-w-3xl lg:p-6 ${showCashSlot ? 'lg:max-w-6xl' : 'lg:max-w-4xl'}`}>
      <DialogHeader>
        <DialogTitle>{onHandOff ? 'Wydanie · ' : ''}{draft?.receipt.supplement ? 'Paragon dopłaty' : 'Paragon'} {order?.id}</DialogTitle>
        <DialogDescription>{onHandOff ? 'Paragon nie został jeszcze wydrukowany. Wydrukuj go przed wydaniem albo wydaj bez paragonu.' : draft?.receipt.supplement
          ? 'Część zamówienia jest już na paragonie. Ten paragon obejmie tylko pozycje dodane później.'
          : printer.receiptsAllowed ? 'Paragon zostanie wydrukowany na kasie fiskalnej.' : RECEIPT_REQUIRES_POSNET}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="flex min-w-0 flex-col gap-4 md:flex-1 lg:contents">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-1">
          {printer.pending ? <PendingDocumentBar
            fiscal={printer.pending.kind === 'receipt' && printer.adapter.fiscal}
            busy={printer.busy}
            recoveryStatus={printer.recoveryStatus}
            onRetry={() => void printer.retry().then((ok) => ok && close())}
            onForceRetry={printer.canForceRetry ? () => void printer.forceRetry().then((ok) => ok && close()) : undefined}
            onDiscard={() => void printer.discard()}
          /> : <>
            <PaymentPicker value={payment} onChange={setPayment} />
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
              NIP nabywcy (opcjonalnie)
              <input value={buyerNip} onChange={(event) => setBuyerNip(event.target.value)} inputMode="numeric" maxLength={13} placeholder="np. 6342915620" className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            {alreadyPaid ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">Zamówienie jest już opłacone.</p> : <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm font-semibold has-[:checked]:border-emerald-300 has-[:checked]:bg-emerald-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
              <input type="checkbox" checked={paidNow} onChange={(event) => setPaidChoice(event.target.checked)} className="size-5 accent-emerald-600" />
              <span className="flex flex-col">Klient już zapłacił<span className="text-[11px] font-normal text-muted-foreground">{paidNow ? 'Zamówienie zostanie oznaczone jako opłacone.' : 'Opłacisz później przyciskiem „Rozlicz” (np. przy dowozie).'}</span></span>
            </label>}
            <IssuesAlert issues={draft?.issues ?? []} />
          </>}
          {shown && <div className="hidden rounded-xl bg-muted/60 p-4 lg:block">
            <p className="text-xs font-medium text-muted-foreground">Do zapłaty</p>
            <p className="text-3xl font-bold tabular-nums">{formatMoney(shown.total)} zł</p>
          </div>}
        </div>
        {showCashSlot && <div className="min-w-0 lg:w-[22rem] lg:shrink-0"><CashSlot active={needsCash} note={cashSlotNote[payment]} method={payment} total={shown.total} value={received} onChange={setReceived} /></div>}
        </div>
      </div>

      <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-sm font-semibold tabular-nums">{shown ? `${formatMoney(shown.total)} zł` : ''}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={close} disabled={busy}>Zamknij</Button>
            {!printer.pending && <Button onClick={() => void print()} disabled={busy || blocked || cashMissing || !printer.receiptsAllowed}><Printer data-icon="inline-start" />{printer.busy ? 'Drukowanie…' : onHandOff ? 'Drukuj i wydaj' : 'Drukuj paragon'}</Button>}
          </div>
        </div>
        {onHandOff && alreadyPaid && !printer.pending && <Button variant="outline" className="h-10 border-dashed bg-transparent text-xs font-medium text-muted-foreground shadow-none hover:bg-muted/60 hover:text-foreground" disabled={busy} onClick={() => void handOffWithoutReceipt()}>{handingOff ? 'Wydawanie…' : 'Wydaj bez paragonu'}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
