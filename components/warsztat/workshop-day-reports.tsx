'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Ban, Bike, Percent, ReceiptText, RotateCcw, ShoppingBag, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DayReport } from '@/lib/day-report-types'
import { HourChart, TypeDonut } from './workshop-report-charts'
import type { OrderSource } from './order-data'
import { SourceMark } from './source-mark'

export const REPORTS_KEY = '/api/workshop/reports'

const money = (value: number) => value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })
const dateTime = (value: string) => new Date(value).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' })
const dayLabel = (value: string) => new Date(value).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Warsaw' })
const shortDay = (value: string) => new Date(value).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Warsaw' })

async function fetchReports(url: string): Promise<{ live: DayReport | null; reports: DayReport[] }> {
  const response = await fetch(url, { credentials: 'same-origin' })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? 'Nie udało się pobrać raportów.')
  return result
}

export function WorkshopDayReports() {
  const { data, error, isLoading } = useSWR(REPORTS_KEY, fetchReports)
  const all = data ? [...(data.live ? [data.live] : []), ...data.reports] : []
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = all.find((report) => report.id === selectedId) ?? all[0]

  return (
    <section className="min-w-0 max-w-full motion-safe:animate-in motion-safe:fade-in-0 duration-300">
      <header className="mb-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b827a]">Raporty</p>
        <h1 className="mt-1 text-[22px] font-extrabold tracking-tight sm:text-[26px]">Raporty dnia</h1>
      </header>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error.message}</p>}
      {isLoading && <div className="flex flex-col gap-3" aria-label="Wczytywanie raportów">
        <div className="h-44 animate-pulse rounded-3xl bg-[#e9e3dc]" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><div className="h-20 animate-pulse rounded-2xl bg-[#ece7e1]" /><div className="h-20 animate-pulse rounded-2xl bg-[#ece7e1]" /><div className="h-20 animate-pulse rounded-2xl bg-[#ece7e1]" /></div>
      </div>}
      {data && all.length === 0 && <div className="rounded-3xl border border-dashed border-[#d8d0c7] bg-white/50 px-4 py-14 text-center text-sm text-[#847c74]">Brak raportów. Raport tworzy się automatycznie po kliknięciu „Zamknij dzień”.</div>}

      {selected && <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Lista raportów" className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1 lg:sticky lg:top-4 lg:mx-0 lg:max-h-[calc(100dvh-8rem)] lg:flex-col lg:overflow-y-auto lg:px-0">
          {all.map((report) => {
            const active = report.id === selected.id
            return <button key={report.id} type="button" aria-pressed={active} onClick={() => setSelectedId(report.id)} className={cn('shrink-0 rounded-2xl px-3.5 py-2.5 text-left transition-colors', active ? 'bg-[#201d1a] text-white shadow-md' : 'bg-white/70 text-[#201d1a] hover:bg-white')}>
              <p className="flex items-center gap-2 whitespace-nowrap text-[13px] font-bold capitalize">
                {shortDay(report.openedAt)}
                {report.live && <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-600"><span className="size-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" aria-hidden="true" />Na żywo</span>}
                {report.pending && <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-600">Dopisuje</span>}
              </p>
              <p className={cn('mt-0.5 whitespace-nowrap text-[11px] tabular-nums', active ? 'text-white/65' : 'text-[#756e67]')}>{money(report.summary.netRevenue)} · {report.summary.orders} zam.</p>
            </button>
          })}
        </nav>
        <ReportDetails report={selected} />
      </div>}
    </section>
  )
}

type Stat = { label: string; value: string; hint?: string; icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>; negative?: boolean }
type StatGroup = { title: string; stats: Stat[] }

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('min-w-0 rounded-3xl border border-[#ebe5de] bg-white p-4 sm:p-5', className)}>
      <h2 className="mb-4 text-[14px] font-bold">{title}</h2>
      {children}
    </section>
  )
}

/** Every place an order can come from: our own systems first, then the delivery platforms. */
const PLATFORMS: Record<string, string> = { yummy: 'Strona www', kiosk: 'Kiosk', own: 'Bar (przyjęte ręcznie)', glovo: 'Glovo', pyszne: 'Pyszne.pl' }

function TopProductsCard({ summary }: { summary: DayReport['summary'] }) {
  const [sortBy, setSortBy] = useState<'quantity' | 'revenue'>('quantity')
  const products = sortBy === 'revenue' && summary.topProductsByRevenue ? summary.topProductsByRevenue : summary.topProducts
  const max = Math.max(1, ...products.map((product) => (sortBy === 'revenue' ? product.revenue : product.quantity)))

  return (
    <section className="rounded-2xl border border-[#e5ded6] bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[14px] font-bold">Najpopularniejsze pozycje</h3>
        <div className="inline-flex rounded-lg bg-[#f4f1ed] p-0.5" role="radiogroup" aria-label="Sortuj pozycje">
          {([['quantity', 'Sztuki'], ['revenue', 'Przychód']] as const).map(([value, label]) => (
            <button key={value} type="button" role="radio" aria-checked={sortBy === value} disabled={value === 'revenue' && !summary.topProductsByRevenue} onClick={() => setSortBy(value)} className={cn('h-7 rounded-md px-2.5 text-[11px] font-semibold transition-colors disabled:opacity-40', sortBy === value ? 'bg-white text-[#201d1a] shadow-sm' : 'text-[#756e67] hover:text-[#201d1a]')}>{label}</button>
          ))}
        </div>
      </div>
      {products.length === 0 ? <p className="text-sm text-[#847c74]">Brak sprzedaży.</p> : <ol className="flex flex-col gap-3">
        {products.map((product, index) => <li key={product.name} className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-2 text-[13px]">
            <span className="w-5 shrink-0 text-[11px] font-bold text-[#8b827a] tabular-nums">{index + 1}</span>
            <span className="min-w-0 flex-1 truncate font-semibold">{product.name}</span>
            <span className={cn('shrink-0 tabular-nums', sortBy === 'quantity' ? 'font-bold text-[#201d1a]' : 'text-[#756e67]')}>{product.quantity} szt.</span>
            <span className={cn('w-20 shrink-0 text-right tabular-nums sm:w-24', sortBy === 'revenue' ? 'font-bold' : 'text-[#756e67]')}>{money(product.revenue)}</span>
          </div>
          <div className="ml-7 h-1.5 overflow-hidden rounded-full bg-[#f4f1ed]" aria-hidden="true">
            <span className={cn('block h-full rounded-full', index === 0 ? 'bg-primary' : 'bg-[#201d1a]/70')} style={{ width: `${((sortBy === 'revenue' ? product.revenue : product.quantity) / max) * 100}%` }} />
          </div>
        </li>)}
      </ol>}
    </section>
  )
}

function ReportDetails({ report }: { report: DayReport }) {
  const { summary } = report
  const gross = summary.netRevenue
  const tax = summary.tax ?? 0
  const net = summary.net ?? gross - tax
  const netShare = gross > 0 ? (net / gross) * 100 : 100
  const channels = summary.byChannel ?? summary.byType
  const platforms = Object.entries(PLATFORMS).map(([key, name]) => {
    const entry = summary.bySource.find((source) => source.name === key)
    return { key, name, orders: entry?.orders ?? 0, revenue: entry?.revenue ?? 0 }
  }).filter((platform) => platform.orders > 0)

  const statGroups: StatGroup[] = [
    {
      title: 'Sprzedaż',
      stats: [
        { label: 'Średnie zamówienie', value: money(summary.averageOrder), icon: TrendingUp },
        { label: 'Obrót przed zwrotami', value: money(summary.revenue), icon: ShoppingBag },
        { label: 'Dostawy', value: money(summary.deliveryFees), icon: Bike },
        { label: 'Paragony', value: money(summary.receiptsValue), hint: `${summary.receipts} szt.`, icon: ReceiptText },
      ],
    },
    {
      title: 'Korekty',
      stats: [
        { label: 'Rabaty', value: money(summary.discounts), icon: Percent, negative: summary.discounts > 0 },
        { label: 'Zwroty', value: money(summary.refundsValue), hint: `${summary.refunds} szt.`, icon: RotateCcw, negative: summary.refundsValue > 0 },
        { label: 'Anulowane', value: money(summary.cancelledValue), hint: `${summary.cancelledOrders} zam.`, icon: Ban, negative: summary.cancelledValue > 0 },
      ],
    },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section aria-label="Podsumowanie dnia" className="relative overflow-hidden rounded-3xl bg-[#201d1a] p-5 text-white sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-primary/40 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <p className="text-[12px] font-semibold capitalize text-white/60">{dayLabel(report.openedAt)}</p>
          <p className="mt-0.5 text-[11px] text-white/45">{report.live ? 'Dzień trwa · od ' : 'Otwarty '}{dateTime(report.openedAt)}{report.live ? '' : ` · zamknięty ${dateTime(report.closedAt)}`}</p>

          <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">Obrót brutto</p>
          <p className="mt-1 text-[38px] font-extrabold leading-none tracking-tight tabular-nums [overflow-wrap:anywhere] sm:text-[52px]">{money(gross)}</p>
          <p className="mt-2 text-[12px] text-white/50">po zwrotach · {summary.orders} zamówień</p>

          <div className="mt-6 flex h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <span className="h-full bg-white" style={{ width: `${netShare}%` }} />
            <span className="h-full bg-primary" style={{ width: `${100 - netShare}%` }} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-white/55"><span className="size-2 rounded-full bg-white" aria-hidden="true" />Netto</dt>
              <dd className="mt-1 text-[20px] font-extrabold tabular-nums sm:text-[24px]">{money(net)}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-white/55"><span className="size-2 rounded-full bg-primary" aria-hidden="true" />Suma VAT</dt>
              <dd className="mt-1 text-[20px] font-extrabold tabular-nums sm:text-[24px]">{money(tax)}</dd>
            </div>
          </dl>
        </div>
      </section>

      {(report.pending || (summary.lateOrders ?? 0) > 0 || (summary.openOrders ?? 0) > 0) && <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-950">
        {report.pending && <p className="font-semibold">Raport jest jeszcze otwarty – zamówienia realizowane lub dodane po zamknięciu dopisują się do tego dnia aż do otwarcia kolejnego.</p>}
        {(summary.lateOrders ?? 0) > 0 && <p>Po zamknięciu dnia dopisano {summary.lateOrders} zam. na {money(summary.lateRevenue ?? 0)}.</p>}
        {(summary.openOrders ?? 0) > 0 && <p>W realizacji wciąż: {summary.openOrders} zam. (wliczone do obrotu).</p>}
      </div>}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
        {statGroups.map((group) => <section key={group.title} aria-label={group.title} className="min-w-0 rounded-3xl border border-[#ebe5de] bg-white p-2">
          <h2 className="px-3 pb-1 pt-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8b827a]">{group.title}</h2>
          <dl className="divide-y divide-[#f1ece6]">
            {group.stats.map(({ icon: Icon, ...stat }) => <div key={stat.label} className="flex min-w-0 items-center gap-3 px-3 py-3">
              <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', stat.negative ? 'bg-primary/10 text-primary' : 'bg-[#f4f1ed] text-[#201d1a]')}>
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <dt className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-[#201d1a]">{stat.label}</span>
                {stat.hint && <span className="block text-[11px] tabular-nums text-[#8b827a]">{stat.hint}</span>}
              </dt>
              <dd className={cn('shrink-0 text-right text-[15px] font-extrabold tabular-nums sm:text-[16px]', stat.negative && 'text-primary')}>
                {stat.negative ? `−${stat.value}` : stat.value}
              </dd>
            </div>)}
          </dl>
        </section>)}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card title="Zamówienia wg godzin">
          {summary.byHour.length === 0 ? <p className="text-sm text-[#847c74]">Brak danych.</p> : <HourChart byHour={summary.byHour} />}
        </Card>
        <Card title="Podatek VAT wg stawek">
          {!summary.vat?.length ? <p className="text-sm text-[#847c74]">Brak sprzedaży.</p> : <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[260px] text-[13px] tabular-nums">
              <thead><tr className="text-left text-[11px] font-semibold text-[#8b827a]"><th className="px-1 pb-2 font-semibold">Stawka</th><th className="px-1 pb-2 text-right font-semibold">Netto</th><th className="px-1 pb-2 text-right font-semibold">VAT</th><th className="px-1 pb-2 text-right font-semibold">Brutto</th></tr></thead>
              <tbody className="divide-y divide-[#f0ebe5]">
                {summary.vat.map((group) => <tr key={group.vat}>
                  <td className="px-1 py-2.5"><span className="rounded-md bg-[#f4f1ed] px-1.5 py-0.5 text-[11px] font-bold">{group.vat}</span> <span className="text-[#756e67]">{group.rate}%</span></td>
                  <td className="px-1 py-2.5 text-right">{money(group.net)}</td>
                  <td className="px-1 py-2.5 text-right font-semibold text-primary">{money(group.tax)}</td>
                  <td className="px-1 py-2.5 text-right font-bold">{money(group.gross)}</td>
                </tr>)}
              </tbody>
              <tfoot><tr className="border-t-2 border-[#201d1a] font-extrabold"><td className="px-1 pt-2.5">Razem</td><td className="px-1 pt-2.5 text-right">{money(net)}</td><td className="px-1 pt-2.5 text-right text-primary">{money(tax)}</td><td className="px-1 pt-2.5 text-right">{money(gross)}</td></tr></tfoot>
            </table>
          </div>}
        </Card>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <TopProductsCard summary={summary} />
        <Card title="Typ zamówienia i skąd przyszło">
          {channels.length === 0 ? <p className="text-sm text-[#847c74]">Brak danych.</p> : <TypeDonut byType={channels} />}
          {platforms.length > 0 && <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-[#f0ebe5] pt-4">
            {platforms.map((platform) => <div key={platform.name} className="rounded-xl bg-[#faf8f5] px-3 py-2.5">
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-[#756e67]">{platform.key !== 'own' && <SourceMark source={platform.key as OrderSource} decorative className="size-4 rounded" />}{platform.name}</dt>
              <dd className="mt-0.5 text-[16px] font-extrabold tabular-nums">{money(platform.revenue)}</dd>
              <dd className="text-[11px] text-[#8b827a]">{platform.orders} zam. · {summary.revenue > 0 ? Math.round((platform.revenue / summary.revenue) * 100) : 0}% obrotu</dd>
            </div>)}
          </dl>}
        </Card>
      </div>
    </div>
  )
}
