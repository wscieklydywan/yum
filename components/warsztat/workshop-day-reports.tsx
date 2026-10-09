'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { cn } from '@/lib/utils'
import type { DayReport } from '@/lib/day-report-types'

export const REPORTS_KEY = '/api/workshop/reports'

const money = (value: number) => value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })
const dateTime = (value: string) => new Date(value).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' })
const dayLabel = (value: string) => new Date(value).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Warsaw' })

async function fetchReports(url: string): Promise<{ live: DayReport | null; reports: DayReport[] }> {
  const response = await fetch(url, { credentials: 'same-origin' })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? 'Nie udało się pobrać raportów.')
  return result
}

export function WorkshopDayReports() {
  const { data, error, isLoading } = useSWR(REPORTS_KEY, fetchReports, { refreshInterval: 60_000 })
  const all = data ? [...(data.live ? [data.live] : []), ...data.reports] : []
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = all.find((report) => report.id === selectedId) ?? all[0]

  return (
    <section className="motion-safe:animate-in motion-safe:fade-in-0 duration-300">
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b827a]">Raporty</p>
        <h1 className="mt-1 text-[21px] font-extrabold tracking-tight sm:text-[24px]">Raporty dnia</h1>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error.message}</p>}
      {isLoading && <p className="text-sm text-[#847c74]">Wczytywanie raportów…</p>}
      {data && all.length === 0 && <div className="rounded-2xl border border-dashed border-[#d8d0c7] bg-white/50 px-4 py-12 text-center text-sm text-[#847c74]">Brak raportów. Raport tworzy się automatycznie po kliknięciu „Zamknij dzień”.</div>}

      {selected && <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Lista raportów" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {all.map((report) => <button key={report.id} type="button" aria-pressed={report.id === selected.id} onClick={() => setSelectedId(report.id)} className={cn('shrink-0 rounded-xl border px-3 py-2.5 text-left transition-colors', report.id === selected.id ? 'border-primary bg-white shadow-sm' : 'border-[#e5ded6] bg-white/60 hover:bg-white')}>
            <p className="flex items-center gap-2 text-[13px] font-bold capitalize">{dayLabel(report.openedAt)}{report.live && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-800">Na żywo</span>}{report.pending && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-900">Dopisuje</span>}</p>
            <p className="mt-0.5 text-[11px] text-[#756e67] tabular-nums">{money(report.summary.netRevenue)} · {report.summary.orders} zam.</p>
          </button>)}
        </nav>
        <ReportDetails report={selected} />
      </div>}
    </section>
  )
}

function ReportDetails({ report }: { report: DayReport }) {
  const { summary } = report
  const maxHour = Math.max(1, ...summary.byHour.map((entry) => entry.orders))
  const stats = [
    { label: 'Obrót', value: money(summary.revenue) },
    { label: 'Zwroty', value: `${money(summary.refundsValue)}`, hint: `${summary.refunds} szt.` },
    { label: 'Obrót netto', value: money(summary.netRevenue), strong: true },
    { label: 'Zamówienia', value: String(summary.orders), hint: `śr. ${money(summary.averageOrder)}` },
    { label: 'Anulowane', value: String(summary.cancelledOrders), hint: money(summary.cancelledValue) },
    { label: 'Rabaty', value: money(summary.discounts) },
    { label: 'Dostawy', value: money(summary.deliveryFees) },
    { label: 'Paragony', value: String(summary.receipts), hint: money(summary.receiptsValue) },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="text-[12px] text-[#756e67]">{report.live ? 'Dzień trwa · od ' : 'Otwarty '}{dateTime(report.openedAt)}{report.live ? '' : ` · zamknięty ${dateTime(report.closedAt)}`}</p>
      {(report.pending || (summary.lateOrders ?? 0) > 0 || (summary.openOrders ?? 0) > 0) && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] text-amber-950">
        {report.pending && <p className="font-semibold">Raport jest jeszcze otwarty – zamówienia realizowane lub dodane po zamknięciu dopisują się do tego dnia aż do otwarcia kolejnego.</p>}
        {(summary.lateOrders ?? 0) > 0 && <p>Po zamknięciu dnia dopisano {summary.lateOrders} zam. na {money(summary.lateRevenue ?? 0)}.</p>}
        {(summary.openOrders ?? 0) > 0 && <p>W realizacji wciąż: {summary.openOrders} zam. (wliczone do obrotu).</p>}
      </div>}
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {stats.map((stat) => <div key={stat.label} className={cn('rounded-2xl border p-3.5', stat.strong ? 'border-primary/30 bg-primary/5' : 'border-[#e5ded6] bg-white')}>
          <dt className="text-[11px] font-semibold text-[#756e67]">{stat.label}</dt>
          <dd className="mt-1 text-lg font-extrabold tabular-nums">{stat.value}</dd>
          {stat.hint && <dd className="text-[11px] text-[#8b827a] tabular-nums">{stat.hint}</dd>}
        </div>)}
      </dl>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-[#e5ded6] bg-white p-4">
          <h2 className="text-[15px] font-bold">Najpopularniejsze pozycje</h2>
          {summary.topProducts.length === 0 ? <p className="mt-3 text-sm text-[#847c74]">Brak sprzedaży.</p> : <ol className="mt-3 flex flex-col divide-y divide-[#f0ebe5]">
            {summary.topProducts.map((product, index) => <li key={product.name} className="flex items-center gap-3 py-2 text-[13px]">
              <span className="w-5 text-right font-bold text-[#8b827a] tabular-nums">{index + 1}.</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{product.name}</span>
              <span className="tabular-nums text-[#756e67]">{product.quantity} szt.</span>
              <span className="w-24 text-right font-bold tabular-nums">{money(product.revenue)}</span>
            </li>)}
          </ol>}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-[#e5ded6] bg-white p-4">
            <h2 className="text-[15px] font-bold">Typ zamówienia</h2>
            <ul className="mt-3 flex flex-col gap-2 text-[13px]">
              {summary.byType.map((entry) => <li key={entry.name} className="flex justify-between gap-3"><span>{entry.name}</span><span className="tabular-nums text-[#756e67]">{entry.orders} zam. · <b className="text-[#201d1a]">{money(entry.revenue)}</b></span></li>)}
              {summary.byType.length === 0 && <li className="text-[#847c74]">Brak danych.</li>}
            </ul>
          </div>
          <div className="rounded-2xl border border-[#e5ded6] bg-white p-4">
            <h2 className="text-[15px] font-bold">Zamówienia wg godzin</h2>
            {summary.byHour.length === 0 ? <p className="mt-3 text-sm text-[#847c74]">Brak danych.</p> : <ul className="mt-3 flex h-28 items-end gap-1.5">
              {summary.byHour.map((entry) => <li key={entry.hour} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-bold tabular-nums">{entry.orders}</span>
                <span className="w-full rounded-t-md bg-primary" style={{ height: `${(entry.orders / maxHour) * 72}px` }} aria-hidden="true" />
                <span className="text-[10px] text-[#8b827a] tabular-nums">{entry.hour}</span>
              </li>)}
            </ul>}
          </div>
        </div>
      </div>
    </div>
  )
}
