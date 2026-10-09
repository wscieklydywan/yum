'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Calculator, LoaderCircle, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ASSIGNABLE_METHODS, cashMethodLabels, expectedCashFor, type CashReportRecord, type CashReportResponse } from '@/lib/cash-report-types'
import { printCashReport } from '@/lib/cash-report-print'

const CASH_REPORT_KEY = '/api/workshop/cash-report'

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

export function WorkshopCashReportButton({ onOpen }: { onOpen: () => void }) {
  return <Button variant="outline" onClick={onOpen} className="h-9 shrink-0 rounded-xl px-3 text-xs font-bold"><Calculator data-icon="inline-start" />Raport kasowy</Button>
}

export function WorkshopCashReportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    {/* Preventing auto-focus keeps the on-screen keyboard closed on tablets until the cashier taps a field. */}
    <DialogContent initialFocus={false} className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
      {open && <CashReportBody onDone={() => onOpenChange(false)} />}
    </DialogContent>
  </Dialog>
}

function CashReportBody({ onDone }: { onDone: () => void }) {
  const { data, error, isLoading, mutate } = useSWR(CASH_REPORT_KEY, fetchReport, { refreshInterval: 30_000 })
  const [openingCash, setOpeningCash] = useState('0')
  const [countedCash, setCountedCash] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [assigning, setAssigning] = useState<string | null>(null)

  const opening = toAmount(openingCash)
  const counted = toAmount(countedCash)
  const expected = data ? expectedCashFor(data.summary, Number.isFinite(opening) ? opening : 0) : 0
  const difference = Number.isFinite(counted) ? Math.round((counted - expected) * 100) / 100 : null
  const canSave = !!data && Number.isFinite(counted) && counted >= 0 && Number.isFinite(opening) && opening >= 0 && !saving

  async function assign(orderId: string, method: string) {
    setAssigning(orderId)
    const response = await fetch(CASH_REPORT_KEY, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, method }) }).catch(() => null)
    setAssigning(null)
    if (!response?.ok) { toast.error('Nie udało się zapisać formy płatności.'); return }
    await mutate()
  }

  async function save() {
    if (!canSave) return
    setSaving(true)
    const response = await fetch(CASH_REPORT_KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ openingCash: opening, countedCash: counted, note }) }).catch(() => null)
    setSaving(false)
    const result = response ? await response.json().catch(() => null) : null
    if (!response?.ok || !result?.report) { toast.error(result?.error ?? 'Nie udało się zapisać raportu.'); return }
    toast.success('Raport zapisany')
    await mutate()
    await print(result.report as CashReportRecord)
    onDone()
  }

  return <>
    <DialogHeader>
      <DialogTitle>Raport kasowy</DialogTitle>
      <DialogDescription>{data ? `Od ${dateTime(data.periodFrom)} do teraz. Liczony z zamówień – niezależnie od tego, czy paragon został wydrukowany.` : 'Podsumowanie zmiany na barze.'}</DialogDescription>
    </DialogHeader>

    {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error.message}</p>}
    {isLoading && <p className="flex items-center gap-2 text-sm text-[#847c74]"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Liczenie…</p>}

    {data && <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Sprzedaż', value: money(data.summary.sales), hint: `${data.summary.orders} zam.` },
          { label: 'Zwroty', value: `-${money(data.summary.refundsValue)}`, hint: `${data.summary.refunds} szt.` },
          { label: 'Razem netto', value: money(data.summary.net), strong: true },
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
          <thead className="bg-[#f7f3ef] text-left text-[11px] text-[#756e67]"><tr><th scope="col" className="px-3 py-2 font-semibold">Forma płatności</th><th scope="col" className="px-3 py-2 text-right font-semibold">Zam.</th><th scope="col" className="px-3 py-2 text-right font-semibold">Zwroty</th><th scope="col" className="px-3 py-2 text-right font-semibold">Netto</th></tr></thead>
          <tbody className="divide-y divide-[#f0ebe5]">
            {data.summary.methods.map((entry) => <tr key={entry.method}>
              <th scope="row" className="px-3 py-2 text-left font-semibold">{cashMethodLabels[entry.method]}</th>
              <td className="px-3 py-2 text-right tabular-nums">{entry.orders}</td>
              <td className="px-3 py-2 text-right tabular-nums text-[#756e67]">{entry.refundsValue ? `-${money(entry.refundsValue)}` : '—'}</td>
              <td className="px-3 py-2 text-right font-bold tabular-nums">{money(entry.net)}</td>
            </tr>)}
          </tbody>
        </table>
        <p className="border-t border-[#f0ebe5] px-3 py-2 text-[11px] text-[#756e67]">Rabaty {money(data.summary.discounts)} · Dostawy {money(data.summary.deliveryFees)} · Wydrukowane paragony: {data.summary.printedReceipts}</p>
      </div>

      {data.unassigned.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
        <p className="text-[13px] font-bold text-amber-950">Bez formy płatności: {data.unassigned.length} zam. · {money(data.summary.unassignedValue)}</p>
        <p className="mt-0.5 text-[11px] text-amber-900">Wskaż, jak zapłacono, żeby kwota trafiła do właściwej rubryki.</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {data.unassigned.map((order) => <li key={order.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[12px]">
            <span className="font-bold">#{order.number}</span>
            <span className="text-[#756e67]">{order.type} · {dateTime(order.createdAt)}</span>
            <span className="ml-auto font-bold tabular-nums">{money(order.total)}</span>
            <span className="flex gap-1" role="group" aria-label={`Forma płatności zamówienia ${order.number}`}>
              {ASSIGNABLE_METHODS.map((method) => <button key={method} type="button" disabled={assigning === order.id} onClick={() => void assign(order.id, method)} className="h-7 rounded-md border border-[#e5ded6] px-2 text-[11px] font-semibold hover:bg-[#f7f3ef] disabled:opacity-50">{cashMethodLabels[method]}</button>)}
            </span>
          </li>)}
        </ul>
      </div>}

      <div className="grid gap-3 rounded-xl border border-[#e5ded6] bg-white p-3 sm:grid-cols-2">
        <label className="text-[12px] font-semibold">Stan początkowy szuflady (zł)
          <input inputMode="decimal" value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#e5ded6] px-3 font-normal tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary" />
        </label>
        <label className="text-[12px] font-semibold">Policzona gotówka (zł)
          <input inputMode="decimal" value={countedCash} onChange={(event) => setCountedCash(event.target.value)} placeholder="np. 1250,50" className="mt-1 h-10 w-full rounded-lg border border-[#e5ded6] px-3 font-normal tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary" />
        </label>
        <div className="flex items-center justify-between rounded-lg bg-[#f7f3ef] px-3 py-2 text-[13px]"><span>Oczekiwana gotówka</span><b className="tabular-nums">{money(expected)}</b></div>
        <div className={cn('flex items-center justify-between rounded-lg px-3 py-2 text-[13px]', difference === null ? 'bg-[#f7f3ef]' : difference === 0 ? 'bg-emerald-50 text-emerald-900' : difference > 0 ? 'bg-sky-50 text-sky-900' : 'bg-red-50 text-red-800')} role="status">
          <span>{difference === null ? 'Różnica' : difference === 0 ? 'Zgadza się' : difference > 0 ? 'Nadwyżka' : 'Brak'}</span>
          <b className="tabular-nums">{difference === null ? '—' : `${difference > 0 ? '+' : ''}${money(difference)}`}</b>
        </div>
        <label className="text-[12px] font-semibold sm:col-span-2">Uwagi (opcjonalnie)
          <textarea value={note} maxLength={500} rows={2} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full rounded-lg border border-[#e5ded6] px-3 py-2 font-normal outline-none focus-visible:ring-2 focus-visible:ring-primary" />
        </label>
      </div>

      {data.history.length > 0 && <details className="rounded-xl border border-[#e5ded6] bg-white p-3 text-[12px]">
        <summary className="cursor-pointer font-semibold">Poprzednie raporty ({data.history.length})</summary>
        <ul className="mt-2 flex flex-col divide-y divide-[#f0ebe5]">
          {data.history.map((report) => <li key={report.id} className="flex items-center gap-2 py-1.5">
            <span className="min-w-0 flex-1 truncate">{dateTime(report.createdAt)} · netto {money(report.summary.net)} · różnica <b className={report.difference < 0 ? 'text-red-700' : undefined}>{money(report.difference)}</b></span>
            <button type="button" onClick={() => void print(report)} aria-label={`Drukuj raport z ${dateTime(report.createdAt)}`} className="grid size-7 place-items-center rounded-md border border-[#e5ded6] hover:bg-[#f7f3ef]"><Printer className="size-3.5" aria-hidden="true" /></button>
          </li>)}
        </ul>
      </details>}
    </div>}

    <DialogFooter>
      <Button variant="outline" onClick={onDone}>Zamknij</Button>
      <Button onClick={() => void save()} disabled={!canSave}>{saving ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Printer data-icon="inline-start" />}Zapisz i drukuj</Button>
    </DialogFooter>
  </>
}
