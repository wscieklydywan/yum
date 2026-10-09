'use client'

import { Bike, Check, ChefHat, CircleCheck, FileText, Hourglass, PackageCheck, Printer, ShoppingBag, Store, TriangleAlert, Undo2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/menu'
import { cn } from '@/lib/utils'
import { formatItem, orderProblems, orderSources, orderTypeMeta, pendingItems, stationLabels, stationProgress, type KitchenOrder, type OrderAction, type Station } from './order-data'
import { OrderTimer } from './order-timer'
import { ScheduledCountdown } from './scheduled-countdown'

export type OrderPermissions = { canManage: boolean; canHandOff: boolean; canKitchen: boolean }

type WorkshopOrderCardProps = {
  order: KitchenOrder
  selected: boolean
  now: number | null
  permissions: OrderPermissions
  onSelect: (order: KitchenOrder) => void
  onPrint: (order: KitchenOrder) => void
  onAction: (order: KitchenOrder, action: OrderAction, index?: number, value?: string) => void
  onCancelOrder: (order: KitchenOrder) => void
}

export function WorkshopOrderCard({ order, selected, now, permissions, onSelect, onPrint, onAction, onCancelOrder }: WorkshopOrderCardProps) {
  const Icon = order.type === 'Dostawa' ? Bike : order.type === 'Stacjonarnie' ? Store : ShoppingBag
  const source = orderSources[order.source ?? 'yummy']
  const branded = order.source === 'glovo' || order.source === 'pyszne'
  const problems = orderProblems(order)
  const missing = pendingItems(order)
  const cashier = stationProgress(order, 'cashier')

  const typeMeta = orderTypeMeta[order.type]

  return <article aria-label={`Zamówienie ${order.id}, ${typeMeta.short}`} className={cn('workshop-order type-edge overflow-hidden rounded-xl border bg-card shadow-sm transition-colors', `type-${typeMeta.tone}`, branded && `source-${order.source}`, problems.length > 0 && 'border-destructive/60', selected ? 'border-primary/60 ring-1 ring-primary/10' : !branded && problems.length === 0 && 'border-border')}>
    <button type="button" onClick={() => onSelect(order)} aria-label={`Szczegóły zamówienia ${order.id}`} className="flex w-full items-start gap-2.5 p-3.5 pb-2.5 pl-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:gap-3 md:p-4 md:pb-3 md:pl-[1.125rem]">
      {source.logo ? <img src={source.logo} alt={source.label} width={40} height={40} className="size-9 shrink-0 md:size-10" /> : <span className="type-soft grid size-9 shrink-0 place-items-center rounded-lg md:size-10"><Icon className="size-4 md:size-[18px]" aria-hidden="true" /></span>}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-base font-extrabold tracking-tight md:text-lg">{order.id}</span>
          <span className="type-badge inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider md:text-[11px]"><Icon className="size-3" aria-hidden="true" />{typeMeta.short}</span>
        </span>
        <span className="truncate text-[11px] font-medium text-muted-foreground md:text-xs">{order.source && order.source !== 'yummy' ? `${source.label} · ` : ''}{order.customer}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-sm font-extrabold tabular-nums md:text-base">{formatPrice(order.total ?? 0)}</span>
        <span className="text-[11px] tabular-nums text-muted-foreground md:text-xs">{order.created}</span>
      </span>
    </button>

    <div className="flex flex-col gap-2.5 px-3.5 pb-3.5 md:px-4 md:pb-4">
      <ScheduledCountdown order={order} now={now} />
      <OrderTimer order={order} now={now} />

      {order.status === 'new' ? <>
        <ul className="flex flex-col gap-1.5">
          {order.items.map((item, index) => <li key={`${item.name}-${index}`} className="flex items-start gap-2 text-xs md:text-[13px]">
            <span className="w-6 shrink-0 font-bold tabular-nums md:w-7">{item.quantity}×</span>
            <span className="min-w-0 flex-1"><span className="font-semibold">{item.name}</span>{item.options && <span className="block text-[11px] leading-relaxed text-muted-foreground md:text-xs">{item.options}</span>}</span>
            <StationChip station={item.station ?? 'kitchen'} />
          </li>)}
        </ul>
        {order.note && <p className="rounded-lg bg-muted p-2.5 text-[11px] leading-relaxed"><span className="font-bold">Uwagi: </span>{order.note}</p>}
        {permissions.canManage && <div className="flex gap-2">
          <Button className="h-11 flex-1 text-sm font-bold" onClick={() => onAction(order, 'accept')}><Check data-icon="inline-start" />Akceptuj zamówienie</Button>
          <Button variant="outline" size="icon" className="size-11" aria-label={`Odrzuć zamówienie ${order.id}`} onClick={() => onCancelOrder(order)}><X /></Button>
        </div>}
      </> : <>
        <div className="flex flex-col gap-1.5">
          <StationRow order={order} station="kitchen" />
          <StationRow order={order} station="cashier" />
        </div>

        {problems.map((item) => <div key={item.index} role="alert" className="flex flex-col gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
          <p className="flex items-start gap-1.5 font-semibold"><TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" /><span>{stationLabels[item.station ?? 'kitchen']}: {item.problem} · {formatItem(item)}</span></p>
          {permissions.canManage && <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="destructive" onClick={() => onAction(order, 'cancel_item', item.index, 'true')}>Anuluj pozycję</Button>
            <Button size="sm" variant="outline" className="bg-card" onClick={() => onAction(order, 'resolve_problem', item.index)}>Rozwiązane</Button>
          </div>}
        </div>)}

        {permissions.canManage && cashier.total > 0 && <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Twoje pozycje</p>
          {cashier.items.map((item) => <ItemToggle key={item.index} done={!!item.done} label={formatItem(item)} options={item.options} onToggle={() => onAction(order, 'toggle_item', item.index, String(!item.done))} />)}
        </div>}

        {order.status === 'ready' ? <div className="flex flex-col gap-2 rounded-lg bg-emerald-50 p-2.5">
          <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-800"><CircleCheck className="size-4" aria-hidden="true" />Gotowe do wydania</p>
          {permissions.canHandOff && <Button className="h-11 bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700" onClick={() => onAction(order, 'hand_off')}><PackageCheck data-icon="inline-start" />Wydane</Button>}
        </div> : missing.length > 0 && <p className="text-[11px] leading-relaxed text-muted-foreground"><span className="font-semibold text-foreground">Brakuje: </span>{missing.map(formatItem).join(', ')}</p>}
      </>}

      <div className="flex items-center justify-between gap-1 border-t border-border pt-2">
        <Button variant="ghost" size="sm" onClick={() => onSelect(order)}><FileText data-icon="inline-start" />Szczegóły</Button>
        <Button variant="ghost" size="sm" onClick={() => onPrint(order)} aria-label={`Paragon ${order.id}`}><Printer data-icon="inline-start" />Paragon</Button>
      </div>
    </div>
  </article>
}

export function StationChip({ station }: { station: Station }) {
  return <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold', station === 'kitchen' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800')}>{stationLabels[station]}</span>
}

function StationRow({ order, station }: { order: KitchenOrder; station: Station }) {
  const { done, total, items } = stationProgress(order, station)
  if (total === 0) return null
  const complete = done === total
  const hasProblem = items.some((item) => item.problem)
  const StationIcon = station === 'kitchen' ? ChefHat : Store
  return <div className="flex items-center gap-2 text-xs">
    <StationIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    <span className="w-14 shrink-0 font-semibold">{stationLabels[station]}</span>
    <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true"><span className={cn('block h-full rounded-full transition-all', hasProblem ? 'bg-destructive' : complete ? 'bg-emerald-500' : 'bg-amber-500')} style={{ width: `${(done / total) * 100}%` }} /></span>
    <span className="w-8 shrink-0 text-right font-bold tabular-nums">{done}/{total}</span>
    {hasProblem ? <TriangleAlert className="size-4 shrink-0 text-destructive" aria-label="Problem" /> : complete ? <CircleCheck className="size-4 shrink-0 text-emerald-600" aria-label="Gotowe" /> : <Hourglass className="size-4 shrink-0 text-amber-600" aria-label="W przygotowaniu" />}
  </div>
}

export function ItemToggle({ done, label, options, problem, large, onToggle }: { done: boolean; label: string; options?: string; problem?: string; large?: boolean; onToggle: () => void }) {
  return <button type="button" role="checkbox" aria-checked={done} onClick={onToggle} className={cn('flex w-full items-center gap-3 rounded-lg border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', large ? 'min-h-14 px-3 py-2.5' : 'min-h-11 px-2.5 py-2', done ? 'border-emerald-200 bg-emerald-50' : problem ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-card hover:bg-muted/60')}>
    <span className={cn('grid shrink-0 place-items-center rounded-md border-2', large ? 'size-7' : 'size-5', done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-muted-foreground/40')}>{done && <Check className={large ? 'size-4' : 'size-3'} strokeWidth={3} aria-hidden="true" />}</span>
    <span className="min-w-0 flex-1">
      <span className={cn('block font-bold', large ? 'text-base' : 'text-xs', done && 'text-muted-foreground line-through')}>{label}</span>
      {options && <span className={cn('block leading-relaxed text-muted-foreground', large ? 'text-sm' : 'text-[11px]')}>{options}</span>}
      {problem && <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-destructive"><TriangleAlert className="size-3" aria-hidden="true" />{problem}</span>}
    </span>
    {done && large && <Undo2 className="size-4 shrink-0 text-muted-foreground" aria-label="Cofnij" />}
  </button>
}
