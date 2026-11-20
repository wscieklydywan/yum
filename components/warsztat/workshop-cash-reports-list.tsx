'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Printer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CashMovementList } from './workshop-cash-movements'
import type { CashReportRecord, FiscalDailyReportRecord } from '@/lib/cash-report-types'

export const CASH_REPORTS_LIST_KEY = '/api/workshop/reports/cash'

type CashReportsResponse = { reports: CashReportRecord[]; fiscal: FiscalDailyReportRecord[] }

const money = (value: number) => value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })
const signedMoney = (value: number) => (value > 0 ? `+${money(value)}` : money(value))
const dateTime = (value: string) => new Date(value).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' })
const shortDay = (value: string) => new Date(value).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Warsaw' })
const warsawDay = (value: string) => new Date(value).toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' })

async function fetchCashReports(url: string): Promise<CashReportsResponse> {
  const response = await fetch(url, { credentials: 'same-origin' })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? 'Nie udało się pobrać raportów kasowych.')
  return result
}

export function WorkshopBarCashReports() {
  return <section className="min-w-0 max-w-full motion-safe:animate-in motion-safe:fade-in-0 duration-300">
    <header className="mb-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b827a]">Raporty</p>
      <h1 className="mt-1 text-[22px] font-extrabold tracking-tight sm:text-[26px]">Raporty kasowe</h1>
      <p className="mt-1 text-[13px] text-[#756e67]">Ostatnie raporty kasowe z rozliczeniem gotówki.</p>
    </header>
    <WorkshopCashReportsList />
  </section>
}

export function WorkshopCashReportsList() {
  const { data, error, isLoading } = useSWR(CASH_REPORTS_LIST_KEY, fetchCashReports)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const reports = data?.reports ?? []
  const selected = reports.find((report) => report.id === selectedId) ?? reports[0]
  const fiscalFor = (report: CashReportRecord) => data?.fiscal.find((fiscal) => warsawDay(fiscal.printedAt) === warsawDay(report.periodTo)) ?? null

  return <>
    {error && <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error.message}</p>}
    {isLoading && <div className="h-44 animate-pulse rounded-3xl bg-[#e9e3dc]" aria-label="Wczytywanie raportów kasowych" />}
    {data && reports.length === 0 && <div className="rounded-3xl border border-dashed border-[#d8d0c7] bg-white/50 px-4 py-14 text-center text-sm text-[#847c74]">Brak raportów kasowych.</div>}

    {selected && <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
      <nav aria-label="Lista raportów kasowych" className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1 lg:sticky lg:top-4 lg:mx-0 lg:max-h-[calc(100dvh-8rem)] lg:flex-col lg:overflow-y-auto lg:px-0">
        {reports.map((report) => {
          const active = report.id === selected.id
          return <button key={report.id} type="button" aria-pressed={active} onClick={() => setSelectedId(report.id)} className={cn('shrink-0 rounded-2xl px-3.5 py-2.5 text-left transition-colors', active ? 'bg-[#201d1a] text-white shadow-md' : 'bg-white/70 text-[#201d1a] hover:bg-white')}>
            <p className="whitespace-nowrap text-[13px] font-bold capitalize">{shortDay(report.periodTo)}</p>
            <p className={cn('mt-0.5 whitespace-nowrap text-[11px] tabular-nums', active ? 'text-white/65' : 'text-[#756e67]')}>
              {money(report.countedCash)} · {report.difference === 0 ? 'zgodny' : <>różnica <span className={cn('font-bold', report.difference > 0 ? (active ? 'text-emerald-300' : 'text-emerald-700') : (active ? 'text-red-300' : 'text-red-600'))}>{signedMoney(report.difference)}</span></>}
            </p>
            <p className="mt-1 flex gap-1 text-[9px] font-bold uppercase">
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-emerald-600">✓ Kasowy</span>
              <span className={cn('rounded-full px-1.5 py-0.5', fiscalFor(report) ? 'bg-emerald-500/15 text-emerald-600' : active ? 'bg-white/10 text-white/50' : 'bg-[#ebe5de] text-[#8b827a]')}>{fiscalFor(report) ? '✓ ' : ''}Fiskalny</span>
            </p>
          </button>
        })}
      </nav>
      <CashReportDetails report={selected} fiscal={fiscalFor(selected)} />
    </div>}
  </>
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'good' | 'bad' }) {
  return <div className="flex items-baseline justify-between gap-3 border-b border-[#f1ece6] py-2 last:border-0">
    <dt className="text-[13px] text-[#756e67]">{label}</dt>
    <dd className={cn('text-[14px] tabular-nums', strong && 'font-extrabold', tone === 'good' && 'text-emerald-700', tone === 'bad' && 'text-red-600')}>{value}</dd>
  </div>
}

function CashReportDetails({ report, fiscal }: { report: CashReportRecord; fiscal: FiscalDailyReportRecord | null }) {
  const { summary } = report
  return <div className="flex min-w-0 flex-col gap-4">
    <section className="rounded-3xl bg-[#201d1a] p-5 text-white">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">Raport kasowy</p>
      <p className="mt-1 text-[13px] text-white/70">{dateTime(report.periodFrom)} – {dateTime(report.periodTo)}</p>
      <p className="mt-3 text-[30px] font-extrabold tabular-nums leading-none">{money(report.countedCash)}</p>
      <p className="mt-1 text-[12px] text-white/65">Policzona gotówka · zapisano {dateTime(report.createdAt)}</p>
      <p className={cn('mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold', fiscal ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/70')}>
        <Printer className="size-3.5" aria-hidden="true" />
        {fiscal ? `Raport fiskalny dobowy: ${dateTime(fiscal.printedAt)}${fiscal.source === 'manual' ? ' (odhaczony ręcznie)' : ''}` : 'Brak zapisanego raportu fiskalnego dobowego'}
      </p>
    </section>
    <section className="rounded-3xl border border-[#ebe5de] bg-white p-4 sm:p-5">
      <h2 className="mb-1 text-[13px] font-bold">Gotówka</h2>
      <dl>
        <Row label="Stan początkowy" value={money(report.openingCash)} />
        <Row label="Oczekiwana gotówka" value={money(report.expectedCash)} />
        <Row label="Policzona gotówka" value={money(report.countedCash)} strong />
        <Row label="Różnica" value={signedMoney(report.difference)} strong tone={report.difference >= 0 ? 'good' : 'bad'} />
      </dl>
    </section>
    {!!summary.movements?.length && <section aria-labelledby={`movements-${report.id}`} className="rounded-3xl border border-[#ebe5de] bg-white p-4 sm:p-5">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 id={`movements-${report.id}`} className="text-[13px] font-bold">Wpłaty i wypłaty z kasy</h2>
        <span className="text-[12px] tabular-nums"><span className="text-emerald-700">+{money(summary.cashIn ?? 0)}</span> · <span className="text-red-700">-{money(summary.cashOut ?? 0)}</span></span>
      </div>
      <CashMovementList movements={summary.movements} />
    </section>}
    <section className="rounded-3xl border border-[#ebe5de] bg-white p-4 sm:p-5">
      <h2 className="mb-1 text-[13px] font-bold">Sprzedaż w okresie</h2>
      <dl>
        <Row label="Zamówienia" value={String(summary.orders)} />
        <Row label="Sprzedaż" value={money(summary.sales)} />
        <Row label="Zwroty" value={`${summary.refunds} · ${money(summary.refundsValue)}`} />
        <Row label="Rabaty" value={money(summary.discounts)} />
        <Row label="Anulowane" value={`${summary.cancelledOrders} · ${money(summary.cancelledValue)}`} />
        <Row label="Netto" value={money(summary.net)} strong />
      </dl>
    </section>
    {report.note && <section className="rounded-3xl border border-[#ebe5de] bg-white p-4 text-[13px] sm:p-5"><h2 className="mb-1 font-bold">Notatka</h2><p className="text-[#4a443f]">{report.note}</p></section>}
  </div>
}
