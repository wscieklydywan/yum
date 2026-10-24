'use client'

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Bike, Flame, MapPin, ShoppingBag, Store, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatItem, groupBySet, kitchenUrgency, orderSources, orderTypeLabel, orderTypeMeta, stationProgress, type IndexedOrderItem, type KitchenOrder, type OrderType } from './order-data'
import { elapsedSeconds, formatElapsed } from './order-timer'
import { ItemToggle, SetGroupBox } from './workshop-order-card'
import { SourceMark } from './source-mark'
import { ScheduledCountdown } from './scheduled-countdown'
import { useNow } from './use-now'

const typeIcons = { Stacjonarnie: Store, 'Odbiór osobisty': ShoppingBag, Dostawa: Bike } satisfies Record<OrderType, unknown>

function polishPlural(count: number, one: string, few: string, many: string) {
  if (count === 1) return one
  const lastDigit = count % 10
  const lastTwo = count % 100
  return lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many
}
const zamowieniaLabel = (count: number) => polishPlural(count, 'zamówienie', 'zamówienia', 'zamówień')

const SOURCE_TAG = /^\[[^\]]+\]\s*/
const CODE_PART = /^(Kod|Kupon|Rabat|Promocja)\b/i
const EXTERNAL_NUMBER_PART = /^Nr\s[^:]+:\s*(.+)$/
const CODE_BENEFIT_PART = /^-\s?\d|gratis|na zamówienie/i

/** Splits the bar note into cooking notes and the platform order number (the kitchen often packs Glovo orders). */
function kitchenNote(note: string | undefined | null) {
  if (!note) return { text: '', externalNumber: null as string | null }
  const kept: string[] = []
  let externalNumber: string | null = null
  let afterCode = false
  for (const raw of note.split(' · ')) {
    const part = raw.replace(SOURCE_TAG, '').trim()
    const isCode: boolean = CODE_PART.test(part)
    const isCodeBenefit: boolean = afterCode && CODE_BENEFIT_PART.test(part)
    const external = part.match(EXTERNAL_NUMBER_PART)
    if (external) externalNumber = external[1].trim()
    else if (part && !isCode && !isCodeBenefit) kept.push(part)
    afterCode = isCode || isCodeBenefit
  }
  return { text: kept.join(' · '), externalNumber }
}

const PLACEHOLDER_CUSTOMER = /^klient(\s|$)/i

/** Just the first name the customer gave; fallback names like „Klient Glovo” are skipped. */
function customerFirstName(customer: string | undefined | null) {
  const name = customer?.trim()
  if (!name || PLACEHOLDER_CUSTOMER.test(name)) return null
  return name.split(/\s+/)[0]
}

const formatKm = (km: number) => `${km.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`

const WORKING_KEY = 'yummy-kitchen-working'

/** Which tickets the cooks marked as „robię teraz” – kept per kitchen device so a reload doesn't lose it. */
function useWorkingSet() {
  const [working, setWorking] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(WORKING_KEY) ?? '[]')
      if (Array.isArray(saved)) setWorking(new Set(saved.filter((id): id is string => typeof id === 'string')))
    } catch {}
  }, [])
  const toggle = useCallback((id: string) => {
    setWorking((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try { window.localStorage.setItem(WORKING_KEY, JSON.stringify([...next])) } catch {}
      return next
    })
  }, [])
  return [working, toggle] as const
}

type KitchenBoardProps = {
  orders: KitchenOrder[]
  onToggle: (order: KitchenOrder, item: IndexedOrderItem) => void
  onProblem: (order: KitchenOrder, item: IndexedOrderItem) => void
}

export function WorkshopKitchenBoard({ orders, onToggle, onProblem }: KitchenBoardProps) {
  const now = useNow()
  // Filtering and counting depend only on the orders; just the urgency sort has to follow the clock.
  const { unsortedTodo, done, typeCounts, pendingCount } = useMemo(() => {
    const withKitchen = orders
      .filter((order) => order.status === 'preparing' || order.status === 'ready')
      .map((order) => ({ order, progress: stationProgress(order, 'kitchen') }))
      .filter(({ progress }) => progress.total > 0)
    const unsortedTodo = withKitchen.filter(({ progress }) => progress.done < progress.total)
    return {
      unsortedTodo,
      done: withKitchen.filter(({ progress }) => progress.done === progress.total).slice(-4).reverse(),
      typeCounts: unsortedTodo.reduce<Record<string, number>>((counts, { order }) => { counts[order.type] = (counts[order.type] ?? 0) + 1; return counts }, {}),
      pendingCount: unsortedTodo.reduce((sum, { progress }) => sum + progress.total - progress.done, 0),
    }
  }, [orders])
  const [typeFilter, setTypeFilter] = useState<OrderType | null>(null)
  const [working, toggleWorking] = useWorkingSet()
  const todo = [...unsortedTodo].sort((a, b) => kitchenUrgency(b.order, now) - kitchenUrgency(a.order, now))
  const activeFilter = typeFilter && typeCounts[typeFilter] ? typeFilter : null
  const visibleTodo = activeFilter ? todo.filter(({ order }) => order.type === activeFilter) : todo
  const workingCount = todo.filter(({ order }) => working.has(order.id)).length

  return <div className="flex flex-col gap-2.5">
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#e5ded6] bg-white p-1.5 shadow-sm">
      <div className="flex items-center gap-2.5 rounded-xl bg-[#211e1b] py-1.5 pl-3 pr-3.5 text-white">
        <span className="text-2xl font-black leading-none tabular-nums">{pendingCount}</span>
        <span className="leading-tight">
          <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">Do zrobienia</span>
          <span className="block text-xs font-semibold">{todo.length} {zamowieniaLabel(todo.length)}</span>
        </span>
      </div>

      {todo.length > 0 && <div role="group" aria-label="Filtruj zamówienia według typu" className="flex flex-wrap items-center gap-1">
        <button type="button" aria-pressed={!activeFilter} onClick={() => setTypeFilter(null)} className={cn('flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', !activeFilter ? 'bg-[#f1ede7] text-[#211e1b]' : 'text-[#706961] hover:bg-[#f7f3ef]')}>
          Wszystkie<span className="tabular-nums text-[#8b827a]">{todo.length}</span>
        </button>
        {(Object.keys(orderTypeMeta) as OrderType[]).map((type) => {
          const meta = orderTypeMeta[type]
          const Icon = typeIcons[type]
          const count = typeCounts[type] ?? 0
          const active = activeFilter === type
          return <button key={type} type="button" disabled={!count} aria-pressed={active} onClick={() => setTypeFilter(active ? null : type)} className={cn(
            'flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-35',
            `type-${meta.tone}`,
            active ? 'type-band shadow-sm' : 'text-[#3a3530] hover:bg-[#f7f3ef]',
          )}>
            <Icon className={cn('size-4 shrink-0', !active && 'text-[var(--type)]')} aria-hidden="true" />{meta.short}
            <span className={cn('grid min-w-5 place-items-center rounded-md px-1 py-0.5 text-[11px] leading-none tabular-nums', active ? 'bg-white/25' : 'type-soft')}>{count}</span>
          </button>
        })}
      </div>}

      {workingCount > 0 && <p className="ml-auto flex h-10 items-center gap-1.5 rounded-xl bg-blue-50 px-3 text-xs font-bold text-blue-700"><Flame className="size-4" aria-hidden="true" />Robię teraz: {workingCount}</p>}
    </div>

    {todo.length === 0 && <div className="rounded-xl border border-dashed border-[#d8d0c7] bg-white/50 px-4 py-8 text-center text-sm text-[#847c74]">Wszystko zrobione. Nowe zamówienia pojawią się tu po akceptacji na barze.</div>}

    <div className="grid items-start gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {visibleTodo.map(({ order, progress }) => <KitchenTicket key={order.id} order={order} items={progress.items} working={working.has(order.id)} onWorking={toggleWorking} onToggle={onToggle} onProblem={onProblem} />)}
    </div>

    {done.length > 0 && <section aria-labelledby="kitchen-done" className="flex flex-col gap-1.5">
      <h2 id="kitchen-done" className="px-0.5 text-[11px] font-bold uppercase tracking-wider text-[#847c74]">Ostatnio zrobione · dotknij, aby cofnąć</h2>
      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
        {done.map(({ order, progress }) => <details key={order.id} className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5 text-xs">
          <summary className="cursor-pointer font-bold text-emerald-900">{(order.source ?? 'yummy') !== 'own' && <SourceMark source={order.source ?? 'yummy'} className="mr-1 inline-grid size-3.5 rounded align-[-2px]" />}{order.id} · {orderTypeMeta[order.type].short} <span className="font-medium text-emerald-700">{progress.done}/{progress.total}</span></summary>
          <div className="mt-1.5 flex flex-col gap-1">{groupBySet(order, progress.items).map((group) => <SetGroupBox key={group.key} group={group}>
            {group.items.map((item) => <ItemToggle key={item.index} done={!!item.done} label={formatItem(item, Boolean(group.set))} options={item.options} onToggle={() => onToggle(order, item)} />)}
          </SetGroupBox>)}</div>
        </details>)}
      </div>
    </section>}
  </div>
}

function KitchenTimer({ receivedAt }: { receivedAt: string | undefined }) {
  const now = useNow()
  const seconds = elapsedSeconds(receivedAt, now)
  const level = seconds !== null && seconds >= 1200 ? 'late' : seconds !== null && seconds >= 600 ? 'warning' : 'normal'
  return <span className={cn('order-timer rounded-md px-2 py-0.5 font-mono text-sm font-bold tabular-nums', `timer-${level}`)} role="timer" aria-label="Czas od przyjęcia">{formatElapsed(seconds)}</span>
}

type TicketProps = { order: KitchenOrder; items: IndexedOrderItem[]; working: boolean; onWorking: (id: string) => void } & Pick<KitchenBoardProps, 'onToggle' | 'onProblem'>

// Tickets re-render only when their own order changes; the timer inside ticks on its own.
const KitchenTicket = memo(function KitchenTicket({ order, items, working, onWorking, onToggle, onProblem }: TicketProps) {
  const Icon = typeIcons[order.type]
  const meta = orderTypeMeta[order.type]
  const sourceKey = order.source ?? 'yummy'
  const source = sourceKey !== 'own' ? orderSources[sourceKey] : null
  const note = useMemo(() => kitchenNote(order.note), [order.note])
  const firstName = customerFirstName(order.customer)
  const showAddress = order.type === 'Dostawa' && (order.address || order.distanceKm != null)

  return <article aria-label={`Zamówienie ${order.id}, ${meta.short}`} className={cn('overflow-hidden rounded-xl border shadow-sm transition-colors', `type-${meta.tone}`, working ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-600' : 'border-border bg-card')}>
    <div className="type-band flex items-center gap-1.5 px-2.5 py-1">
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <p className="flex-1 truncate text-xs font-black uppercase tracking-wide">{orderTypeLabel(order, meta.short)}</p>
    </div>
    <header className="flex items-center gap-2 border-b border-border px-2.5 py-1.5">
        {source && <SourceMark source={sourceKey} decorative className="size-6" />}
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-1.5 leading-tight">
          <span className="text-lg font-black tracking-tight">{order.id}</span>
          {note.externalNumber && <span className="truncate rounded bg-amber-100 px-1 text-xs font-bold text-amber-900">{source?.label ?? 'Nr'} #{note.externalNumber}</span>}
        </p>
        {(firstName || (source && !note.externalNumber)) && <p className="flex min-w-0 items-baseline gap-1.5 text-muted-foreground">
          {source && !note.externalNumber && <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide">{source.label}</span>}
          {firstName && <span className="truncate text-[13px] italic"><span className="sr-only">Klient: </span>{firstName}</span>}
        </p>}
      </div>
      <div className="shrink-0">
        <KitchenTimer receivedAt={order.receivedAt} />
      </div>
    </header>
    {showAddress && <p className={cn('flex items-start gap-1.5 border-b border-border px-2.5 py-1.5 text-[13px] leading-snug', working ? 'bg-white' : 'bg-muted/40')}>
      <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1">{order.address || 'Adres na barze'}</span>
      {order.distanceKm != null && <span className="shrink-0 font-bold tabular-nums">{formatKm(order.distanceKm)}</span>}
    </p>}
    <div className="flex flex-col gap-1.5 p-2">
      <ScheduledCountdown order={order} />
      {note.text && <p className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold leading-snug text-amber-900">{note.text}</p>}
      {groupBySet(order, items).map((group) => <SetGroupBox key={group.key} group={group}>
        {group.items.map((item) => <div key={item.index} className="flex items-stretch gap-1.5">
          <div className="min-w-0 flex-1"><ItemToggle done={!!item.done} label={formatItem(item, Boolean(group.set))} options={item.options} problem={item.problem} readable onToggle={() => onToggle(order, item)} /></div>
          {!item.done && !item.problem && <button type="button" onClick={() => onProblem(order, item)} aria-label={`Zgłoś problem: ${formatItem(item)}`} className="grid w-9 shrink-0 place-items-center rounded-lg border border-border bg-card text-orange-300 transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><TriangleAlert className="size-4" aria-hidden="true" /></button>}
        </div>)}
      </SetGroupBox>)}
      <button type="button" aria-pressed={working} onClick={() => onWorking(order.id)} className={cn('flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', working ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-dashed border-border text-muted-foreground hover:bg-muted/60')}>
        <Flame className="size-3.5" aria-hidden="true" />{working ? 'Robię teraz · odznacz' : 'Zaznacz: robię teraz'}
      </button>
    </div>
  </article>
})
