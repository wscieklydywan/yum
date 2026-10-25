'use client'

import { ChevronDown, ShoppingBag } from 'lucide-react'
import { formatMoney } from '@/lib/fiscal-receipt'
import { cn } from '@/lib/utils'
import type { KitchenOrder, OrderItem } from './order-data'

const grosze = (pln: number) => Math.round(pln * 100)

function lineTotal(item: OrderItem) {
  return (item.unitPrice ?? 0) * Math.max(0, item.quantity - (item.refunded ?? 0))
}

function ItemRow({ item }: { item: OrderItem }) {
  const price = item.unitPrice === undefined ? null : lineTotal(item)
  return <li className="flex items-start gap-2 py-1.5">
    <span className="min-w-6 shrink-0 rounded-md bg-muted px-1 py-0.5 text-center text-[11px] font-bold tabular-nums">{item.quantity}×</span>
    <span className="min-w-0 flex-1">
      <span className="block text-xs font-semibold leading-snug">{item.name}</span>
      {item.options && <span className="block text-[11px] leading-snug text-muted-foreground">{item.options}</span>}
    </span>
    {price !== null && <span className="shrink-0 text-xs font-semibold tabular-nums">{price === 0 ? 'gratis' : `${formatMoney(grosze(price))} zł`}</span>}
  </li>
}

function SummaryBody({ order }: { order: KitchenOrder }) {
  const live = order.items.filter((item) => !item.cancelled)
  const food = live.filter((item) => !item.packaging)
  const packaging = live.filter((item) => item.packaging)
  const subtotal = live.reduce((sum, item) => sum + lineTotal(item), 0)
  const discount = order.discount ?? 0
  const deliveryFee = order.deliveryFee ?? 0
  const total = order.total ?? subtotal - discount + deliveryFee

  return <>
    <ul className="min-h-0 flex-1 divide-y divide-border/70 overflow-y-auto overscroll-contain pr-1">
      {food.map((item, index) => <ItemRow key={item.id ?? `f-${index}`} item={item} />)}
      {packaging.map((item, index) => <ItemRow key={item.id ?? `p-${index}`} item={item} />)}
      {live.length === 0 && <li className="py-4 text-center text-xs text-muted-foreground">Brak pozycji.</li>}
    </ul>
    <dl className="mt-2 flex shrink-0 flex-col gap-0.5 border-t border-border pt-2 text-xs">
      {(discount > 0 || deliveryFee > 0) && <div className="flex justify-between text-muted-foreground"><dt>Suma pozycji</dt><dd className="tabular-nums">{formatMoney(grosze(subtotal))} zł</dd></div>}
      {discount > 0 && <div className="flex justify-between font-semibold text-emerald-700"><dt>Rabat</dt><dd className="tabular-nums">-{formatMoney(grosze(discount))} zł</dd></div>}
      {deliveryFee > 0 && <div className="flex justify-between text-muted-foreground"><dt>Dostawa</dt><dd className="tabular-nums">{formatMoney(grosze(deliveryFee))} zł</dd></div>}
      <div className="flex items-baseline justify-between"><dt className="font-semibold">Razem</dt><dd className="text-base font-black tabular-nums">{formatMoney(grosze(total))} zł</dd></div>
    </dl>
  </>
}

/** Compact, read-only list of what is being paid for; scrolls on its own so long orders never resize the dialog. */
export function SettleOrderSummary({ order, className }: { order: KitchenOrder; className?: string }) {
  const count = order.items.filter((item) => !item.cancelled && !item.packaging).reduce((sum, item) => sum + item.quantity, 0)
  const meta = [order.type, order.customer].filter(Boolean).join(' · ')

  return <>
    <details className={cn('group rounded-xl border border-border bg-muted/30 lg:hidden', className)}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <ShoppingBag className="size-4 text-muted-foreground" aria-hidden="true" />
        Pozycje zamówienia <span className="text-muted-foreground">({count})</span>
        <ChevronDown className="ml-auto size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="flex max-h-56 flex-col px-3 pb-3"><SummaryBody order={order} /></div>
    </details>

    <section aria-label="Pozycje zamówienia" className={cn('hidden min-h-0 w-64 shrink-0 flex-col rounded-xl border border-border bg-muted/30 p-3 lg:flex xl:w-72', className)}>
      <header className="mb-1 flex shrink-0 flex-col gap-0.5 border-b border-border pb-2">
        <p className="flex items-center gap-1.5 text-sm font-bold"><ShoppingBag className="size-4 text-muted-foreground" aria-hidden="true" />Zamówienie <span className="font-medium text-muted-foreground">· {count} szt.</span></p>
        {meta && <p className="truncate text-[11px] text-muted-foreground">{meta}</p>}
      </header>
      <SummaryBody order={order} />
    </section>
  </>
}
