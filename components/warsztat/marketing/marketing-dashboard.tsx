'use client'

import useSWR from 'swr'
import { AlertTriangle, BarChart3, CalendarClock, CalendarDays, Coins, Crown, Gamepad2, Gift, Info, Layers, Loader2, Plus, Smartphone, Sparkles, Star, Tag, TicketPercent, Users, Wallet, Zap, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/marketing'
import { dashboardFetcher, MARKETING_DASHBOARD_KEY, type MarketingDashboard, type ScheduleItem } from '@/lib/marketing-dashboard'
import { Card, CardHeading, KpiCard, ModuleTile, ProgramCard, RowButton, type ProgramStat, type StatusTone } from './dashboard-parts'

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

  const { kpi, programs: p, installs } = data
  const gamesLive = [p.games.wheelEnabled, p.games.halloween === 'live', p.games.advent === 'live'].filter(Boolean).length
  const gamesStatus = gamesLive ? { tone: 'on' as const, label: `${gamesLive} aktywne` } : p.games.halloween === 'upcoming' || p.games.advent === 'teaser' ? { tone: 'soon' as const, label: 'Wkrótce' } : { tone: 'off' as const, label: 'Wyłączone' }
  const promoStatus = p.promos.active + p.promos.codes > 0 ? { tone: 'on' as const, label: 'Aktywne' } : { tone: 'off' as const, label: 'Brak aktywnych' }

  const modules: Array<ModuleDef> = [
    { id: 'club-tiers', icon: Crown, featured: true, title: 'Yummy Club', description: `Program lojalnościowy: ${p.club.rate}. Poziomy Fan, nagrody za Stars i rabaty.`, detail: `${p.club.rate} · ${p.club.rewards} nagród`,
      status: { tone: 'on', label: `${number.format(p.club.members)} członków` }, stats: [{ label: 'Członkowie', value: number.format(p.club.members) }, { label: 'Poziomy', value: String(p.club.tiers) }, { label: 'Nagrody', value: String(p.club.rewards) }] },
    { id: 'club-customers', icon: Users, title: 'Klienci', description: 'Lista członków, saldo Stars, ręczne przyznawanie punktów i prośby o stare punkty.', detail: `+${p.customers.newMembers} nowych w tym miesiącu`,
      status: p.customers.pendingRecovery ? { tone: 'soon', label: `${p.customers.pendingRecovery} prośby` } : { tone: 'on', label: number.format(p.customers.total) },
      stats: [{ label: 'Wszyscy', value: number.format(p.customers.total) }, { label: 'Nowi', value: `+${p.customers.newMembers}`, tone: p.customers.newMembers ? 'on' : 'off' }, { label: 'Prośby', value: String(p.customers.pendingRecovery), tone: p.customers.pendingRecovery ? 'soon' : 'off' }] },
    { id: 'promotions', icon: Tag, title: 'Promocje i kody', description: 'Automatyczne obniżki w wybrane dni i godziny oraz kody rabatowe na ulotki i SMS.', detail: p.promos.maxDiscount ? `Maks. rabat −${p.promos.maxDiscount}%` : 'Obniżki i kody rabatowe',
      status: promoStatus, stats: [{ label: 'Promocje', value: String(p.promos.active), tone: p.promos.active ? 'on' : 'off' }, { label: 'Kody', value: String(p.promos.codes), tone: p.promos.codes ? 'on' : 'off' }, { label: 'Maks. rabat', value: p.promos.maxDiscount ? `−${p.promos.maxDiscount}%` : '—' }] },
    { id: 'wheel', icon: Gamepad2, title: 'Gry i wydarzenia', description: 'Koło fortuny, gra Halloween i kalendarz adwentowy.', detail: gamesDetail(p.games),
      status: gamesStatus, stats: [{ label: 'Koło', value: p.games.wheelEnabled ? 'Wł.' : 'Wył.', tone: p.games.wheelEnabled ? 'on' : 'off' }, { label: 'Halloween', value: eventLabel(p.games.halloween), tone: p.games.halloween === 'live' ? 'on' : p.games.halloween === 'upcoming' ? 'soon' : 'off' }, { label: 'Adwent', value: eventLabel(p.games.advent), tone: p.games.advent === 'live' ? 'on' : p.games.advent === 'teaser' ? 'soon' : 'off' }] },
    { id: 'home-slides', icon: Layers, title: 'Zawartość aplikacji', description: 'Slider na stronie głównej aplikacji i wyróżniony burger tygodnia.', detail: p.content.burgerWeek ? `Burger tygodnia${p.content.burgerWeekUntil ? ` do ${dayMonth(p.content.burgerWeekUntil)}` : ''}` : 'Slider i burger tygodnia',
      status: { tone: p.content.visibleSlides ? 'on' : 'off', label: `${p.content.visibleSlides}/${p.content.totalSlides} slajdów` },
      stats: [{ label: 'Slajdy', value: `${p.content.visibleSlides}/${p.content.totalSlides}` }, { label: 'Burger tyg.', value: p.content.burgerWeek ? 'Wł.' : 'Wył.', tone: p.content.burgerWeek ? 'on' : 'off' }, { label: 'Do', value: p.content.burgerWeekUntil ? dayMonth(p.content.burgerWeekUntil) : '—' }] },
    { id: 'stats', icon: BarChart3, title: 'Statystyki', description: 'Sprzedaż z podziałem na kanały, koszt marketingu, aktywność i zdrowie klubu.', detail: `Ten miesiąc: ${formatMoney(kpi.sales.value)} · ${ordersLabel(kpi.sales.orders)}`,
      status: { tone: 'on', label: 'Sprzedaż i koszty' }, stats: [{ label: 'Sprzedaż', value: formatMoney(kpi.sales.value) }, { label: 'Zamówienia', value: number.format(kpi.sales.orders) }, { label: 'Koszt', value: formatMoney(kpi.rewardCost.value) }] },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
      {data.alerts.length > 0 ? <Alerts data={data} onOpen={onOpen} className="lg:hidden" /> : null}
      <Schedule items={data.schedule} onOpen={onOpen} className="lg:hidden" />

      <section aria-label="Najważniejsze liczby" className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <KpiCard icon={Wallet} value={formatMoney(kpi.sales.value)} label="Sprzedaż · ten miesiąc" trend={kpi.sales} hint={`${ordersLabel(kpi.sales.orders)} · śr. ${formatMoney(kpi.sales.avgBasket)}`} />
        <KpiCard icon={Gift} value={formatMoney(kpi.rewardCost.value)} label="Koszt marketingu" trend={kpi.rewardCost} invert hint={kpi.rewardCost.costRatio === null ? 'Rabaty, nagrody i koło' : `${kpi.rewardCost.costRatio}% sprzedaży klubu`} />
        <KpiCard icon={Users} value={number.format(kpi.activeCustomers.value)} label="Aktywni klienci · 30 dni" trend={kpi.activeCustomers} hint={`z ${number.format(kpi.activeCustomers.total)} członków`} />
        <KpiCard icon={Smartphone} value={number.format(installs.total)} label="Instalacje aplikacji" hint={`+${installs.month} w tym miesiącu · ${installs.active30} aktywnych`} />
      </section>

      <section aria-labelledby="mk-modules" className="flex min-w-0 flex-col gap-2.5">
        <h3 id="mk-modules" className="text-sm font-extrabold text-zinc-900 sm:text-base">Moduły</h3>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:hidden">
          {modules.map((m) => <ModuleTile key={m.id} featured={m.featured} icon={m.icon} title={m.title} detail={m.detail} status={m.status} onOpen={() => onOpen(m.id)} />)}
        </div>
        <div className="hidden gap-4 lg:grid lg:grid-cols-3 xl:gap-5">
          {modules.map((m) => <ProgramCard key={m.id} featured={m.featured} icon={m.icon} title={m.title} description={m.description} status={m.status} stats={m.stats} onOpen={() => onOpen(m.id)} />)}
        </div>
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
        <Alerts data={data} onOpen={onOpen} className="hidden lg:block" />
        <Schedule items={data.schedule} onOpen={onOpen} className="hidden lg:block" />
        <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
          <InstallsCard installs={installs} />
          <Card className="p-4 sm:p-5">
            <CardHeading icon={Zap} title="Szybkie działania" />
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1">
              {quickActions.map((action) => <RowButton key={action.id} icon={action.icon} title={action.label} onClick={() => onOpen(action.id)} />)}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

type ModuleDef = { id: string; icon: LucideIcon; title: string; description: string; detail: string; featured?: boolean; status: { tone: StatusTone; label: string }; stats: ProgramStat[] }

function ordersLabel(count: number) {
  const mod10 = count % 10
  const mod100 = count % 100
  const word = count === 1 ? 'zamówienie' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'zamówienia' : 'zamówień'
  return `${number.format(count)} ${word}`
}

function eventLabel(state: string) {
  return state === 'live' ? 'Trwa' : state === 'upcoming' || state === 'teaser' ? 'Wkrótce' : 'Wył.'
}

function InstallsCard({ installs }: { installs: MarketingDashboard['installs'] }) {
  return (
    <Card className="p-4 sm:p-5">
      <CardHeading icon={Smartphone} title="Aplikacja na telefonie" />
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {[
          { label: 'Instalacje', value: installs.total },
          { label: 'iPhone', value: installs.ios },
          { label: 'Android', value: installs.android },
        ].map((item) => (
          <div key={item.label} className="min-w-0 rounded-xl bg-zinc-50 px-2 py-2 text-center">
            <dd className="text-lg font-black tabular-nums text-zinc-900">{number.format(item.value)}</dd>
            <dt className="truncate text-[11px] text-zinc-500">{item.label}</dt>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-zinc-500">{`${number.format(installs.active30)} urządzeń otworzyło aplikację w 30 dni · ${number.format(installs.pushDevices)} z włączonymi powiadomieniami`}</p>
      <p className="mt-1 text-[11px] text-zinc-400">Liczymy od 7.11.2026. Wcześniejsze instalacje pojawią się, gdy klient otworzy aplikację.</p>
    </Card>
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
