'use client'

import { useState } from 'react'
import { Bike, ShoppingBag, Store, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatItem, kitchenUrgency, orderSources, orderTypeMeta, stationProgress, type IndexedOrderItem, type KitchenOrder, type OrderType } from './order-data'
import { elapsedSeconds, formatElapsed } from './order-timer'
import { ItemToggle } from './workshop-order-card'
import { ScheduledCountdown } from './scheduled-countdown'

const typeIcons = { Stacjonarnie: Store, 'Odbiór osobisty': ShoppingBag, Dostawa: Bike } satisfies Record<OrderType, unknown>

function polishPlural(count: number, one: string, few: string, many: string) {
  if (count === 1) return one
  const lastDigit = count % 10
  const lastTwo = count % 100
  return lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many
}
const pozycjeLabel = (count: number) => polishPlural(count, 'pozycja', 'pozycje', 'pozycji')
const zamowieniaLabel = (count: number) => polishPlural(count, 'zamówienie', 'zamówienia', 'zamówień')

const SOURCE_TAG = /^\[[^\]]+\]\s*/
const CODE_PART = /^(Kod|Kupon|Rabat)\b/i
const EXTERNAL_NUMBER_PART = /^Nr\s[^:]+:/
const CODE_BENEFIT_PART = /^-\s?\d|gratis|na zamówienie/i

/** The kitchen only needs cooking notes – codes, coupons, discounts and external platform numbers stay on the bar. */
function kitchenNote(note: string | undefined | null) {
  if (!note) return ''
  const kept: string[] = []
  let afterCode = false
  for (const raw of note.split(' · ')) {
    const part = raw.replace(SOURCE_TAG, '').trim()
    const isCode: boolean = CODE_PART.test(part)
    const isCodeBenefit: boolean = afterCode && CODE_BENEFIT_PART.test(part)
    if (part && !isCode && !isCodeBenefit && !EXTERNAL_NUMBER_PART.test(part)) kept.push(part)
    afterCode = isCode || isCodeBenefit
  }
  return kept.join(' · ')
}

type KitchenBoardProps = {
  orders: KitchenOrder[]
  now: number | null
  onToggle: (order: KitchenOrder, item: IndexedOrderItem) => void
  onProblem: (order: KitchenOrder, item: IndexedOrderItem) => void
}

export function WorkshopKitchenBoard({ orders, now, onToggle, onProblem }: KitchenBoardProps) {
  const withKitchen = orders
    .filter((order) => order.status === 'preparing' || order.status === 'ready')
    .map((order) => ({ order, progress: stationProgress(order, 'kitchen') }))
    .filter(({ progress }) => progress.total > 0)
  const [typeFilter, setTypeFilter] = useState<OrderType | null>(null)
  const todo = withKitchen
    .filter(({ progress }) => progress.done < progress.total)
    .sort((a, b) => kitchenUrgency(b.order, now) - kitchenUrgency(a.order, now))
  const typeCounts = todo.reduce<Record<string, number>>((counts, { order }) => ({ ...counts, [order.type]: (counts[order.type] ?? 0) + 1 }), {})
  const activeFilter = typeFilter && typeCounts[typeFilter] ? typeFilter : null
  const visibleTodo = activeFilter ? todo.filter(({ order }) => order.type === activeFilter) : todo
  const done = withKitchen.filter(({ progress }) => progress.done === progress.total).slice(-4).reverse()
  const pendingCount = todo.reduce((sum, { progress }) => sum + progress.total - progress.done, 0)

  return <div className="flex flex-col gap-4">
    <div className="flex items-center justify-between rounded-2xl bg-[#211e1b] px-4 py-3 text-white lg:px-5 lg:py-4">
      <p className="text-sm font-bold uppercase tracking-wider lg:text-base">Do zrobienia</p>
      <p className="flex items-baseline gap-1.5">
        <span className="text-2xl font-black tabular-nums lg:text-3xl">{pendingCount}</span>
        <span className="text-xs text-white/60 lg:hidden">poz. · {todo.length} zam.</span>
        <span className="hidden text-base text-white/70 lg:inline">{pozycjeLabel(pendingCount)} · <span className="font-bold tabular-nums text-white">{todo.length}</span> {zamowieniaLabel(todo.length)}</span>
      </p>
    </div>

    {todo.length > 0 && <div role="group" aria-label="Filtruj zamówienia według typu" className="grid grid-cols-3 gap-2 lg:flex lg:flex-wrap lg:gap-3">
      {(Object.keys(orderTypeMeta) as OrderType[]).map((type) => {
        const meta = orderTypeMeta[type]
        const Icon = typeIcons[type]
        const count = typeCounts[type] ?? 0
        const active = activeFilter === type
        return <button key={type} type="button" disabled={!count} aria-pressed={active} onClick={() => setTypeFilter(active ? null : type)} className={cn(
          'type-soft flex h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 lg:h-14 lg:min-w-44 lg:px-5 lg:text-lg',
          `type-${meta.tone}`,
          active && 'ring-2 ring-[#211e1b] ring-offset-2',
          activeFilter && !active && 'opacity-50',
        )}>
          <Icon className="size-5 shrink-0 lg:size-6" aria-hidden="true" />{meta.short}<span className="rounded-md bg-white/70 px-1.5 tabular-nums">{count}</span>
        </button>
      })}
      {activeFilter && <button type="button" onClick={() => setTypeFilter(null)} className="col-span-3 h-11 rounded-xl border border-[#d8d0c7] bg-white px-4 text-sm font-bold text-[#211e1b] hover:bg-[#f4efe9] lg:col-span-1 lg:h-14 lg:text-lg">Pokaż wszystkie</button>}
    </div>}

    {todo.length === 0 && <div className="rounded-2xl border border-dashed border-[#d8d0c7] bg-white/50 px-4 py-12 text-center text-sm text-[#847c74]">Wszystko zrobione. Nowe zamówienia pojawią się tu po akceptacji na barze.</div>}

    <div className="grid items-start gap-3 md:grid-cols-2 2xl:grid-cols-3">
      {visibleTodo.map(({ order, progress }) => <KitchenTicket key={order.id} order={order} now={now} done={progress.done} total={progress.total} items={progress.items} onToggle={onToggle} onProblem={onProblem} />)}
    </div>

    {done.length > 0 && <section aria-labelledby="kitchen-done" className="flex flex-col gap-2">
      <h2 id="kitchen-done" className="px-0.5 text-xs font-bold uppercase tracking-wider text-[#847c74]">Ostatnio zrobione · dotknij, aby cofnąć</h2>
      <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-4">
        {done.map(({ order, progress }) => <details key={order.id} className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 text-sm">
          <summary className="cursor-pointer font-bold text-emerald-900">{order.source && orderSources[order.source].logo && <img src={orderSources[order.source].logo} alt={orderSources[order.source].label} width={18} height={18} className="mr-1.5 inline size-[18px] rounded align-[-3px]" />}{order.id} · {orderTypeMeta[order.type].short} <span className="font-medium text-emerald-700">{progress.done}/{progress.total}</span></summary>
          <div className="mt-2 flex flex-col gap-1.5">{progress.items.map((item) => <ItemToggle key={item.index} done={!!item.done} label={formatItem(item)} options={item.options} onToggle={() => onToggle(order, item)} />)}</div>
        </details>)}
      </div>
    </section>}
  </div>
}

function KitchenTicket({ order, now, done, total, items, onToggle, onProblem }: { order: KitchenOrder; now: number | null; done: number; total: number; items: IndexedOrderItem[] } & Pick<KitchenBoardProps, 'onToggle' | 'onProblem'>) {
  const Icon = typeIcons[order.type]
  const meta = orderTypeMeta[order.type]
  const seconds = elapsedSeconds(order.receivedAt, now)
  const level = seconds !== null && seconds >= 1200 ? 'late' : seconds !== null && seconds >= 600 ? 'warning' : 'normal'
  const source = order.source && order.source !== 'yummy' ? orderSources[order.source] : null

  return <article aria-label={`Zamówienie ${order.id}, ${meta.short}`} className={cn('overflow-hidden rounded-2xl border border-border bg-card shadow-sm', `type-${meta.tone}`)}>
    <div className="type-band flex items-center gap-2 px-3.5 py-2">
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <p className="flex-1 text-base font-black uppercase tracking-wide">{meta.short}</p>
      <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">{meta.priority}</p>
    </div>
    <header className="flex items-center gap-2.5 border-b border-border px-3.5 py-3">
      {source?.logo && <img src={source.logo} alt="" width={40} height={40} className="size-10 shrink-0 rounded-[10px] shadow-sm" />}
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-black leading-tight tracking-tight">{order.id}</p>
        {source && <p className="truncate text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{source.logo ? `Zewnętrzne · ${source.label}` : source.label}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className={cn('order-timer rounded-md px-2 py-1 font-mono text-sm font-bold tabular-nums', `timer-${level}`)} role="timer" aria-label="Czas od przyjęcia">{formatElapsed(seconds)}</span>
        <span className="text-[11px] font-bold tabular-nums text-muted-foreground">{done}/{total}</span>
      </div>
    </header>
    <div className="flex flex-col gap-2 p-3">
      <ScheduledCountdown order={order} now={now} variant="large" />
      {kitchenNote(order.note) && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold leading-snug text-amber-900">{kitchenNote(order.note)}</p>}
      {items.map((item) => <div key={item.index} className="flex items-stretch gap-2">
        <div className="min-w-0 flex-1"><ItemToggle large done={!!item.done} label={formatItem(item)} options={item.options} problem={item.problem} onToggle={() => onToggle(order, item)} /></div>
        {!item.done && !item.problem && <button type="button" onClick={() => onProblem(order, item)} aria-label={`Zgłoś problem: ${formatItem(item)}`} className="grid w-12 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><TriangleAlert className="size-5" aria-hidden="true" /></button>}
      </div>)}
    </div>
  </article>
}
