'use client'

import { useCallback, useState } from 'react'
import { AlertTriangle, Check, LoaderCircle, Pencil, Printer, ReceiptText, RotateCw, Trash2, Wallet, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { hasPendingReceipt, hasUnbilledItems, isOrderPaid, type KitchenOrder } from './order-data'
import { PaymentPanel } from './workshop-payment-dialog'
import { PrintPanel } from './workshop-print-dialog'
import { useDialogSession } from './use-dialog-session'
import { SettleOrderSummary } from './workshop-settle-order-summary'

export type SettleMode = 'pay-and-print' | 'pay' | 'print'

type ModeOption = { mode: SettleMode; label: string; hint: string; icon: LucideIcon; disabledHint?: string }

/** What the order still needs decides which options make sense and which one is picked first. */
function settleOptions(order: KitchenOrder) {
  const unbilled = hasUnbilledItems(order)
  const paid = isOrderPaid(order)
  const payable = order.status !== 'cancelled' || paid
  const pendingReceipt = hasPendingReceipt(order)
  const options: ModeOption[] = [
    { mode: 'pay-and-print', label: 'Opłać + paragon', hint: 'Płatność i paragon w jednym kroku', icon: ReceiptText, disabledHint: pendingReceipt ? 'Paragon czeka na wydruk' : paid ? 'Już opłacone' : !unbilled ? 'Paragon już wydany' : !payable ? 'Zamówienie anulowane' : undefined },
    { mode: 'pay', label: paid ? 'Płatność' : 'Tylko opłać', hint: paid ? 'Szczegóły lub cofnięcie płatności' : 'Bez drukowania paragonu', icon: Wallet, disabledHint: !payable ? 'Zamówienie anulowane' : undefined },
    { mode: 'print', label: pendingReceipt ? 'Ponów paragon' : 'Tylko paragon', hint: pendingReceipt ? 'Niewydrukowany — ponów lub anuluj' : 'Nie oznacza jako opłacone', icon: Printer, disabledHint: !unbilled && !pendingReceipt ? 'Paragon już wydany' : undefined },
  ]
  const initial: SettleMode = pendingReceipt ? 'print' : unbilled && !paid && payable ? 'pay-and-print' : unbilled && paid ? 'print' : 'pay'
  return { options, initial }
}

function ModeSwitcher({ options, value, locked, onChange }: { options: ModeOption[]; value: SettleMode; locked: boolean; onChange: (mode: SettleMode) => void }) {
  return <div role="radiogroup" aria-label="Sposób rozliczenia" className="grid grid-cols-3 gap-2">
    {options.map((option) => {
      const selected = value === option.mode
      const disabled = !!option.disabledHint || (locked && !selected)
      const primary = option.mode === 'pay-and-print'
      return <button key={option.mode} type="button" role="radio" aria-checked={selected} disabled={disabled} onClick={() => onChange(option.mode)}
        className={cn(
          'flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-2 text-center transition-colors duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 md:flex-row md:justify-start md:gap-3 md:px-3 md:text-left',
          primary
            ? selected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-emerald-300 bg-emerald-50 text-emerald-900 enabled:hover:bg-emerald-100'
            : selected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-foreground enabled:hover:bg-muted',
        )}>
        <option.icon className="size-5 shrink-0 md:size-6" aria-hidden="true" />
        <span className="flex min-w-0 flex-col">
          <span className="text-[13px] font-bold leading-tight md:text-sm">{option.label}</span>
          <span className={cn('text-[10px] leading-snug md:text-[11px]', primary && selected ? 'text-emerald-50' : 'text-muted-foreground')}>{option.disabledHint ?? option.hint}</span>
        </span>
      </button>
    })}
  </div>
}

type SettleDialogProps = {
  order: KitchenOrder | null
  onClose: () => void
  /** Notified when the printer fails; the handler decides whether to leave the dialog or keep the retry inside it. */
  onPrintFailed?: () => void
  /** A „Dodaj i rozlicz” order that is still being saved in the background (or whose save failed). */
  saveState?: SaveState | null
  onRetrySave?: () => void
  onEditDraft?: () => void
  onDiscardDraft?: () => void
}

export type SaveState = { status: 'saving' } | { status: 'error'; error: string }

/** One „Rozlicz” entry point that hosts the existing payment and receipt flows side by side. */
export function WorkshopSettleDialog(props: SettleDialogProps) {
  const { current, open, session } = useDialogSession(props.order)
  return <SettleDialog key={session} {...props} order={current} open={open} />
}

const pillClass = 'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold'

/** Lives in the header row and never exceeds the title's height, so appearing or disappearing never resizes the dialog. */
function SaveStatus({ state, saved, onRetry, onEdit, onDiscard }: { state: SaveState | null; saved: boolean; onRetry?: () => void; onEdit?: () => void; onDiscard?: () => void }) {
  if (state?.status === 'saving') return <span role="status" className={cn(pillClass, 'border-amber-200 bg-amber-50 text-amber-900')}>
    <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />Zapisuję…
  </span>
  if (state?.status === 'error') return <div role="alert" className="flex shrink-0 items-center gap-1.5">
    <span className={cn(pillClass, 'border-red-200 bg-red-50 text-red-900')} title={`${state.error} Dane są bezpieczne na tym urządzeniu.`}>
      <AlertTriangle className="size-3.5" aria-hidden="true" />Nie zapisano
      <span className="sr-only">: {state.error} Dane są bezpieczne na tym urządzeniu.</span>
    </span>
    {onDiscard && <Button type="button" size="sm" variant="outline" className="h-7 border-red-200 px-2 text-red-700 hover:bg-red-50 hover:text-red-800" onClick={onDiscard} aria-label="Usuń niezapisane zamówienie"><Trash2 data-icon="inline-start" /><span className="hidden sm:inline">Usuń</span></Button>}
    {onEdit && <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={onEdit} aria-label="Popraw zamówienie"><Pencil data-icon="inline-start" /><span className="hidden sm:inline">Popraw</span></Button>}
    {onRetry && <Button type="button" size="sm" className="h-7 px-2" onClick={onRetry} aria-label="Ponów zapis"><RotateCw data-icon="inline-start" /><span className="hidden sm:inline">Ponów</span></Button>}
  </div>
  if (saved) return <span role="status" className={cn(pillClass, 'border-emerald-200 bg-emerald-50 text-emerald-800')}>
    <Check className="size-3.5" aria-hidden="true" />Zapisano
  </span>
  return null
}

function SettleDialog({ order, open, onClose, onPrintFailed, saveState, onRetrySave, onEditDraft, onDiscardDraft }: SettleDialogProps & { open: boolean }) {
  const { options, initial } = order ? settleOptions(order) : { options: [], initial: 'pay' as SettleMode }
  const [mode, setMode] = useState<SettleMode>(initial)
  const [locked, setLocked] = useState(false)
  const onLockChange = useCallback((next: boolean) => setLocked(next), [])
  // A „Dodaj i rozlicz” order starts as a local copy; this instance is keyed per open, so the first value is the opening one.
  const [startedUnsaved] = useState(() => Boolean(order && !order.databaseId))
  // Keep the last save state during the close fade so the header doesn't change while the dialog disappears.
  const [frozenSave, setFrozenSave] = useState(saveState ?? null)
  if (open && frozenSave !== (saveState ?? null)) setFrozenSave(saveState ?? null)
  const shownSave = open ? saveState ?? null : frozenSave

  const switcher = <ModeSwitcher options={options} value={mode} locked={locked} onChange={setMode} />
  // The order form vanishes in the same frame, so a fade-in here would flash the page underneath.
  const instant = startedUnsaved ? 'data-open:animate-none' : undefined

  return <Dialog open={open} onOpenChange={(next) => { if (!next && !locked) onClose() }}>
    <DialogContent overlayClassName={instant} className={cn('workshop-dashboard flex max-h-[calc((100dvh-1.5rem)/var(--ui-zoom,1))] w-[calc((100vw-1.5rem)/var(--ui-zoom,1))] max-w-5xl flex-col gap-3 overflow-y-auto sm:max-w-5xl md:h-[min(calc((100dvh-2rem)/var(--ui-zoom,1)),46rem)] md:gap-4 md:overflow-hidden lg:max-w-6xl lg:p-5', instant)}>
      <DialogHeader className="min-h-7 flex-row items-center gap-2 pr-8 md:min-h-11 md:pr-14">
        <DialogTitle className="min-w-0 flex-1 truncate">{order && !order.databaseId ? 'Rozlicz nowe zamówienie' : `Rozlicz zamówienie ${order?.id ?? ''}`}</DialogTitle>
        <SaveStatus state={shownSave} saved={startedUnsaved && Boolean(order?.databaseId)} onRetry={onRetrySave} onEdit={onEditDraft} onDiscard={onDiscardDraft} />
      </DialogHeader>
      {order && <div className="flex flex-col gap-3 md:min-h-0 md:flex-1 lg:flex-row lg:gap-5">
        <SettleOrderSummary order={order} />
        <div className="flex min-w-0 flex-col gap-3 md:min-h-0 md:flex-1 md:gap-4">
          {mode === 'print'
            ? <PrintPanel order={order} onClose={onClose} embedded={{ switcher, onLockChange, onPrintFailed }} />
            : <PaymentPanel order={order} onClose={onClose} embedded={{ mode, switcher, onLockChange, onPrintFailed }} />}
        </div>
      </div>}
    </DialogContent>
  </Dialog>
}
