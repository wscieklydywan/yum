'use client'

import { useState } from 'react'
import { Bike, ChevronRight, ClipboardList, LoaderCircle, PiggyBank, ShoppingBag, Sparkles, Store, TicketPercent } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useBackButtonClose } from '@/lib/use-back-button-close'
import { useCustomerOrders, type CustomerOrder } from '@/lib/use-customer-orders'
import { cardClass, ClubCollapsible } from './club-member-sections'

const statusLabels: Record<CustomerOrder['status'], string> = {
  new: 'Złożone',
  preparing: 'W przygotowaniu',
  ready: 'Gotowe',
  handed_off: 'Zrealizowane',
  cancelled: 'Anulowane',
}

export function formatPrice(value: number) {
  return `${value.toFixed(2).replace('.', ',')} zł`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Warsaw',
  }).format(new Date(value))
}

function starsLabel(value: number) {
  if (value === 1) return 'gwiazdka'
  const lastDigit = value % 10
  const lastTwo = value % 100
  return lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14) ? 'gwiazdki' : 'gwiazdek'
}

function statusBadgeClass(status: CustomerOrder['status']) {
  if (status === 'cancelled') return 'bg-muted text-muted-foreground'
  if (status === 'handed_off') return 'bg-emerald-50 text-emerald-800'
  return 'bg-amber-50 text-amber-800'
}

export function orderIcon(type: string) {
  return type === 'Dostawa' ? Bike : type === 'Stacjonarnie' ? Store : ShoppingBag
}

export function ClubOrderHistory({ onStartOrdering }: { onStartOrdering: () => void }) {
  const [selected, setSelected] = useState<CustomerOrder | null>(null)
  const { data: orders = [], error, isLoading } = useCustomerOrders()

  return (
    <ClubCollapsible
      id="zamowienia"
      icon={ClipboardList}
      title="Historia zamówień"
      description="Status, szczegóły i oszczędności"
      aside={!isLoading && !error && orders.length > 0 ? orders.length : undefined}
    >

      {error ? (
        <p role="alert" className={`p-4 text-sm text-muted-foreground ${cardClass}`}>Nie udało się pobrać historii. Spróbuj ponownie za chwilę.</p>
      ) : isLoading ? (
        <div className={`flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground ${cardClass}`}>
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Wczytujemy Twoje zamówienia…
        </div>
      ) : orders.length === 0 ? (
        <div className={`flex flex-col items-center px-5 py-8 text-center ${cardClass}`}>
          <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary"><ClipboardList className="size-5" aria-hidden="true" /></span>
          <h3 className="mt-3 text-sm font-bold">Jeszcze nie masz zamówień</h3>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">Gdy złożysz pierwsze zamówienie po zalogowaniu, znajdziesz je tutaj.</p>
          <button type="button" onClick={onStartOrdering} className="mt-4 h-10 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90">
            Przejdź do menu
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {orders.map((order) => {
            const cancelled = order.status === 'cancelled'
            const Icon = orderIcon(order.type)
            const summary = order.items.slice(0, 3).map((item) => `${item.quantity}× ${item.name}`).join(', ')
            const remaining = order.items.length - 3
            return (
              <li key={`${order.number}-${order.created_at}`}>
                <button
                  type="button"
                  onClick={() => setSelected(order)}
                  aria-label={`Szczegóły zamówienia #${order.number}`}
                  className={`flex w-full gap-3 p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${cardClass}`}
                >
                  <span className={`grid size-10 shrink-0 place-items-center rounded-full ${cancelled ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-extrabold">#{order.number} · {order.type}</span>
                      <span className={`shrink-0 text-sm font-extrabold tabular-nums ${cancelled ? 'text-muted-foreground line-through' : ''}`}>{formatPrice(order.total)}</span>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(order.status)}`}>
                        {statusLabels[order.status]}
                      </span>
                      {!cancelled && order.discount > 0 ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">-{formatPrice(order.discount)}</span>
                      ) : null}
                      <span className="truncate text-[11px] text-muted-foreground">{formatDate(order.created_at)}</span>
                    </span>
                    <span className="mt-1.5 line-clamp-2 block text-xs leading-snug text-muted-foreground">
                      {summary || 'Brak szczegółów pozycji'}{remaining > 0 ? ` i ${remaining} ${remaining === 1 ? 'pozycja' : remaining < 5 ? 'pozycje' : 'pozycji'}` : ''}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 self-center text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <OrderDetailsDialog order={selected} onClose={() => setSelected(null)} />
    </ClubCollapsible>
  )
}

function OrderDetailsDialog({ order, onClose }: { order: CustomerOrder | null; onClose: () => void }) {
  useBackButtonClose(order !== null, (open) => { if (!open) onClose() })
  return (
    <Dialog open={order !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent data-keep-size className="flex max-h-[90svh] w-[calc(100%-1.5rem)] max-w-md flex-col gap-0 overflow-hidden rounded-3xl p-0">
        {order ? <OrderDetails order={order} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function OrderDetails({ order }: { order: CustomerOrder }) {
  const cancelled = order.status === 'cancelled'
  const Icon = orderIcon(order.type)
  const savings = Math.max(order.discount, order.club_savings)
  const itemsValue = order.subtotal > 0 ? order.subtotal : order.items.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.quantity, 0)

  return (
    <>
      <DialogHeader className="gap-1 border-b border-border/60 px-5 pb-4 pt-5 text-left">
        <div className="flex items-center gap-3 pr-8">
          <span className={`grid size-11 shrink-0 place-items-center rounded-full ${cancelled ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <DialogTitle className="text-base font-extrabold">Zamówienie #{order.number}</DialogTitle>
            <DialogDescription className="text-xs">{order.type} · {formatDate(order.created_at)}</DialogDescription>
          </div>
        </div>
        <span className={`mt-2 w-fit rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusBadgeClass(order.status)}`}>{statusLabels[order.status]}</span>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {!cancelled && (savings > 0 || order.loyalty_points !== null) ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-900">
              <PiggyBank className="size-4" aria-hidden="true" />
              <p className="mt-1.5 text-[11px] font-semibold">Zaoszczędzono</p>
              <p className="text-base font-extrabold tabular-nums">{formatPrice(savings)}</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-900">
              <Sparkles className="size-4" aria-hidden="true" />
              <p className="mt-1.5 text-[11px] font-semibold">Zdobyte Stars</p>
              <p className="text-base font-extrabold tabular-nums">
                {order.loyalty_points === null ? (
                  <span className="text-xs font-semibold">po realizacji</span>
                ) : (
                  <>+{order.loyalty_points} <span className="text-xs font-semibold">{starsLabel(order.loyalty_points)}</span></>
                )}
              </p>
            </div>
          </div>
        ) : null}

        <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground first:mt-0">Co zamówiono</h3>
        <ul className="mt-2 flex flex-col divide-y divide-border/60">
          {order.items.length === 0 ? (
            <li className="py-2 text-sm text-muted-foreground">Brak szczegółów pozycji</li>
          ) : order.items.map((item, index) => (
            <li key={`${item.name}-${index}`} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-bold leading-snug"><span className="tabular-nums text-primary">{item.quantity}×</span> {item.name}</p>
                {item.options ? <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{item.options}</p> : null}
              </div>
              {item.unitPrice !== null ? (
                <p className="shrink-0 text-sm font-semibold tabular-nums">{formatPrice(item.unitPrice * item.quantity)}</p>
              ) : null}
            </li>
          ))}
        </ul>

        {order.note ? (
          <div className="mt-3 flex gap-2 rounded-2xl bg-muted/60 p-3 text-xs leading-relaxed">
            <TicketPercent className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <p className="min-w-0 break-words">{order.note}</p>
          </div>
        ) : null}

        <dl className="mt-4 flex flex-col gap-1.5 border-t border-dashed border-border pt-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Wartość produktów</dt>
            <dd className="tabular-nums">{formatPrice(itemsValue)}</dd>
          </div>
          {order.discount > 0 ? (
            <div className="flex justify-between gap-3 font-semibold text-emerald-700">
              <dt>Rabat</dt>
              <dd className="tabular-nums">-{formatPrice(order.discount)}</dd>
            </div>
          ) : null}
          {order.delivery_fee > 0 ? (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Dostawa</dt>
              <dd className="tabular-nums">{formatPrice(order.delivery_fee)}</dd>
            </div>
          ) : null}
          <div className="mt-1 flex justify-between gap-3 text-base font-extrabold">
            <dt>Razem</dt>
            <dd className={`tabular-nums ${cancelled ? 'text-muted-foreground line-through' : ''}`}>{formatPrice(order.total)}</dd>
          </div>
          {order.payment_method ? (
            <div className="flex justify-between gap-3 text-xs text-muted-foreground">
              <dt>Płatność</dt>
              <dd>{order.payment_method}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </>
  )
}
