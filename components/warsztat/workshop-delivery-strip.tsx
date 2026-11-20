'use client'

import { Bike, Check, Undo2 } from 'lucide-react'
import type { KitchenOrder } from './order-data'

type Props = {
  orders: KitchenOrder[]
  canAct: boolean
  onSelect: (order: KitchenOrder) => void
  onDelivered: (order: KitchenOrder) => void
  onReturn: (order: KitchenOrder) => void
}

const time = (iso?: string) => iso ? new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '—'

export function WorkshopDeliveryStrip({ orders, canAct, onSelect, onDelivered, onReturn }: Props) {
  if (orders.length === 0) return null
  return (
    <section aria-labelledby="delivery-strip" className="mb-4 rounded-2xl border border-sky-200 bg-sky-50/70 p-2.5 sm:mb-5">
      <h2 id="delivery-strip" className="mb-2 flex items-center gap-2 px-1 text-[12px] font-bold uppercase tracking-wide text-sky-800">
        <Bike className="size-4" aria-hidden="true" /> W trasie
        <span className="grid min-w-6 place-items-center rounded-full bg-sky-600 px-2 py-0.5 text-[11px] font-bold text-white">{orders.length}</span>
      </h2>
      <ul className="flex gap-2 overflow-x-auto pb-0.5">
        {orders.map((order) => (
          <li key={order.databaseId ?? order.id} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-sky-200 bg-white py-1.5 pl-3 pr-1.5 shadow-sm">
            <button type="button" onClick={() => onSelect(order)} className="min-w-0 text-left">
              <span className="block text-[13px] font-extrabold leading-tight">{order.id} <span className="font-semibold text-[#706961]">· {order.customer}</span></span>
              <span className="block text-[11px] text-[#706961]">od {time(order.outForDeliveryAt)}</span>
            </button>
            {canAct && <>
              <button type="button" onClick={() => onReturn(order)} title="Cofnij na bar (kierowca wrócił)" aria-label={`Cofnij ${order.id} na bar`} className="grid size-8 place-items-center rounded-lg text-[#706961] hover:bg-[#f6f3ef] hover:text-[#211e1b]">
                <Undo2 className="size-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => onDelivered(order)} title="Oznacz jako dostarczone" aria-label={`${order.id} dostarczone`} className="grid size-8 place-items-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                <Check className="size-4" aria-hidden="true" />
              </button>
            </>}
          </li>
        ))}
      </ul>
    </section>
  )
}
