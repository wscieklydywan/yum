'use client'

import { useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { ArrowDownRight, ArrowUpRight, ChevronRight, Coins, Disc3, Gift, Loader2, Percent, ReceiptText, Star, TicketPercent, Wallet, type LucideIcon } from 'lucide-react'
import { formatMoney, type MarketingOverview as Overview, type MarketingSettings } from '@/lib/marketing'
import { dashboardFetcher, MARKETING_DASHBOARD_KEY, trendPercent, type MarketingDashboard } from '@/lib/marketing-dashboard'
import { formatPercent, formatStarMoney, type StarValue } from '@/lib/loyalty-economics'
import { cn } from '@/lib/utils'
import { MARKETING_KEY, marketingFetcher } from './marketing-shared'
import { useStarCost } from './use-star-cost'

type OpenTab = (id: string) => void

const monthName = () => new Date().toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })

export function MarketingOverview({ onOpen }: { onOpen: OpenTab }) {
  const overview = useSWR<Overview>(MARKETING_KEY, marketingFetcher)
  const dashboard = useSWR<MarketingDashboard>(MARKETING_DASHBOARD_KEY, dashboardFetcher, { dedupingInterval: 60_000 })
  const star = useStarCost()

  const error = overview.error ?? dashboard.error
  if (error) return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error.message}</p>
  if (!overview.data || !dashboard.data) return <div className="flex justify-center p-10"><Loader2 className="size-6 animate-spin text-primary" aria-label="Wczytywanie" /></div>

  const data = overview.data
  const cost = dashboard.data.kpi.rewardCost
  const sales = dashboard.data.kpi.sales

  return (
    <div className="flex flex-col gap-6">
      <CostHero total={cost.value} previous={cost.previous} sales={sales.value} ratio={sales.value > 0 ? Math.round((cost.value / sales.value) * 1000) / 10 : null} />
      <CostBreakdown cost={cost} onOpen={onOpen} />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3"><WheelBudget data={data} onSaved={(next) => { overview.mutate(next, { revalidate: false }); dashboard.mutate() }} onOpen={onOpen} /></div>
        <div className="lg:col-span-2"><StarValueCard star={star.data} loading={star.isLoading} onOpen={onOpen} /></div>
      </div>
      <GlobalSettings data={data} foodCost={star.foodCostPercent} loading={star.isLoading} onOpen={onOpen} />
      <CostTable data={data} />
    </div>
  )
}

function CostHero({ total, previous, sales, ratio }: { total: number; previous: number; sales: number; ratio: number | null }) {
  const trend = trendPercent({ value: total, previous })
  const up = trend > 0
  const health = ratio === null ? null : ratio <= 5 ? { label: 'Zdrowy poziom', tone: 'bg-emerald-100 text-emerald-800' } : ratio <= 10 ? { label: 'Do obserwacji', tone: 'bg-amber-100 text-amber-800' } : { label: 'Wysoki koszt', tone: 'bg-red-100 text-red-800' }
  return (
    <section aria-labelledby="budget-hero" className="overflow-hidden rounded-2xl bg-zinc-900 p-5 text-white sm:p-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p id="budget-hero" className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">{`Koszt marketingu · ${monthName()}`}</p>
          <p className="mt-2 text-4xl font-black tabular-nums tracking-tight sm:text-5xl">{formatMoney(total)}</p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-300">
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold', up ? 'bg-red-500/20 text-red-200' : 'bg-emerald-500/20 text-emerald-200')}>
              {up ? <ArrowUpRight className="size-3.5" aria-hidden="true" /> : <ArrowDownRight className="size-3.5" aria-hidden="true" />}
              {`${up ? '+' : ''}${trend}%`}
            </span>
            <span>{`vs ${formatMoney(previous)} w tym samym okresie poprzedniego miesiąca`}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <HeroStat label="Sprzedaż w miesiącu" value={formatMoney(sales)} />
          <HeroStat label="Koszt / sprzedaż" value={ratio === null ? '—' : `${ratio.toString().replace('.', ',')}%`} badge={health} />
        </div>
      </div>
      <p className="mt-4 border-t border-white/10 pt-3 text-xs leading-relaxed text-zinc-400">
        Wszystko, co oddajecie klientom: rabaty z promocji i kodów, rabaty poziomów klubu, nagrody z koła i kupony za Stars – policzone po realnym koszcie (surowiec, nie cena w menu).
      </p>
    </section>
  )
}

function HeroStat({ label, value, badge }: { label: string; value: string; badge?: { label: string; tone: string } | null }) {
  return (
    <div className="min-w-0 flex-1 rounded-xl bg-white/5 p-3 md:min-w-36">
      <p className="text-[11px] font-semibold text-zinc-400">{label}</p>
      <p className="mt-1 text-lg font-black tabular-nums">{value}</p>
      {badge && <span className={cn('mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold', badge.tone)}>{badge.label}</span>}
    </div>
  )
}

type CostPart = { id: string; label: string; hint: string; value: number; color: string; icon: LucideIcon; target: string }

function CostBreakdown({ cost, onOpen }: { cost: MarketingDashboard['kpi']['rewardCost']; onOpen: OpenTab }) {
  const parts: CostPart[] = [
    { id: 'promo', label: 'Promocje i kody', hint: 'Obniżki cen i kody rabatowe', value: cost.otherDiscounts, color: 'bg-primary', icon: TicketPercent, target: 'promotions' },
    { id: 'club', label: 'Rabaty klubowe', hint: 'Rabat za poziom w klubie', value: cost.clubDiscounts, color: 'bg-amber-500', icon: Percent, target: 'club-tiers' },
    { id: 'wheel', label: 'Koło fortuny', hint: `${cost.wheelSpins} zakręceń`, value: cost.wheel, color: 'bg-zinc-800', icon: Disc3, target: 'wheel' },
    { id: 'rewards', label: 'Nagrody za Stars', hint: 'Odebrane kupony', value: cost.rewards, color: 'bg-emerald-600', icon: Gift, target: 'club-rewards' },
  ]
  const total = parts.reduce((sum, part) => sum + part.value, 0)
  return (
    <section aria-labelledby="budget-split" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="budget-split" className="text-base font-black text-zinc-900">Na co idą pieniądze</h3>
        <p className="text-xs text-zinc-500">Kliknij, aby przejść do ustawień</p>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-100" role="img" aria-label={parts.map((p) => `${p.label}: ${formatMoney(p.value)}`).join(', ')}>
        {total > 0 && parts.map((part) => part.value > 0 && <div key={part.id} className={part.color} style={{ width: `${(part.value / total) * 100}%` }} />)}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {parts.map(({ id, label, hint, value, color, icon: Icon, target }) => (
          <button key={id} type="button" onClick={() => onOpen(target)} className="group flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg text-white', color)}><Icon className="size-4" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold text-zinc-600">{label}</span>
              <span className="block text-lg font-black tabular-nums text-zinc-900">{formatMoney(value)}</span>
              <span className="block truncate text-[11px] text-zinc-500">{total > 0 ? `${Math.round((value / total) * 100)}% · ${hint}` : hint}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-zinc-300 group-hover:text-zinc-500" aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  )
}

function WheelBudget({ data, onSaved, onOpen }: { data: Overview; onSaved: (next: Overview) => void; onOpen: OpenTab }) {
  const current = data.settings.monthlyBudget
  const [hasBudget, setHasBudget] = useState(current !== null)
  const [value, setValue] = useState(String(current ?? 300).replace('.', ','))
  const [saving, setSaving] = useState(false)

  const spent = data.wheel.monthTotal
  const percent = current ? Math.min(100, (spent / current) * 100) : 0
  const left = current === null ? null : Math.max(0, current - spent)
  const dayOfMonth = new Date().getDate()
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const projected = dayOfMonth > 0 ? (spent / dayOfMonth) * daysInMonth : spent
  const barTone = percent >= 100 ? 'bg-red-500' : percent >= 80 ? 'bg-amber-500' : 'bg-primary'
  const dirty = hasBudget !== (current !== null) || (hasBudget && Number(value.replace(',', '.')) !== current)

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    const body: MarketingSettings = { ...data.settings, monthlyBudget: hasBudget ? Number(value.replace(',', '.')) || 0 : null }
    try {
      const response = await fetch(MARKETING_KEY, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error ?? 'Nie udało się zapisać.')
      onSaved(result)
      toast.success('Zapisano limit koła')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Nie udało się zapisać.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} aria-labelledby="wheel-budget" className="flex h-full flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Disc3 className="size-5" aria-hidden="true" /></span>
          <div>
            <h3 id="wheel-budget" className="text-base font-black text-zinc-900">Limit koła fortuny</h3>
            <p className="text-xs leading-relaxed text-zinc-500">Po przekroczeniu koło samo się wstrzyma do 1. dnia kolejnego miesiąca.</p>
          </div>
        </div>
        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold', data.settings.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-600')}>{data.settings.enabled ? 'Koło włączone' : 'Koło wyłączone'}</span>
      </div>

      {current !== null ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-end justify-between gap-2">
            <p className="text-2xl font-black tabular-nums text-zinc-900">{formatMoney(spent)} <span className="text-sm font-semibold text-zinc-500">{`z ${formatMoney(current)}`}</span></p>
            <p className="text-sm font-bold tabular-nums text-zinc-700">{`${Math.round(percent)}%`}</p>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} aria-label="Wykorzystanie limitu koła">
            <div className={cn('h-full rounded-full transition-all', barTone)} style={{ width: `${percent}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <p className="rounded-lg bg-zinc-50 p-2"><span className="block text-zinc-500">Zostało</span><span className="font-bold tabular-nums text-zinc-900">{formatMoney(left ?? 0)}</span></p>
            <p className={cn('rounded-lg p-2', projected > current ? 'bg-amber-50' : 'bg-zinc-50')}><span className="block text-zinc-500">Prognoza na koniec miesiąca</span><span className={cn('font-bold tabular-nums', projected > current ? 'text-amber-800' : 'text-zinc-900')}>{formatMoney(projected)}</span></p>
          </div>
          {percent >= 100 && <p className="rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-800">Limit wykorzystany – koło jest wstrzymane do 1. dnia kolejnego miesiąca.</p>}
        </div>
      ) : (
        <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">{`Bez limitu. W tym miesiącu koło kosztowało ${formatMoney(spent)} (${data.wheel.monthUses} nagród).`}</p>
      )}

      <div className="mt-auto flex flex-col gap-3 border-t border-zinc-100 pt-4">
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Tryb limitu">
          {[{ on: true, label: 'Ustaw limit' }, { on: false, label: 'Bez limitu' }].map((option) => (
            <button key={option.label} type="button" role="radio" aria-checked={hasBudget === option.on} onClick={() => setHasBudget(option.on)} className={cn('h-9 rounded-full border px-3.5 text-xs font-bold transition-colors', hasBudget === option.on ? 'border-primary bg-primary/10 text-primary' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50')}>{option.label}</button>
          ))}
        </div>
        {hasBudget && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mk-budget" className="text-xs font-bold text-zinc-700">Maksymalnie na koło w miesiącu</label>
            <div className="flex items-center gap-2">
              <div className="relative w-40">
                <input id="mk-budget" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value.replace(/[^\d,.]/g, ''))} className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-3 pr-9 text-sm font-bold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">zł</span>
              </div>
              {[200, 300, 500].map((preset) => (
                <button key={preset} type="button" onClick={() => setValue(String(preset))} className="hidden h-10 rounded-xl border border-zinc-200 px-2.5 text-xs font-bold text-zinc-600 hover:bg-zinc-50 sm:block">{preset}</button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={saving || !dirty} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Zapisz limit
          </button>
          <button type="button" onClick={() => onOpen('wheel')} className="inline-flex h-10 items-center gap-1 rounded-xl px-3 text-sm font-bold text-zinc-600 hover:bg-zinc-100">Nagrody na kole<ChevronRight className="size-4" aria-hidden="true" /></button>
        </div>
      </div>
    </form>
  )
}

function StarValueCard({ star, loading, onOpen }: { star: StarValue | undefined; loading: boolean; onOpen: OpenTab }) {
  if (loading || !star) return <div className="flex justify-center rounded-2xl border border-zinc-200 bg-white p-10"><Loader2 className="size-5 animate-spin text-primary" aria-label="Wczytywanie" /></div>
  const spend = formatStarMoney(star.spendPerStar)
  const example = 100
  const exampleStars = Math.floor(example / star.spendPerStar)
  const steps: { label: string; value: string; hint: string; target: string }[] = [
    { label: 'Klient zbiera', value: `1 Star = ${spend} zakupów`, hint: 'Przelicznik Stars', target: 'club-rate' },
    { label: 'Klient dostaje za 1 Star', value: formatStarMoney(star.menuValue), hint: star.source === 'payment' ? 'w cenach menu · z płacenia Stars w koszyku' : 'w cenach menu · z katalogu nagród', target: star.source === 'payment' ? 'points-payment' : 'club-rewards' },
    { label: 'Was realnie kosztuje 1 Star', value: formatStarMoney(star.realCost), hint: `surowiec = ${String(star.foodCostPercent).replace('.', ',')}% ceny menu`, target: 'club-rewards' },
  ]
  return (
    <section aria-labelledby="star-value" className="flex h-full flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"><Star className="size-5" aria-hidden="true" /></span>
        <div>
          <h3 id="star-value" className="text-base font-black text-zinc-900">Ile jest wart 1 Star</h3>
          <p className="text-xs leading-relaxed text-zinc-500">Ta sama wartość liczy koszty koła, gry, nagród i płacenia Stars.</p>
        </div>
      </div>
      <ol className="flex flex-col divide-y divide-zinc-100">
        {steps.map((step, index) => (
          <li key={step.label}>
            <button type="button" onClick={() => onOpen(step.target)} className="group flex w-full items-center gap-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-zinc-100 text-[11px] font-black text-zinc-600">{index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-zinc-800">{step.label}</span>
                <span className="block text-[11px] text-zinc-500">{step.hint}</span>
              </span>
              <span className="shrink-0 text-sm font-black tabular-nums text-zinc-900">{step.value}</span>
              <ChevronRight className="size-4 shrink-0 text-zinc-300 group-hover:text-zinc-500" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
      <div className="rounded-xl bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-700">
        <p className="font-bold text-zinc-900">{`Przykład: klient wydaje ${formatMoney(example)}`}</p>
        <p className="mt-1 text-pretty">
          {`Dostaje ${exampleStars} Stars. W nagrodach są warte ${formatMoney(exampleStars * star.menuValue)} (${formatPercent(star.returnPercent)} zakupów), a Was kosztują ${formatMoney(exampleStars * star.realCost)} (${formatPercent(star.costPercent)} obrotu).`}
        </p>
      </div>
      {star.pointsPayment.enabled && star.pointsPayment.value > star.catalogValue * 1.05 && (
        <p className="rounded-lg bg-amber-50 p-2.5 text-xs font-semibold text-amber-900">
          {`Płacenie Stars daje ${formatStarMoney(star.pointsPayment.value)} za 1 Star, a katalog nagród ${formatStarMoney(star.catalogValue)}. Dla spójności ustaw w „Płacenie punktami” ${formatStarMoney(star.catalogValue)}.`}
        </p>
      )}
    </section>
  )
}

function GlobalSettings({ data, foodCost, loading, onOpen }: { data: Overview; foodCost: number; loading: boolean; onOpen: OpenTab }) {
  const rows: { icon: LucideIcon; label: string; value: string; hint: string; target: string }[] = [
    { icon: ReceiptText, label: 'Koszt surowca', value: `${String(foodCost).replace('.', ',')}% ceny`, hint: 'Ile realnie kosztuje Was produkt z menu', target: 'club-rewards' },
    { icon: Coins, label: 'Rabaty poziomów klubu', value: 'Ustaw', hint: 'Srebrny i Złoty Fan', target: 'club-tiers' },
    { icon: Disc3, label: 'Dodatkowe zakręcenie', value: data.settings.extraSpinEnabled ? `${data.settings.extraSpinCost} Stars` : 'Wyłączone', hint: 'Cena kolejnego zakręcenia kołem', target: 'wheel' },
  ]
  return (
    <section aria-labelledby="global-settings" className="flex h-full flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-700"><Wallet className="size-5" aria-hidden="true" /></span>
        <div>
          <h3 id="global-settings" className="text-base font-black text-zinc-900">Ustawienia, które liczą koszty</h3>
          <p className="text-xs leading-relaxed text-zinc-500">Z tych wartości wylicza się każda kwota na tej stronie.</p>
        </div>
      </div>
      <ul className="flex flex-col divide-y divide-zinc-100">
        {rows.map(({ icon: Icon, label, value, hint, target }) => (
          <li key={label}>
            <button type="button" onClick={() => onOpen(target)} className="group flex w-full items-center gap-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <Icon className="size-4 shrink-0 text-zinc-400" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-zinc-800">{label}</span>
                <span className="block truncate text-[11px] text-zinc-500">{hint}</span>
              </span>
              <span className="shrink-0 text-sm font-black tabular-nums text-zinc-900">{loading ? '…' : value}</span>
              <ChevronRight className="size-4 shrink-0 text-zinc-300 group-hover:text-zinc-500" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function CostTable({ data }: { data: Overview }) {
  const [showAll, setShowAll] = useState(false)
  const rows = showAll ? data.rows : data.rows.slice(0, 8)
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <section aria-labelledby="mk-costs" className="flex flex-col gap-2 lg:col-span-3">
        <h3 id="mk-costs" className="text-base font-black text-zinc-900">Najdroższe nagrody i kody</h3>
        {data.rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">Brak wykorzystań. Koszty pojawią się, gdy klienci zaczną korzystać z kodów i koła.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
                <tr><th className="px-3 py-2 font-bold">Nazwa</th><th className="px-3 py-2 text-right font-bold">Ten miesiąc</th><th className="hidden px-3 py-2 text-right font-bold sm:table-cell">Łącznie</th></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.source}-${row.refId}`} className="border-t border-zinc-100">
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <SourceBadge source={row.source} />
                        <span className="truncate font-semibold text-zinc-900">{row.label || '—'}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums"><span className="font-bold text-zinc-900">{formatMoney(row.periodTotal)}</span><span className="block text-[11px] text-zinc-500">{`${row.periodUses}×`}</span></td>
                    <td className="hidden px-3 py-2 text-right tabular-nums text-zinc-600 sm:table-cell">{formatMoney(row.total)}<span className="block text-[11px] text-zinc-500">{`${row.uses}×`}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.rows.length > 8 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="w-full border-t border-zinc-100 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-50">{showAll ? 'Pokaż mniej' : `Pokaż wszystkie (${data.rows.length})`}</button>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="mk-events" className="flex flex-col gap-2 lg:col-span-2">
        <h3 id="mk-events" className="text-base font-black text-zinc-900">Ostatnio odebrane</h3>
        {data.events.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">Nikt jeszcze nic nie odebrał.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
            {data.events.slice(0, 10).map((event) => (
              <li key={event.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <SourceBadge source={event.source} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-zinc-900">{event.label}</span>
                  <span className="text-[11px] text-zinc-500">{new Date(event.created_at).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </span>
                <span className="shrink-0 font-bold tabular-nums text-zinc-900">{formatMoney(event.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function SourceBadge({ source }: { source: Overview['rows'][number]['source'] }) {
  const wheel = source === 'wheel'
  return (
    <span className={cn('grid size-6 shrink-0 place-items-center rounded-md', wheel ? 'bg-zinc-900 text-white' : 'bg-primary/10 text-primary')} title={wheel ? 'Koło fortuny' : 'Kod rabatowy'}>
      {wheel ? <Disc3 className="size-3.5" aria-hidden="true" /> : <TicketPercent className="size-3.5" aria-hidden="true" />}
      <span className="sr-only">{wheel ? 'Koło fortuny' : 'Kod rabatowy'}</span>
    </span>
  )
}
