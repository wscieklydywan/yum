'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Bike, History, Search, ShoppingBag, Store } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { hasRefundableItems, hasUnbilledItems, statusLabels, type KitchenOrder, type OrderAction } from './order-data'
import { orderColumns, toKitchenOrder, type DatabaseOrder } from './order-rows'
import { WorkshopOrderDetails } from './workshop-order-details'
import type { OrderPermissions } from './workshop-order-card'

export const HISTORY_KEY = 'workshop-order-history'

const ranges = [
  { id: 'today', label: 'Dziś', days: 0 },
  { id: 'week', label: '7 dni', days: 7 },
  { id: 'month', label: '30 dni', days: 30 },
] as const
type RangeId = (typeof ranges)[number]['id']

const filters = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'handed_off', label: 'Wydane' },
  { id: 'cancelled', label: 'Anulowane' },
] as const
type FilterId = (typeof filters)[number]['id']

function rangeStart(days: number) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - days)
  return start.toISOString()
}

async function fetchHistory([, range]: [string, RangeId]) {
  const days = ranges.find((entry) => entry.id === range)?.days ?? 0
  const { data, error } = await createClient().from('orders').select(orderColumns)
    .in('status', ['handed_off', 'cancelled'])
    .gte('created_at', rangeStart(days))
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) throw error
  return (data as DatabaseOrder[]).map(toKitchenOrder)
}

const formatTime = (value?: string) => value ? new Date(value).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' }) : '—'
const formatDay = (value?: string) => value ? new Date(value).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', timeZone: 'Europe/Warsaw' }) : ''
const formatMoney = (value?: number) => `${(value ?? 0).toFixed(2).replace('.', ',')} zł`

type WorkshopOrderHistoryProps = {
  now: number | null
  permissions: OrderPermissions
  onAction: (order: KitchenOrder, action: OrderAction) => Promise<boolean>
  onPrint: (order: KitchenOrder) => void
  onRefund: (order: KitchenOrder) => void
}

export function WorkshopOrderHistory({ now, permissions, onAction, onPrint, onRefund }: WorkshopOrderHistoryProps) {
  const [range, setRange] = useState<RangeId>('today')
  const [filter, setFilter] = useState<FilterId>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { data: orders = [], error, isLoading, mutate } = useSWR([HISTORY_KEY, range], fetchHistory, { refreshInterval: 30000 })

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pl-PL')
    return orders.filter((order) => (filter === 'all' || order.status === filter)
      && (!term || `${order.id} ${order.customer} ${order.phone} ${order.items.map((item) => item.name).join(' ')}`.toLocaleLowerCase('pl-PL').includes(term)))
  }, [orders, filter, search])
  const selected = visible.find((order) => order.databaseId === selectedId) ?? visible[0]

  async function handleAction(order: KitchenOrder, action: OrderAction) {
    if (await onAction(order, action)) {
      setMobileOpen(false)
      await mutate()
    }
  }

  function select(order: KitchenOrder) {
    setSelectedId(order.databaseId ?? null)
    setMobileOpen(window.matchMedia('(max-width: 1279px)').matches)
  }

  const details = (order: KitchenOrder, onClose?: () => void, scrollWhole = false) => <WorkshopOrderDetails order={order} now={now} permissions={permissions} onClose={onClose} scrollWhole={scrollWhole}
    onPrint={() => { setMobileOpen(false); onPrint(order) }}
    onRefund={() => { setMobileOpen(false); onRefund(order) }}
    onAction={(action) => void handleAction(order, action)}
    onCancelOrder={() => {}} onEditItem={() => {}} />

  return <>
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2"><History className="size-[17px] text-primary" aria-hidden="true" /><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b827a]">Zamówienia zakończone</p></div>
        <h1 className="mt-1 text-[21px] font-extrabold tracking-tight sm:text-[24px]">Historia</h1>
      </div>
      <div role="group" aria-label="Zakres dat" className="flex rounded-xl border border-[#e5ded6] bg-[#eae5de] p-1">
        {ranges.map((option) => <button key={option.id} type="button" aria-pressed={range === option.id} onClick={() => setRange(option.id)} className={cn('h-8 rounded-lg px-3 text-xs font-semibold transition-colors md:h-10 md:px-4 md:text-sm', range === option.id ? 'bg-white text-[#211e1b] shadow-sm' : 'text-[#706961] hover:text-[#211e1b]')}>{option.label}</button>)}
      </div>
    </div>

    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
      <div role="group" aria-label="Status" className="flex gap-1.5">
        {filters.map((option) => {
          const count = option.id === 'all' ? orders.length : orders.filter((order) => order.status === option.id).length
          return <button key={option.id} type="button" aria-pressed={filter === option.id} onClick={() => setFilter(option.id)} className={cn('flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors md:h-11 md:px-4 md:text-sm', filter === option.id ? 'border-[#211e1b] bg-[#211e1b] text-white' : 'border-[#e5ded6] bg-white text-[#514a45] hover:border-[#c9c0b6]')}>{option.label}<span className={cn('tabular-nums', filter === option.id ? 'text-white/70' : 'text-[#938b83]')}>{count}</span></button>
        })}
      </div>
      <label className="flex h-9 flex-1 items-center gap-2 rounded-xl border border-[#e8e3dd] bg-white px-3 sm:ml-auto sm:max-w-xs md:h-11 md:max-w-sm">
        <Search className="size-4 shrink-0 text-[#6f6963]" aria-hidden="true" /><span className="sr-only">Szukaj w historii</span>
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Numer, klient, danie…" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[#8d8780] md:text-sm" />
      </label>
    </div>

    <div className="grid items-start gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_380px] xl:grid-rows-[minmax(0,1fr)] 2xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="overflow-hidden rounded-2xl border border-[#e9e3dc] bg-[#fffdfa] xl:max-h-full xl:overflow-y-auto xl:overscroll-contain">
        {error ? <p className="px-4 py-10 text-center text-[12px] text-red-700">Nie udało się pobrać historii.</p>
          : isLoading ? <p className="px-4 py-10 text-center text-[12px] text-[#847c74]">Wczytywanie…</p>
          : visible.length === 0 ? <p className="px-4 py-10 text-center text-[12px] text-[#847c74]">Brak zakończonych zamówień w tym okresie.</p>
          : <ul className="divide-y divide-[#f0ece7]">
            {visible.map((order) => {
              const Icon = order.type === 'Dostawa' ? Bike : order.type === 'Stacjonarnie' ? Store : ShoppingBag
              const active = selected?.databaseId === order.databaseId
              const cancelled = order.status === 'cancelled'
              return <li key={order.databaseId}>
                <button type="button" onClick={() => select(order)} aria-current={active ? 'true' : undefined} className={cn('flex w-full items-center gap-3 px-4 py-3 text-left md:gap-4 md:px-5 md:py-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary', active ? 'bg-primary/5' : 'hover:bg-[#f7f3ef]')}>
                  <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg md:size-12 md:rounded-xl', cancelled ? 'bg-red-50 text-red-700' : 'bg-[#f3f0ec] text-[#3b3632]')}><Icon className="size-4 md:size-5" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2"><span className={cn('text-sm font-extrabold md:text-lg', cancelled && 'text-[#8b827a] line-through')}>{order.id}</span><span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-semibold md:px-2 md:text-xs', cancelled ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700')}>{statusLabels[order.status]}</span>
                      {order.status === 'handed_off' && hasUnbilledItems(order) && <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">Bez paragonu</span>}
                      {hasRefundableItems(order) && order.items.some((item) => (item.refunded ?? 0) > 0) && <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">Zwrot</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-[#756e67] md:text-sm">{order.type} · {order.customer} · {order.items.filter((item) => !item.cancelled).map((item) => `${item.quantity}× ${item.name}`).join(', ')}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[12px] font-bold tabular-nums md:text-base">{formatMoney(order.total)}</span>
                    <span className="block text-[10px] tabular-nums text-[#857d75] md:text-xs">{range !== 'today' && `${formatDay(order.receivedAt)} · `}{formatTime(cancelled ? order.cancelledAt : order.handedOffAt)}</span>
                  </span>
                </button>
              </li>
            })}
          </ul>}
      </div>
      <aside aria-label="Szczegóły wybranego zamówienia" className="hidden h-full min-h-0 overflow-y-auto overscroll-contain rounded-2xl xl:block">{selected ? <div className="pb-24">{details(selected, undefined, true)}</div> : <div className="grid h-full place-items-center rounded-2xl border border-dashed border-[#d8d0c7] text-[12px] text-[#847c74]">Wybierz zamówienie</div>}</aside>
    </div>

    <Dialog open={mobileOpen && !!selected} onOpenChange={setMobileOpen}>
      <DialogContent showCloseButton={false} aria-describedby={undefined} className="workshop-dashboard max-h-[92dvh] gap-0 overflow-hidden p-0 sm:max-w-xl md:max-w-2xl">
        <DialogTitle className="sr-only">Szczegóły zamówienia {selected?.id}</DialogTitle>
        {selected && <div className="flex max-h-[calc(90dvh/var(--ui-zoom,1))] min-h-0 flex-col">{details(selected, () => setMobileOpen(false))}</div>}
      </DialogContent>
    </Dialog>
  </>
}
