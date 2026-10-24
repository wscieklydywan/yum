'use client'

import { useEffect, useState } from 'react'
import { Calculator, Check, ChefHat, Moon, Printer, Sun, TriangleAlert, Wine } from 'lucide-react'
import { runDailyFiscalReport, usePosnetConfigured } from './workshop-daily-fiscal-report'
import { toast } from 'sonner'
import { mutate as mutateCache } from 'swr'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { stationLabel, type RestaurantStatus, type Station } from '@/lib/restaurant-status'
import { updateRestaurant, useRestaurantStatus } from '@/lib/use-restaurant-status'
import { REPORTS_KEY } from './workshop-day-reports'
import { useStickyValue } from './use-dialog-session'

function useRestaurantUpdate() {
  const { status, mutate } = useRestaurantStatus({ realtime: true })
  const [pending, setPending] = useState(false)
  const run = async (body: Record<string, unknown>, success?: (next: RestaurantStatus) => string) => {
    setPending(true)
    try {
      const result = await updateRestaurant(body)
      await mutate(result.status, { revalidate: false })
      void mutateCache('/api/menu/catalog')
      void mutateCache(REPORTS_KEY)
      void mutateCache('/api/workshop/cash-report/status')
      if (success) toast.success(success(result.status))
      return result
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się zapisać zmian.')
      return null
    } finally {
      setPending(false)
    }
  }
  return { status, pending, run }
}

export function StationToggle({ station, compact = false }: { station: Station; compact?: boolean }) {
  const { status, pending, run } = useRestaurantUpdate()
  const field = station === 'kitchen' ? 'kitchenOpen' : 'barOpen'
  const open = status?.[field] ?? true
  const label = stationLabel(station)
  const Icon = station === 'kitchen' ? ChefHat : Wine

  return (
    <button
      type="button"
      role="switch"
      aria-checked={open}
      aria-label={`${label}: ${open ? 'przyjmuje zamówienia' : 'wyłączona'}`}
      disabled={!status || pending}
      onClick={() => void run({ [field]: !open }, (next) => `${label} ${next[field] ? 'włączon' : 'wyłączon'}${station === 'kitchen' ? 'a' : 'y'}`)}
      className={cn(
        'flex h-9 items-center gap-2 rounded-xl border px-2.5 text-xs font-bold transition-colors disabled:opacity-60',
        open ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span className={cn(compact && 'hidden md:inline')}>{label}</span>
      <span aria-hidden="true" className={cn('relative h-4 w-7 rounded-full transition-colors', open ? 'bg-emerald-600' : 'bg-red-400')}>
        <span className={cn('absolute top-0.5 size-3 rounded-full bg-white shadow transition-all', open ? 'left-3.5' : 'left-0.5')} />
      </span>
    </button>
  )
}

const activeOrdersLabel = (count: number) => count === 1 ? '1 aktywne zamówienie' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20) ? `${count} aktywne zamówienia` : `${count} aktywnych zamówień`

export const DAY_CLOSED_MESSAGE = 'Najpierw otwórz dzień.'
export const DAY_OPEN_REQUIRED_EVENT = 'workshop:day-open-required'

type DayConfirm = 'close' | 'close-active' | 'auto-closed'

export function DayControl({ onReport, onCloseDay, activeOrders = 0, cashReportPending = false }: { onReport?: () => void; onCloseDay?: (printFiscal: boolean) => void; activeOrders?: number; cashReportPending?: boolean }) {
  const { status, pending, run } = useRestaurantUpdate()
  const [confirm, setConfirm] = useState<DayConfirm | null>(null)
  const confirmShown = useStickyValue(confirm)
  const [hint, setHint] = useState(false)
  const dayOpen = status?.dayOpen ?? false
  const autoClosed = !dayOpen && !!status?.dayAutoClosed
  const posnetConfigured = usePosnetConfigured()
  const [selectFiscal, setSelectFiscal] = useState(false)
  const [selectCash, setSelectCash] = useState(true)
  const [fiscalPrinted, setFiscalPrinted] = useState(false)
  const [printingFiscal, setPrintingFiscal] = useState(false)
  const busy = pending || printingFiscal
  const fiscalAvailable = posnetConfigured === true && !fiscalPrinted

  // The printed flag survives closing the dialog so the daily report cannot be printed twice for the same day.
  useEffect(() => { if (!dayOpen) setFiscalPrinted(false) }, [dayOpen])

  useEffect(() => {
    let timer: number | undefined
    const show = () => {
      setHint(true)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setHint(false), 5000)
    }
    window.addEventListener(DAY_OPEN_REQUIRED_EVENT, show)
    return () => {
      window.removeEventListener(DAY_OPEN_REQUIRED_EVENT, show)
      window.clearTimeout(timer)
    }
  }, [])
  useEffect(() => { if (dayOpen) setHint(false) }, [dayOpen])

  const openDay = async (skipCashReport = false) => {
    const result = await run({ day: 'open', skipCashReport }, () => 'Dzień otwarty – można przyjmować zamówienia')
    if (result) setConfirm(null)
  }

  const submit = async () => {
    if (!confirm) return
    const wantsFiscal = selectFiscal && fiscalAvailable
    if (!wantsFiscal && !selectCash) return
    if (confirm === 'close' && activeOrders > 0) {
      setConfirm('close-active')
      return
    }
    if (wantsFiscal) {
      setPrintingFiscal(true)
      const printed = await runDailyFiscalReport()
      setPrintingFiscal(false)
      // A failed daily report keeps this dialog open so the cashier can retry.
      if (!printed) return
      setFiscalPrinted(true)
      setSelectFiscal(false)
      toast.success(selectCash
        ? 'Raport dobowy wydrukowany. Zapisz teraz raport kasowy, aby zamknąć dzień.'
        : 'Raport dobowy wydrukowany. Okno pozostaje otwarte.')
      return
    }
    setConfirm(null)
    onCloseDay?.(fiscalPrinted)
  }

  const handleClick = () => {
    setHint(false)
    if (dayOpen) {
      setSelectFiscal(posnetConfigured === true && !fiscalPrinted)
      setSelectCash(true)
      setConfirm('close')
    } else if (autoClosed && cashReportPending) setConfirm('auto-closed')
    else if (cashReportPending) onReport?.()
    else void openDay()
  }

  const fiscalOption = (
    <fieldset className="flex flex-col gap-2" disabled={busy}>
      <legend className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#756e67]">Zaznacz, co chcesz zrobić</legend>
      <div className="grid grid-cols-2 gap-2">
        <CloseModeTile
          checked={fiscalPrinted || (selectFiscal && fiscalAvailable)}
          done={fiscalPrinted}
          disabled={!fiscalAvailable}
          onToggle={() => setSelectFiscal((value) => !value)}
          icon={<Printer className="size-5" aria-hidden="true" />}
          title="Fiskalny raport dobowy"
          hint={fiscalPrinted
            ? 'Wydrukowany na kasie POSNET.'
            : posnetConfigured === true ? 'Wydruk na kasie POSNET. Zamyka dobę fiskalną – nie da się cofnąć.'
            : posnetConfigured === null ? 'Sprawdzanie kasy fiskalnej…' : 'Kasa fiskalna niepodłączona – zrób raport ręcznie na kasie.'}
        />
        <CloseModeTile
          checked={selectCash}
          onToggle={() => setSelectCash((value) => !value)}
          icon={<Calculator className="size-5" aria-hidden="true" />}
          title="Raport kasowy"
          hint="Nasz wewnętrzny raport – liczysz gotówkę i zamykasz dzień."
        />
      </div>
    </fieldset>
  )
  const wantsFiscal = selectFiscal && fiscalAvailable
  const nothingSelected = !wantsFiscal && !selectCash
  const closeLabel = printingFiscal ? 'Drukowanie raportu dobowego…'
    : pending ? 'Zapisywanie…'
    : nothingSelected ? 'Zaznacz co najmniej jedno'
    : wantsFiscal ? 'Drukuj raport dobowy'
    : selectCash ? 'Przejdź do raportu kasowego'
    : null
  const label = dayOpen ? 'Zamknij dzień' : autoClosed && cashReportPending ? 'Dzień niezamknięty' : cashReportPending ? 'Uzupełnij raport kasowy' : 'Otwórz dzień'
  const closedAtLabel = status?.dayClosedAt ? formatWarsawDateTime(status.dayClosedAt) : null

  return <>
    <div className="relative">
      <button
        type="button"
        disabled={!status || pending}
        title={!dayOpen && closedAtLabel ? `Ostatnio zamknięty: ${closedAtLabel}` : undefined}
        aria-describedby={hint ? 'day-open-hint' : undefined}
        onClick={handleClick}
        className={cn(
          'flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-bold transition-colors disabled:opacity-60',
          dayOpen ? 'border border-[#e8e3dd] bg-white text-[#36312d] hover:bg-[#f7f3ef]' : cashReportPending ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-emerald-600 text-white hover:bg-emerald-700',
          hint && 'ring-4 ring-emerald-300',
        )}
      >
        {dayOpen ? <Moon className="size-4" aria-hidden="true" /> : cashReportPending ? <TriangleAlert className="size-4" aria-hidden="true" /> : <Sun className="size-4" aria-hidden="true" />}
        <span className="hidden sm:inline">{label}</span>
        <span className="sr-only sm:hidden">{label}</span>
      </button>
      {hint && (
        <div id="day-open-hint" role="alert" className="absolute right-0 top-full z-50 mt-2 w-max max-w-56 rounded-xl bg-[#211e1b] px-3 py-2 text-xs font-semibold text-white shadow-lg">
          <span aria-hidden="true" className="absolute -top-1 right-4 size-2 rotate-45 bg-[#211e1b]" />
          {cashReportPending ? 'Najpierw uzupełnij raport kasowy i otwórz dzień.' : 'Najpierw otwórz dzień – wtedy zaakceptujesz zamówienie.'}
        </div>
      )}
    </div>

    <Dialog open={!!confirm} onOpenChange={(open) => { if (!open && !busy) setConfirm(null) }}>
      <DialogContent className="workshop-dashboard sm:max-w-sm">
        {confirmShown === 'auto-closed' ? <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><TriangleAlert className="size-5 shrink-0 text-amber-500" aria-hidden="true" />Poprzedni dzień nie był zamknięty</DialogTitle>
            <DialogDescription>
              Nikt nie zamknął dnia, więc zamknął się sam o północy{closedAtLabel ? ` (${closedAtLabel})` : ''}. Brakuje raportu kasowego – najlepiej zrobić go teraz, żeby zgadzała się gotówka w szufladzie.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => void openDay(true)}>{pending ? 'Otwieranie…' : 'Kontynuuj mimo to'}</Button>
            <Button disabled={busy} onClick={() => { setConfirm(null); onReport?.() }}>Zrób raport kasowy</Button>
          </DialogFooter>
        </> : confirmShown === 'close-active' ? <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><TriangleAlert className="size-5 shrink-0 text-destructive" aria-hidden="true" />Są aktywne zamówienia</DialogTitle>
            <DialogDescription>
              W zakładce Zamówienia jest jeszcze {activeOrdersLabel(activeOrders)}. Upewnij się, że wszystkie są wydane i opłacone. Na pewno chcesz zamknąć dzień?
            </DialogDescription>
          </DialogHeader>
          {fiscalOption}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setConfirm(null)}>Wróć do zamówień</Button>
            <Button variant="destructive" onClick={() => void submit()} disabled={busy || nothingSelected}>{closeLabel ?? 'Tak, przejdź do raportu kasowego'}</Button>
          </DialogFooter>
        </> : <>
          <DialogHeader>
            <DialogTitle>Zamknąć dzień?</DialogTitle>
            <DialogDescription>
              Wybierz jeden lub oba raporty. Wydruk raportu dobowego nie zamknie tego okna. Potem przejdziesz do raportu kasowego; dzień zamknie się po jego zapisaniu.
            </DialogDescription>
          </DialogHeader>
          {fiscalOption}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setConfirm(null)}>{fiscalPrinted ? 'Zamknij' : 'Anuluj'}</Button>
            <Button onClick={() => void submit()} disabled={busy || nothingSelected}>{closeLabel ?? 'Przejdź do raportu kasowego'}</Button>
          </DialogFooter>
        </>}
      </DialogContent>
    </Dialog>
  </>
}

function CloseModeTile({ checked, done = false, disabled = false, onToggle, icon, title, hint }: { checked: boolean; done?: boolean; disabled?: boolean; onToggle: () => void; icon: React.ReactNode; title: string; hint: string }) {
  const active = checked && !disabled
  return (
    <label className={cn(
      'relative flex flex-col gap-2 rounded-xl border p-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary',
      done ? 'cursor-default border-emerald-300 bg-emerald-50'
        : disabled ? 'cursor-not-allowed border-[#e5ded6] bg-[#f7f3ef] opacity-60'
        : active ? 'cursor-pointer border-primary bg-primary/5 ring-1 ring-primary'
        : 'cursor-pointer border-[#e5ded6] bg-white hover:bg-[#f7f3ef]',
    )}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} className="sr-only" />
      <span className="flex items-start justify-between gap-2">
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', done ? 'bg-emerald-600 text-white' : active ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary')}>{icon}</span>
        <span aria-hidden="true" className={cn('grid size-5 shrink-0 place-items-center rounded-md border-2', done ? 'border-emerald-600 bg-emerald-600 text-white' : active ? 'border-primary bg-primary text-primary-foreground' : 'border-[#cfc6bc] bg-white')}>
          {(active || done) && <Check className="size-3.5" strokeWidth={3} />}
        </span>
      </span>
      <span className="min-w-0">
        <span className="block font-bold leading-tight text-[#2b2622]">{title}</span>
        <span className={cn('mt-1 block text-[11px] leading-snug', done ? 'font-semibold text-emerald-700' : 'text-[#756e67]')}>{hint}</span>
      </span>
    </label>
  )
}

const formatWarsawDateTime = (iso: string) => new Date(iso).toLocaleString('pl-PL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' })

const formatWarsawTime = (iso: string) => new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' })

export function OrderingBanner({ canOverride = false }: { canOverride?: boolean }) {
  const { status, pending, run } = useRestaurantUpdate()
  if (!status) return null

  if (status.overrideActive && status.orderingOverrideUntil) {
    return (
      <div role="status" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[12px] font-semibold text-emerald-800 sm:mb-4 md:text-sm">
        <span>Zamówienia online włączone ręcznie poza godzinami otwarcia. Od {formatWarsawTime(status.orderingOverrideUntil)} obowiązują zwykłe godziny.</span>
        {canOverride && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => void run({ orderingOverride: false }, () => 'Zamówienia online wstrzymane do godzin otwarcia')} className="h-8 border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100 lg:h-9 lg:px-4 lg:text-sm">
            Wyłącz
          </Button>
        )}
      </div>
    )
  }

  if (status.acceptingOrders) return null
  const outsideHours = status.dayOpen && !status.withinHours
  return (
    <div role="status" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] font-semibold text-red-800 sm:mb-4 md:text-sm">
      <span>Zamówienia online wstrzymane.{status.reason ? ` ${status.reason}` : ''}</span>
      {canOverride && outsideHours && (
        <Button size="sm" disabled={pending} onClick={() => void run({ orderingOverride: true }, () => 'Zamówienia online aktywne – wyłączą się same o otwarciu')} className="h-8 bg-emerald-600 text-white hover:bg-emerald-700 lg:h-9 lg:px-4 lg:text-sm">
          {pending ? 'Zapisywanie…' : 'Aktywuj zamówienia'}
        </Button>
      )}
    </div>
  )
}
