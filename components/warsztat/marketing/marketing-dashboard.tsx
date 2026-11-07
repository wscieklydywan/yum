'use client'

import useSWR from 'swr'
import { AlertTriangle, BarChart3, CalendarClock, CalendarDays, Coins, Crown, Gamepad2, Gift, Info, Layers, Loader2, Plus, Sparkles, Star, Tag, TicketPercent, Users, Zap, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/marketing'
import { dashboardFetcher, MARKETING_DASHBOARD_KEY, type MarketingDashboard, type ScheduleItem } from '@/lib/marketing-dashboard'
import { Card, CardHeading, ModuleTile, RowButton } from './dashboard-parts'

const number = new Intl.NumberFormat('pl-PL')
const dayMonth = (value: string) => new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })

const scheduleKind: Record<ScheduleItem['kind'], LucideIcon> = { promo: Tag, code: TicketPercent, event: Gamepad2, content: Star }

const quickActions = [
  { id: 'promotions', label: 'Dodaj promocję', icon: Plus },
  { id: 'codes', label: 'Utwórz kod rabatowy', icon: TicketPercent },
  { id: 'club-rewards', label: 'Dodaj nagrodę', icon: Gift },
  { id: 'club-customers', label: 'Przyznaj Stars klientowi', icon: Coins },
]

export function MarketingDashboard({ onOpen }: { onOpen: (id: string) => void }) {
  const { data, error, isLoading } = useSWR<MarketingDashboard>(MARKETING_DASHBOARD_KEY, dashboardFetcher, { refreshInterval: 300_000, dedupingInterval: 60_000 })

  if (error) return <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error.message}</p>
  if (isLoading || !data) return <div className="flex justify-center p-16"><Loader2 className="size-6 animate-spin text-primary" aria-label="Wczytywanie pulpitu" /></div>

  const { kpi, programs: p } = data
  const gamesLive = [p.games.wheelEnabled, p.games.halloween === 'live', p.games.advent === 'live'].filter(Boolean).length

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 lg:gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
        {data.alerts.length > 0 ? <Alerts data={data} onOpen={onOpen} className="xl:hidden" /> : null}

        <Schedule items={data.schedule} onOpen={onOpen} className="xl:hidden" />

        <section aria-labelledby="mk-modules" className="flex min-w-0 flex-col gap-2.5">
          <h3 id="mk-modules" className="text-sm font-extrabold text-zinc-900 sm:text-base">Moduły</h3>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 2xl:grid-cols-3">
            <ModuleTile featured icon={Crown} title="Yummy Club" detail={`${p.club.rate} · ${p.club.rewards} nagród`} status={{ tone: 'on', label: `${number.format(p.club.members)} członków` }} onOpen={() => onOpen('club-tiers')} />
            <ModuleTile icon={Users} title="Klienci" detail={`+${p.customers.newMembers} nowych w tym miesiącu`}
              status={p.customers.pendingRecovery ? { tone: 'soon', label: `${p.customers.pendingRecovery} prośby` } : { tone: 'on', label: number.format(p.customers.total) }} onOpen={() => onOpen('club-customers')} />
            <ModuleTile icon={Tag} title="Promocje i kody" detail={p.promos.maxDiscount ? `Maks. rabat −${p.promos.maxDiscount}%` : 'Obniżki i kody rabatowe'}
              status={p.promos.active + p.promos.codes > 0 ? { tone: 'on', label: `${p.promos.active} prom. · ${p.promos.codes} kody` } : { tone: 'off', label: 'Brak aktywnych' }} onOpen={() => onOpen('promotions')} />
            <ModuleTile icon={Gamepad2} title="Gry i wydarzenia" detail={gamesDetail(p.games)}
              status={gamesLive ? { tone: 'on', label: `${gamesLive} aktywne` } : p.games.halloween === 'upcoming' || p.games.advent === 'teaser' ? { tone: 'soon', label: 'Wkrótce' } : { tone: 'off', label: 'Wyłączone' }} onOpen={() => onOpen('wheel')} />
            <ModuleTile icon={Layers} title="Zawartość aplikacji" detail={p.content.burgerWeek ? `Burger tygodnia${p.content.burgerWeekUntil ? ` do ${dayMonth(p.content.burgerWeekUntil)}` : ''}` : 'Slider i burger tygodnia'}
              status={{ tone: p.content.visibleSlides ? 'on' : 'off', label: `${p.content.visibleSlides}/${p.content.totalSlides} slajdów` }} onOpen={() => onOpen('home-slides')} />
            <ModuleTile icon={BarChart3} title="Statystyki" detail={`Ten miesiąc: ${formatMoney(kpi.sales.value)} · ${number.format(kpi.sales.orders)} zamówień`} status={{ tone: 'on', label: 'Sprzedaż i koszty' }} onOpen={() => onOpen('stats')} />
          </div>
        </section>
      </div>

      <aside aria-label="Uwagi, terminy i skróty" className="flex min-w-0 flex-col gap-4 lg:gap-5">
        <Alerts data={data} onOpen={onOpen} className={cn('hidden xl:block')} />
        <Schedule items={data.schedule} onOpen={onOpen} className="hidden xl:block" />
        <Card className="p-4 sm:p-5">
          <CardHeading icon={Zap} title="Szybkie działania" />
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1">
            {quickActions.map((action) => <RowButton key={action.id} icon={action.icon} title={action.label} onClick={() => onOpen(action.id)} />)}
          </div>
        </Card>
      </aside>
    </div>
  )
}

function Alerts({ data, onOpen, className }: { data: MarketingDashboard; onOpen: (id: string) => void; className?: string }) {
  const count = data.alerts.length
  return (
    <div className={cn('min-w-0 rounded-2xl border p-4 sm:p-5', count ? 'border-red-100 bg-red-50/60' : 'border-emerald-100 bg-emerald-50/60', className)}>
      <h3 className={cn('flex items-center gap-2 text-sm font-extrabold sm:text-base', count ? 'text-primary' : 'text-emerald-700')}>
        {count ? <AlertTriangle className="size-4" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
        {count ? 'Wymaga uwagi' : 'Wszystko gra'}
        {count > 0 && <span className="ml-auto flex size-6 items-center justify-center rounded-full bg-primary text-xs font-black text-white">{count}</span>}
      </h3>
      {count === 0 ? (
        <p className="mt-2 text-sm text-emerald-800/80">Brak spraw do załatwienia.</p>
      ) : (
        <div className="mt-2 flex flex-col">
          {data.alerts.map((alert) => (
            <RowButton key={alert.id} icon={alert.tone === 'info' ? Info : alert.tone === 'warning' ? CalendarClock : AlertTriangle} title={alert.title} detail={alert.detail} onClick={() => onOpen(alert.target)}
              iconClass={cn('bg-white', alert.tone === 'danger' && 'text-primary', alert.tone === 'warning' && 'text-amber-600', alert.tone === 'info' && 'text-sky-600')} />
          ))}
        </div>
      )}
    </div>
  )
}

function Schedule({ items, onOpen, className }: { items: ScheduleItem[]; onOpen: (id: string) => void; className?: string }) {
  return (
    <div className={cn('min-w-0 rounded-2xl bg-zinc-900 p-4 text-white sm:p-5', className)}>
      <h3 className="flex items-center gap-2 text-sm font-extrabold sm:text-base"><CalendarDays className="size-4 text-primary" aria-hidden="true" />Najbliższe terminy</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-white/60">Nic zaplanowanego. Dodaj promocję z datą startu, żeby pojawiła się tutaj.</p>
      ) : (
        <ol className="mt-2 flex flex-col">
          {items.map((item) => {
            const Icon = scheduleKind[item.kind]
            return (
              <li key={item.id}>
                <button type="button" onClick={() => onOpen(item.target)} className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <time dateTime={item.date} className="w-12 shrink-0 rounded-lg bg-white/10 py-1 text-center text-xs font-bold tabular-nums">{dayMonth(item.date)}</time>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{item.title}</span>
                    <span className="flex items-center gap-1 truncate text-[11px] text-white/55"><Icon className="size-3 shrink-0" aria-hidden="true" />{item.detail}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function gamesDetail(games: MarketingDashboard['programs']['games']) {
  const parts = [games.wheelEnabled ? `Koło: ${games.wheelPrizes} nagród` : 'Koło wyłączone']
  if (games.halloween === 'live') parts.push(`Halloween do ${dayMonth(games.halloweenEnds)}`)
  if (games.advent === 'live') parts.push('Adwent trwa')
  else if (games.advent === 'teaser') parts.push(`Adwent od ${dayMonth(games.adventStarts)}`)
  return parts.join(' · ')
}
