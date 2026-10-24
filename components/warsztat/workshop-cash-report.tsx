'use client'

import { useState } from 'react'
import useSWR, { mutate as mutateCache } from 'swr'
import { toast } from 'sonner'
import { CalendarDays, Calculator, LoaderCircle, Printer, Save, Wallet } from 'lucide-react'
import { CashMovementDialog, CashMovementList, movementStyles, useCashMovements } from './workshop-cash-movements'
import type { CashMovementKind } from '@/lib/cash-report-types'
import { usePosnetConfigured, WorkshopFiscalReportDialogs, type FiscalReportMode } from './workshop-daily-fiscal-report'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ASSIGNABLE_METHODS, cashMethodLabels, expectedCashFor, type CashReportRecord, type CashReportResponse } from '@/lib/cash-report-types'
import { printCashReport } from '@/lib/cash-report-print'
import { CashReportPaymentFix } from './cash-report-payment-fix'
import { orderSources, type OrderSource } from './order-data'
import { REPORTS_KEY } from './workshop-day-reports'
import { RESTAURANT_STATUS_KEY } from '@/lib/use-restaurant-status'

const CASH_REPORT_KEY = '/api/workshop/cash-report'
export const CASH_REPORT_STATUS_KEY = '/api/workshop/cash-report/status'

async function fetchStatus(url: string): Promise<{ pending: boolean }> {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (!response.ok) throw new Error('Nie udało się sprawdzić raportu kasowego.')
  return response.json()
}

/** True when the last closed day still has no cash report – the bar must fill it before opening the next day. */
export function useCashReportPending(enabled: boolean) {
  const { data } = useSWR(enabled ? CASH_REPORT_STATUS_KEY : null, fetchStatus, { refreshInterval: 60_000 })
  return data?.pending ?? false
}

const money = (value: number) => value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })
const dateTime = (value: string) => new Date(value).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' })
const toAmount = (value: string) => (value.trim() === '' ? NaN : Number(value.replace(',', '.')))

async function fetchReport(url: string): Promise<CashReportResponse> {
  const response = await fetch(url, { credentials: 'same-origin' })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? 'Nie udało się pobrać raportu.')
  return result
}

async function print(report: CashReportRecord) {
  try {
    const target = await printCashReport(report)
    toast.success(target === 'fiscal' ? 'Raport wysłany do kasy fiskalnej' : 'Raport wysłany do drukarki')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Nie udało się wydrukować raportu.')
  }
}

export function WorkshopCashButton({ onOpenReport, className }: { onOpenReport: () => void; className?: string }) {
  const posnetConfigured = usePosnetConfigured()
  const [menuOpen, setMenuOpen] = useState(false)
  const [movementKind, setMovementKind] = useState<CashMovementKind | null>(null)
  const [fiscalMode, setFiscalMode] = useState<FiscalReportMode | null>(null)
  const { data: movementsData, error: movementsError, isLoading: movementsLoading } = useCashMovements(menuOpen)
  const movements = movementsData?.movements ?? []
  const cashOut = movements.filter((entry) => entry.kind === 'withdrawal').reduce((sum, entry) => sum + entry.amount, 0)
  const cashIn = movements.filter((entry) => entry.kind === 'deposit').reduce((sum, entry) => sum + entry.amount, 0)

  const choose = (next: 'cash' | CashMovementKind | FiscalReportMode) => {
    setMenuOpen(false)
    if (next === 'cash') onOpenReport()
    else if (next === 'withdrawal' || next === 'deposit') setMovementKind(next)
    else setFiscalMode(next)
  }

  return <>
    <Button variant="outline" onClick={() => setMenuOpen(true)} className={cn(className, 'bg-white hover:bg-white/90')}><Wallet data-icon="inline-start" />Kasa</Button>
    <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl lg:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Kasa</DialogTitle>
          <DialogDescription>Wpłaty i wypłaty gotówki z szuflady oraz raporty. Każda operacja trafia do raportu kasowego zmiany.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] sm:gap-5">
        <div className="flex min-w-0 flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          <MovementTile kind="withdrawal" title="Wypłać" hint="np. 200 zł na paliwo" onClick={() => choose('withdrawal')} />
          <MovementTile kind="deposit" title="Wpłać" hint="np. rozmienienie" onClick={() => choose('deposit')} />
        </div>

        <section aria-labelledby="cash-movements-today" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 id="cash-movements-today" className="text-[12px] font-bold uppercase tracking-wide text-[#756e67]">Operacje tej zmiany</h3>
            {movements.length > 0 && <span className="text-[11px] tabular-nums text-[#756e67]"><span className="text-emerald-700">+{money(cashIn)}</span> · <span className="text-red-700">-{money(cashOut)}</span></span>}
          </div>
          {movementsError && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-700">{movementsError.message}</p>}
          {movementsLoading ? <p className="flex items-center gap-2 text-[12px] text-[#847c74]"><LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />Wczytywanie…</p>
            : !movementsError && <div className="max-h-48 overflow-y-auto sm:max-h-64"><CashMovementList movements={movements} empty="Brak wpłat i wypłat od ostatniego raportu." /></div>}
        </section>
        </div>

        <section aria-labelledby="cash-reports" className="flex min-w-0 flex-col gap-2 sm:border-l sm:border-[#efe9e2] sm:pl-5">
          <h3 id="cash-reports" className="text-[12px] font-bold uppercase tracking-wide text-[#756e67]">Raporty</h3>
          <ReportChoice icon={Calculator} title="Raport kasowy zmiany" hint="Podsumowanie i liczenie gotówki w szufladzie" onClick={() => choose('cash')} />
          {posnetConfigured && <>
            <ReportChoice icon={Printer} title="Fiskalny raport dobowy" hint="Zamyka dobę na kasie fiskalnej" onClick={() => choose('daily')} />
            <ReportChoice icon={CalendarDays} title="Fiskalny raport miesięczny" hint="Wydruk za wybrany miesiąc" onClick={() => choose('monthly')} />
          </>}
        </section>
        </div>
      </DialogContent>
    </Dialog>
    <CashMovementDialog kind={movementKind} onClose={() => setMovementKind(null)} />
    {posnetConfigured && <WorkshopFiscalReportDialogs mode={fiscalMode} onModeChange={setFiscalMode} />}
  </>
}

function MovementTile({ kind, title, hint, onClick }: { kind: CashMovementKind; title: string; hint: string; onClick: () => void }) {
  const style = movementStyles[kind]
  const Icon = style.icon
  return <button type="button" onClick={onClick} className="flex flex-col items-start gap-2 rounded-xl border border-[#e5ded6] bg-white p-3 text-left transition-colors hover:bg-[#f7f3ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
    <span className={cn('grid size-10 place-items-center rounded-xl', style.tone)}><Icon className="size-5" aria-hidden="true" /></span>
    <span>
      <span className="block text-sm font-bold">{title}</span>
      <span className="block text-[11px] text-[#756e67]">{hint}</span>
    </span>
  </button>
}

function ReportChoice({ icon: Icon, title, hint, onClick }: { icon: typeof Printer; title: string; hint: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex items-center gap-3 rounded-xl border border-[#e5ded6] bg-white px-3 py-3 text-left transition-colors hover:bg-[#f7f3ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-[18px]" aria-hidden="true" /></span>
    <span className="min-w-0">
      <span className="block text-sm font-bold">{title}</span>
      <span className="block text-[11px] text-[#756e67]">{hint}</span>
    </span>
  </button>
}

export function WorkshopCashReportDialog({ open, onOpenChange, required = false, closeDay = false, fiscalPrinted = false }: { open: boolean; onOpenChange: (open: boolean) => void; required?: boolean; closeDay?: boolean; fiscalPrinted?: boolean }) {
  return <Dialog open={open} onOpenChange={(next) => { if (!next && required) return; onOpenChange(next) }}>
    {/* Preventing auto-focus keeps the on-screen keyboard closed on tablets until the cashier taps a field. */}
    <DialogContent initialFocus={false} showCloseButton={!required} className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
      {open && <CashReportBody required={required} closeDay={closeDay} fiscalPrinted={fiscalPrinted} onDone={() => onOpenChange(false)} />}
    </DialogContent>
  </Dialog>
}

function CashReportBody({ onDone, required, closeDay, fiscalPrinted }: { onDone: () => void; required: boolean; closeDay: boolean; fiscalPrinted: boolean }) {
  const { data, error, isLoading, mutate } = useSWR(CASH_REPORT_KEY, fetchReport)
  const [openingCash, setOpeningCash] = useState('')
  const [countedCash, setCountedCash] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [printAfterSave, setPrintAfterSave] = useState(true)

  const opening = toAmount(openingCash)
  const counted = toAmount(countedCash)
  const expected = data ? expectedCashFor(data.summary, Number.isFinite(opening) ? opening : 0) : 0
  const difference = Number.isFinite(counted) ? Math.round((counted - expected) * 100) / 100 : null
  const canSave = !!data && Number.isFinite(counted) && counted >= 0 && Number.isFinite(opening) && opening >= 0 && !saving

  async function save() {
    if (!canSave) return
    setSaving(true)
    const response = await fetch(CASH_REPORT_KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ openingCash: opening, countedCash: counted, note, closeDay }) }).catch(() => null)
    const result = response ? await response.json().catch(() => null) : null
    if (!response?.ok || !result?.report) { setSaving(false); toast.error(result?.error ?? 'Nie udało się zapisać raportu.'); return }
    toast.success(closeDay ? 'Raport kasowy zapisany – dzień zamknięty' : 'Raport zapisany')
    if (printAfterSave) await print(result.report as CashReportRecord)
    setSaving(false)
    await Promise.all([
      mutate(),
      mutateCache(CASH_REPORT_STATUS_KEY),
      closeDay && mutateCache(RESTAURANT_STATUS_KEY),
      closeDay && mutateCache(REPORTS_KEY),
      closeDay && mutateCache('/api/menu/catalog'),
    ])
    onDone()
  }

  return <>
    <DialogHeader>
      <DialogTitle>{closeDay ? 'Zamknięcie dnia – raport kasowy' : 'Raport kasowy'}</DialogTitle>
      <DialogDescription>{data ? `Od ${dateTime(data.periodFrom)} do teraz. Liczony z zamówień – niezależnie od tego, czy paragon został wydrukowany.` : 'Podsumowanie zmiany na barze.'}</DialogDescription>
    </DialogHeader>

    {closeDay && <p role="status" className="rounded-xl border border-[#e5ded6] bg-[#f7f3ef] px-3 py-2 text-[13px] text-[#36312d]">Dzień zamknie się po zapisaniu raportu. Jeśli klikniesz „Anuluj”, dzień zostanie otwarty.</p>}

    {required && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] font-semibold text-amber-950">Dzień został zamknięty, ale raport kasowy nie jest jeszcze zapisany. Wpisz stan początkowy szuflady i policzoną gotówkę – bez tego nie da się otworzyć kolejnego dnia.</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error.message}</p>}
    {isLoading && <p className="flex items-center gap-2 text-sm text-[#847c74]"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Liczenie…</p>}

    {data && <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: 'Sprzedaż', value: money(data.summary.sales), hint: `${data.summary.orders} zam. wydanych` },
          { label: 'Paragony wydrukowane', value: String(data.summary.printedReceipts), hint: data.summary.pendingReceipts ? `${data.summary.pendingReceipts} niedokończ. · porównaj z dobowym` : 'porównaj z raportem dobowym' },
          { label: 'Zwroty', value: `-${money(data.summary.refundsValue)}`, hint: `${data.summary.refunds} szt.` },
          { label: 'Razem brutto (po zwrotach)', value: money(data.summary.net), strong: true },
          { label: 'Anulowane', value: String(data.summary.cancelledOrders), hint: money(data.summary.cancelledValue) },
        ].map((stat) => <div key={stat.label} className={cn('rounded-xl border p-3', stat.strong ? 'border-primary/30 bg-primary/5' : 'border-[#e5ded6] bg-white')}>
          <dt className="text-[11px] font-semibold text-[#756e67]">{stat.label}</dt>
          <dd className="mt-0.5 text-base font-extrabold tabular-nums">{stat.value}</dd>
          {stat.hint && <dd className="text-[11px] text-[#8b827a] tabular-nums">{stat.hint}</dd>}
        </div>)}
      </dl>

      <div className="overflow-hidden rounded-xl border border-[#e5ded6] bg-white">
        <table className="w-full text-[13px]">
          <caption className="sr-only">Formy płatności</caption>
          <thead className="bg-[#f7f3ef] text-left text-[11px] text-[#756e67]"><tr><th scope="col" className="px-3 py-2 font-semibold">Forma płatności</th><th scope="col" className="px-3 py-2 text-right font-semibold">Zam.</th><th scope="col" className="px-3 py-2 text-right font-semibold">Zwroty</th><th scope="col" className="px-3 py-2 text-right font-semibold">Brutto</th></tr></thead>
          <tbody className="divide-y divide-[#f0ebe5]">
            {data.summary.methods.map((entry) => <tr key={entry.method}>
              <th scope="row" className="px-3 py-2 text-left font-semibold">{cashMethodLabels[entry.method]}</th>
              <td className="px-3 py-2 text-right tabular-nums">{entry.orders}</td>
              <td className="px-3 py-2 text-right tabular-nums text-[#756e67]">{entry.refundsValue ? `-${money(entry.refundsValue)}` : '—'}</td>
              <td className="px-3 py-2 text-right font-bold tabular-nums">{money(entry.net)}</td>
            </tr>)}
          </tbody>
        </table>
        <p className="border-t border-[#f0ebe5] px-3 py-2 text-[11px] text-[#756e67]">Rabaty {money(data.summary.discounts)} · Dostawy {money(data.summary.deliveryFees)}</p>
      </div>

      {!!data.summary.platforms?.length && <div className="overflow-hidden rounded-xl border border-[#e5ded6] bg-white">
        <table className="w-full text-[13px]">
          <caption className="sr-only">Sprzedaż przez platformy</caption>
          <thead className="bg-[#f7f3ef] text-left text-[11px] text-[#756e67]"><tr><th scope="col" className="px-3 py-2 font-semibold">Platforma</th><th scope="col" className="px-3 py-2 text-right font-semibold">Zam.</th><th scope="col" className="px-3 py-2 text-right font-semibold">Brutto</th></tr></thead>
          <tbody className="divide-y divide-[#f0ebe5]">
            {data.summary.platforms.map((entry) => <tr key={entry.source}>
              <th scope="row" className="px-3 py-2 text-left font-semibold">{orderSources[entry.source as OrderSource]?.label ?? entry.source}</th>
              <td className="px-3 py-2 text-right tabular-nums">{entry.orders}</td>
              <td className="px-3 py-2 text-right font-bold tabular-nums">{money(entry.sales)}</td>
            </tr>)}
          </tbody>
        </table>
        <p className="border-t border-[#f0ebe5] px-3 py-2 text-[11px] text-[#756e67]">Rozbicie rubryki „Platformy” – zapłacone w aplikacjach, nie wchodzą do gotówki ani przelewów.</p>
      </div>}

      {data.mismatched.length > 0 && <section aria-labelledby="cash-mismatched" className="rounded-xl border border-red-200 bg-red-50 p-3">
        <h3 id="cash-mismatched" className="text-[13px] font-bold text-red-900">Rozbieżności z paragonem: {data.mismatched.length} zam.</h3>
        <p className="mt-0.5 text-[11px] text-red-800">Forma płatności na wydrukowanym paragonie różni się od zapisanej w systemie. Popraw ją – każda zmiana wymaga imienia i powodu.</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {data.mismatched.map((order) => <CashReportPaymentFix key={order.id} order={order} receiptMethod={order.receiptMethod} paymentMethod={order.paymentMethod} signerName={signerName} onSignerNameChange={setSignerName} onSaved={mutate} />)}
        </ul>
      </section>}

      {data.unassigned.length > 0 && <section aria-labelledby="cash-unassigned" className="rounded-xl border border-amber-200 bg-amber-50 p-3">
        <h3 id="cash-unassigned" className="text-[13px] font-bold text-amber-950">Bez formy płatności: {data.unassigned.length} zam. · {money(data.summary.unassignedValue)}</h3>
        <p className="mt-0.5 text-[11px] text-amber-900">Wskaż, jak zapłacono, żeby kwota trafiła do właściwej rubryki.</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {data.unassigned.map((order) => <CashReportPaymentFix key={order.id} order={order} signerName={signerName} onSignerNameChange={setSignerName} onSaved={mutate} />)}
        </ul>
      </section>}

      {!!data.summary.movements?.length && <section aria-labelledby="cash-report-movements" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 id="cash-report-movements" className="text-[13px] font-bold">Wpłaty i wypłaty z kasy</h3>
          <span className="text-[12px] tabular-nums"><span className="text-emerald-700">+{money(data.summary.cashIn ?? 0)}</span> · <span className="text-red-700">-{money(data.summary.cashOut ?? 0)}</span></span>
        </div>
        <CashMovementList movements={data.summary.movements} />
      </section>}

      <div className="grid gap-3 rounded-xl border border-[#e5ded6] bg-white p-3 sm:grid-cols-2">
        <label className="text-[12px] font-semibold">Stan początkowy szuflady (zł)
          <input inputMode="decimal" value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} placeholder="np. 300" className="mt-1 h-10 w-full rounded-lg border border-[#e5ded6] px-3 font-normal tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary" />
        </label>
        <label className="text-[12px] font-semibold">Policzona gotówka (zł)
          <input inputMode="decimal" value={countedCash} onChange={(event) => setCountedCash(event.target.value)} placeholder="np. 1250,50" className="mt-1 h-10 w-full rounded-lg border border-[#e5ded6] px-3 font-normal tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary" />
        </label>
        <div className="flex items-center justify-between rounded-lg bg-[#f7f3ef] px-3 py-2 text-[13px]"><span>Oczekiwana gotówka{data.summary.cashIn || data.summary.cashOut ? <span className="block text-[10px] text-[#756e67]">z wpłatami i wypłatami</span> : null}</span><b className="tabular-nums">{money(expected)}</b></div>
        <div className={cn('flex items-center justify-between rounded-lg px-3 py-2 text-[13px]', difference === null ? 'bg-[#f7f3ef]' : difference === 0 ? 'bg-emerald-50 text-emerald-900' : difference > 0 ? 'bg-sky-50 text-sky-900' : 'bg-red-50 text-red-800')} role="status">
          <span>{difference === null ? 'Różnica' : difference === 0 ? 'Zgadza się' : difference > 0 ? 'Nadwyżka' : 'Brak'}</span>
          <b className="tabular-nums">{difference === null ? '—' : `${difference > 0 ? '+' : ''}${money(difference)}`}</b>
        </div>
        <label className="text-[12px] font-semibold sm:col-span-2">Uwagi (opcjonalnie)
          <textarea value={note} maxLength={500} rows={2} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full rounded-lg border border-[#e5ded6] px-3 py-2 font-normal outline-none focus-visible:ring-2 focus-visible:ring-primary" />
        </label>
      </div>

      {closeDay && <div className={cn('flex items-start gap-3 rounded-xl border p-3 text-[13px]', fiscalPrinted ? 'border-emerald-200 bg-emerald-50' : 'border-[#e5ded6] bg-white')}>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">{fiscalPrinted ? <Printer className="size-[18px]" aria-hidden="true" /> : <Calculator className="size-[18px]" aria-hidden="true" />}</span>
        <span>
          <span className="block font-semibold">{fiscalPrinted ? 'Raport dobowy wydrukowany' : 'Tylko raport kasowy'}</span>
          <span className="block text-[11px] text-[#756e67]">
            {fiscalPrinted ? 'Doba fiskalna na kasie jest zamknięta. Teraz porównaj gotówkę i zapisz raport kasowy, żeby zamknąć dzień w systemie.' : 'Kasa fiskalna nic nie wydrukuje.'}
          </span>
        </span>
      </div>}

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#e5ded6] bg-white p-3 text-[13px]">
        <input type="checkbox" checked={printAfterSave} onChange={(event) => setPrintAfterSave(event.target.checked)} className="size-4 accent-primary" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Drukuj raport kasowy po zapisaniu</span>
          <span className="block text-[11px] text-[#756e67]">Niefiskalny wydruk z podsumowaniem zmiany i różnicą w gotówce.</span>
        </span>
        <Printer className="size-4 shrink-0 text-[#756e67]" aria-hidden="true" />
      </label>

      {data.history.length > 0 && <details className="rounded-xl border border-[#e5ded6] bg-white p-3 text-[12px]">
        <summary className="cursor-pointer font-semibold">Poprzednie raporty ({data.history.length})</summary>
        <ul className="mt-2 flex flex-col divide-y divide-[#f0ebe5]">
          {data.history.map((report) => <li key={report.id} className="flex items-center gap-2 py-1.5">
            <span className="min-w-0 flex-1 truncate">{dateTime(report.createdAt)} · brutto {money(report.summary.net)} · różnica <b className={report.difference < 0 ? 'text-red-700' : undefined}>{money(report.difference)}</b></span>
            <button type="button" onClick={() => void print(report)} aria-label={`Drukuj raport z ${dateTime(report.createdAt)}`} className="grid size-7 place-items-center rounded-md border border-[#e5ded6] hover:bg-[#f7f3ef]"><Printer className="size-3.5" aria-hidden="true" /></button>
          </li>)}
        </ul>
      </details>}
    </div>}

    <DialogFooter>
      {!required && <Button variant="outline" onClick={onDone}>{closeDay ? 'Anuluj' : 'Zamknij'}</Button>}
      <Button onClick={() => void save()} disabled={!canSave}>{saving ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />}{closeDay ? 'Zapisz i zamknij dzień' : 'Zapisz'}</Button>
    </DialogFooter>
  </>
}
