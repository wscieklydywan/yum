'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { CalendarDays, Coins, Crown, Gift, HeartPulse, Layers, Loader2, Repeat, Trophy, Users, Wallet, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/marketing'
import { dashboardFetcher, MARKETING_STATS_KEY, trendPercent, type LifecycleSegment, type MarketingKpi, type MarketingStats, type Trend } from '@/lib/marketing-dashboard'
import { ActivityChart, Card, CardHeading, KpiCard, type ActivityMetric } from './dashboard-parts'

const number = new Intl.NumberFormat('pl-PL')

const tierIcon: Record<string, { icon: LucideIcon; className: string }> = {
  'Złoty Fan': { icon: Crown, className: 'text-amber-500' },
  'Srebrny Fan': { icon: Layers, className: 'text-zinc-400' },
  Fan: { icon: Users, className: 'text-zinc-600' },
}

const segments: { key: LifecycleSegment; label: string; hint: string; className: string }[] = [
  { key: 'active', label: 'Aktywni', hint: 'aktywność w 30 dni', className: 'bg-emerald-500' },
  { key: 'atRisk', label: 'Zagrożeni', hint: 'brak aktywności 30–90 dni', className: 'bg-amber-500' },
  { key: 'newInactive', label: 'Nowi bez aktywności', hint: 'dołączyli, nic nie zrobili', className: 'bg-sky-500' },
  { key: 'dormant', label: 'Uśpieni', hint: 'brak aktywności 90+ dni', className: 'bg-zinc-300' },
]

const metrics: { id: ActivityMetric; label: string }[] = [
  { id: 'customers', label: 'Klienci' },
  { id: 'orders', label: 'Zamówienia' },
  { id: 'revenue', label: 'Obrót' },
]

export function MarketingStatsView({ onOpen }: { onOpen: (id: string) => void }) {
  const { data, error, isLoading } = useSWR<MarketingStats>(MARKETING_STATS_KEY, dashboardFetcher, { refreshInterval: 300_000, dedupingInterval: 60_000 })
  const [metric, setMetric] = useState<ActivityMetric>('customers')

  if (error) return <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error.message}</p>
  if (isLoading || !data) return <div className="flex justify-center p-16"><Loader2 className="size-6 animate-spin text-primary" aria-label="Wczytywanie statystyk" /></div>

  const { kpi, stars } = data
  const lifecycle = kpi.lifecycle
  const metricTotal = data.activity.reduce((acc, day) => acc + day[metric], 0)
  const previousMonth = new Date(kpi.period.previousFrom).toLocaleDateString('pl-PL', { month: 'long' })

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
        <CalendarDays className="size-3.5" aria-hidden="true" />
        <span>Ten miesiąc do dziś vs ten sam okres miesiąca {previousMonth}</span>
        <span aria-hidden="true">·</span>
        <span>Aktualizacja {new Date(data.generatedAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span>
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <SalesCard kpi={kpi} />
        <CostCard kpi={kpi} onOpen={onOpen} />
      </div>

      <section aria-label="Klienci klubu" className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <KpiCard icon={Users} value={number.format(kpi.activeCustomers.value)} label="Aktywni · 30 dni" trend={kpi.activeCustomers} hint={`z ${number.format(kpi.activeCustomers.total)} członków klubu`} />
        <KpiCard icon={Repeat} value={`${kpi.repeatRate.value}%`} label="Powroty w miesiącu" trend={kpi.repeatRate} points hint={`${kpi.repeatRate.repeatCustomers} z ${kpi.repeatRate.customers} członków zamówiło 2+ razy`} />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-5">
        <Card className="min-w-0 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-zinc-900 sm:text-base">Aktywność · 30 dni</h3>
            <div role="tablist" aria-label="Miara na wykresie" className="flex rounded-xl bg-zinc-100 p-0.5">
              {metrics.map((item) => (
                <button key={item.id} type="button" role="tab" aria-selected={metric === item.id} onClick={() => setMetric(item.id)}
                  className={cn('rounded-lg px-2.5 py-1 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', metric === item.id ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800')}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Razem: <span className="font-bold tabular-nums text-zinc-900">{metric === 'revenue' ? formatMoney(metricTotal) : number.format(metricTotal)}</span>
            {metric === 'customers' && ' wizyt klientów (unikalni dziennie)'}
            {metric === 'orders' && ` zamówień klubowych z ${number.format(data.activity.reduce((acc, day) => acc + day.allOrders, 0))} wszystkich`}
            {metric === 'revenue' && ` · oszczędności klientów ${formatMoney(kpi.revenue.savings)} w tym miesiącu`}
          </p>
          <div className="mt-3"><ActivityChart data={data.activity} metric={metric} /></div>
        </Card>

        <Card className="flex min-w-0 flex-col p-4 sm:p-5">
          <CardHeading icon={HeartPulse} title="Zdrowie klubu" action={<span className="text-xs tabular-nums text-zinc-500">{number.format(lifecycle.total)} osób</span>} />
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-zinc-100" role="img" aria-label={segments.map((s) => `${s.label}: ${lifecycle[s.key]}`).join(', ')}>
            {segments.map((s) => lifecycle[s.key] > 0 && <div key={s.key} className={s.className} style={{ width: `${(lifecycle[s.key] / Math.max(1, lifecycle.total)) * 100}%` }} />)}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {segments.map((s) => (
              <li key={s.key} className="min-w-0 rounded-xl bg-zinc-50 px-3 py-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-700"><span className={cn('size-2 shrink-0 rounded-full', s.className)} aria-hidden="true" /><span className="truncate">{s.label}</span></span>
                <span className="block text-lg font-black tabular-nums text-zinc-900">{number.format(lifecycle[s.key])}</span>
                <span className="block truncate text-[11px] text-zinc-500">{s.hint}</span>
              </li>
            ))}
          </ul>
          <ul className="mt-3 flex flex-col divide-y divide-zinc-100 border-t border-zinc-100">
            {data.tiers.map((tier) => {
              const meta = tierIcon[tier.name] ?? tierIcon.Fan
              return (
                <li key={tier.name} className="flex items-center gap-2.5 py-1.5 text-sm">
                  <meta.icon className={cn('size-4 shrink-0', meta.className)} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-zinc-700">{tier.name}</span>
                  <span className="text-xs tabular-nums text-zinc-400">{tier.count}</span>
                  <span className="w-10 text-right font-black tabular-nums text-zinc-900">{tier.percent}%</span>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <Card className="min-w-0 p-4 sm:p-5">
          <CardHeading icon={Coins} title="Ekonomia Stars · 30 dni" action={<button type="button" onClick={() => onOpen('overview-budget')} className="shrink-0 text-xs font-bold text-zinc-600 hover:text-primary">Budżet</button>} />
          <dl className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="Wydane" value={number.format(stars.earned)} />
            <Stat label="Wymienione" value={number.format(stars.redeemed)} />
            <Stat label="Wymiana" value={`${stars.redemptionRate}%`} tone={stars.redemptionRate < 20 ? 'warn' : undefined} />
          </dl>
          <div className="mt-3 rounded-xl bg-zinc-50 p-3">
            <p className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-zinc-600">Stars w obiegu</span>
              <span className="font-black tabular-nums text-zinc-900">{number.format(stars.balance)}</span>
            </p>
            {stars.balanceValue !== null && <p className="mt-0.5 text-[11px] text-zinc-500">{`≈ ${formatMoney(stars.balanceValue)} w wartości menu do wydania przez klientów`}</p>}
          </div>
          <p className="mt-3 text-xs text-zinc-500">W tym miesiącu: {stars.claimedRewards} nagród · {stars.claimedCodes} użytych kodów</p>
          {data.budget.limit !== null && (
            <div className="mt-3">
              <p className="flex justify-between gap-2 text-xs"><span className="text-zinc-600">Budżet koła</span><span className="font-bold tabular-nums text-zinc-900">{formatMoney(data.budget.spent)} / {formatMoney(data.budget.limit)}</span></p>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-label="Wykorzystanie budżetu koła" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round((data.budget.spent / Math.max(1, data.budget.limit)) * 100))}>
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (data.budget.spent / Math.max(1, data.budget.limit)) * 100)}%` }} />
              </div>
            </div>
          )}
        </Card>

        <Card className="min-w-0 p-4 sm:p-5">
          <CardHeading icon={Trophy} title="Najpopularniejsze nagrody" action={<button type="button" onClick={() => onOpen('club-rewards')} className="shrink-0 text-xs font-bold text-zinc-600 hover:text-primary">Zarządzaj</button>} />
          {data.topRewards.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">Brak wymian w ostatnich 30 dniach. Sprawdź, czy nagrody są atrakcyjne i osiągalne.</p>
          ) : (
            <ol className="mt-3 flex flex-col gap-2.5">
              {data.topRewards.map((reward, index) => (
                <li key={reward.name} className="flex min-w-0 items-center gap-3">
                  <span className="w-4 shrink-0 text-xs font-black tabular-nums text-zinc-400">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-bold text-zinc-900">{reward.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-zinc-500">{reward.count}×</span>
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-zinc-100"><span className="block h-full rounded-full bg-primary" style={{ width: `${(reward.count / data.topRewards[0].count) * 100}%` }} /></span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  )
}

function SalesCard({ kpi }: { kpi: MarketingKpi }) {
  const { sales, revenue } = kpi
  const guestOrders = sales.orders - revenue.orders
  const max = Math.max(1, ...sales.channels.map((channel) => channel.revenue))
  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <CardHeading icon={Wallet} title="Sprzedaż · ten miesiąc" action={<TrendBadge trend={sales} />} />
      <p className="mt-2 text-2xl font-black tabular-nums text-zinc-900">{formatMoney(sales.value)}</p>
      <p className="text-xs text-zinc-500">
        {number.format(sales.orders)} zamówień · śr. koszyk {formatMoney(sales.avgBasket)} · {sales.days} {sales.days === 1 ? 'dzień' : 'dni'} ze sprzedażą
      </p>
      <p className="mt-0.5 text-[11px] text-zinc-400">Wszystkie zamówienia bez anulowanych, od 1. dnia miesiąca.</p>

      <h4 className="mt-4 text-xs font-bold uppercase tracking-wide text-zinc-400">Kanały</h4>
      {sales.channels.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">Brak zamówień w tym miesiącu.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2.5">
          {sales.channels.map((channel) => (
            <li key={channel.source} className="min-w-0">
              <span className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-bold text-zinc-800">{channel.label}</span>
                <span className="shrink-0 tabular-nums text-zinc-900">{formatMoney(channel.revenue)} <span className="text-xs text-zinc-400">· {channel.orders}</span></span>
              </span>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-zinc-100"><span className="block h-full rounded-full bg-primary" style={{ width: `${(channel.revenue / max) * 100}%` }} /></span>
            </li>
          ))}
        </ul>
      )}

      <h4 className="mt-4 text-xs font-bold uppercase tracking-wide text-zinc-400">Kto zamawiał</h4>
      <dl className="mt-2 grid grid-cols-2 gap-2">
        <div className="min-w-0 rounded-xl bg-primary/5 px-3 py-2">
          <dt className="truncate text-[11px] font-bold text-primary">Członkowie klubu</dt>
          <dd className="truncate text-base font-black tabular-nums text-zinc-900">{formatMoney(revenue.value)}</dd>
          <dd className="truncate text-[11px] text-zinc-500">{revenue.orders} zam. · {revenue.clubShare}%</dd>
        </div>
        <div className="min-w-0 rounded-xl bg-zinc-50 px-3 py-2">
          <dt className="truncate text-[11px] font-bold text-zinc-600">Bez konta w klubie</dt>
          <dd className="truncate text-base font-black tabular-nums text-zinc-900">{formatMoney(Math.max(0, sales.value - revenue.value))}</dd>
          <dd className="truncate text-[11px] text-zinc-500">{guestOrders} zam. · {sales.orders ? 100 - revenue.clubShare : 0}%</dd>
        </div>
      </dl>
    </Card>
  )
}

function CostCard({ kpi, onOpen }: { kpi: MarketingKpi; onOpen: (id: string) => void }) {
  const cost = kpi.rewardCost
  const rows = [
    { label: 'Rabaty poziomów klubu', hint: 'Srebrny i Złoty Fan', value: cost.clubDiscounts },
    { label: 'Promocje i kody', hint: 'obniżki naliczone w zamówieniach', value: cost.otherDiscounts },
    { label: 'Nagrody za Stars', hint: 'koszt produktów (food cost)', value: cost.rewards },
    { label: 'Koło fortuny', hint: 'koszt wygranych nagród', value: cost.wheel },
  ]
  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <CardHeading icon={Gift} title="Koszt marketingu · ten miesiąc" action={<TrendBadge trend={cost} invert />} />
      <p className="mt-2 text-2xl font-black tabular-nums text-zinc-900">{formatMoney(cost.value)}</p>
      <p className="text-xs text-zinc-500">{cost.costRatio === null ? 'Brak sprzedaży do porównania' : `${cost.costRatio}% sprzedaży`}</p>
      <ul className="mt-3 flex flex-col divide-y divide-zinc-100">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-zinc-800">{row.label}</span>
              <span className="block truncate text-[11px] text-zinc-500">{row.hint}</span>
            </span>
            <span className="shrink-0 text-sm font-black tabular-nums text-zinc-900">{formatMoney(row.value)}</span>
          </li>
        ))}
      </ul>
      {cost.wheel === 0 && (
        <button type="button" onClick={() => onOpen('wheel')} className="mt-2 w-full rounded-xl bg-amber-50 px-3 py-2 text-left text-[11px] text-amber-800 hover:bg-amber-100">
          Nagrody koła nie mają ustawionego kosztu, więc liczą się jako 0 zł. Uzupełnij koszt przy nagrodach koła.
        </button>
      )}
    </Card>
  )
}

function TrendBadge({ trend, invert }: { trend: Trend; invert?: boolean }) {
  if (trend.previous === 0 && trend.value === 0) return null
  const change = trendPercent(trend)
  const good = invert ? change <= 0 : change >= 0
  return (
    <span title="vs ten sam okres poprzedniego miesiąca" className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums', good ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
      {trend.previous === 0 ? 'nowe' : `${change > 0 ? '+' : ''}${change}%`}
    </span>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div className="min-w-0 rounded-xl bg-zinc-50 px-2 py-2 text-center">
      <dd className={cn('truncate text-base font-black tabular-nums', tone === 'warn' ? 'text-amber-600' : 'text-zinc-900')}>{value}</dd>
      <dt className="truncate text-[11px] text-zinc-500">{label}</dt>
    </div>
  )
}
