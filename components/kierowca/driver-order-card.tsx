'use client'

import { memo } from 'react'
import { Banknote, Bike, Check, CreditCard, MapPin, MessageSquare, Phone, Undo2 } from 'lucide-react'
import { formatPrice } from '@/lib/menu'
import { isOrderPaid, isPaidOnline, type KitchenOrder } from '@/components/warsztat/order-data'

type Props = {
  order: KitchenOrder
  variant: 'mine' | 'waiting' | 'other' | 'cooking'
  busy?: boolean
  onStart?: () => void
  onDelivered?: () => void
  onReturn?: () => void
}

const time = (iso?: string) => iso ? new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : null

function paymentLabel(order: KitchenOrder) {
  if (isPaidOnline(order)) return { text: 'Opłacone w aplikacji', paid: true }
  if (isOrderPaid(order)) return { text: 'Opłacone', paid: true }
  return { text: `Do pobrania: ${formatPrice(order.total ?? 0)} · ${order.preferredPayment === 'card' ? 'karta' : 'gotówka'}`, paid: false }
}

export const DriverOrderCard = memo(function DriverOrderCard({ order, variant, busy, onStart, onDelivered, onReturn }: Props) {
  const muted = variant === 'other' || variant === 'cooking'
  const payment = paymentLabel(order)
  const fullAddress = [order.address, order.postcode].filter(Boolean).join(', ')
  const mapsUrl = fullAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}` : null
  const phone = order.phone?.replace(/\s/g, '')

  return (
    <article className={`flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm ${variant === 'mine' ? 'border-sky-300 ring-2 ring-sky-100' : 'border-[#e5ded6]'} ${muted ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-black leading-tight">{order.id} <span className="font-semibold text-[#706961]">· {order.customer}</span></p>
          <p className="mt-0.5 text-xs font-medium text-[#706961]">
            {variant === 'mine' || variant === 'other' ? `W trasie od ${time(order.outForDeliveryAt)}` : variant === 'waiting' ? `Gotowe od ${time(order.readyAt) ?? '—'}` : `Na kuchni · ${order.eta}`}
            {order.distanceKm ? ` · ${order.distanceKm.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} km` : ''}
          </p>
          <p className={`mt-1.5 inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-bold ${order.clubCustomer ? 'bg-sky-50 text-sky-700' : 'bg-[#f0ebe5] text-[#8a8279]'}`}>
            {order.clubCustomer ? 'Yummy Club · klient widzi status' : 'Bez Yummy Club · klient nie widzi statusu'}
          </p>
        </div>
        <span className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold ${payment.paid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
          {payment.paid ? <Check className="size-3.5" aria-hidden="true" /> : order.preferredPayment === 'card' ? <CreditCard className="size-3.5" aria-hidden="true" /> : <Banknote className="size-3.5" aria-hidden="true" />}
          {payment.paid ? payment.text : formatPrice(order.total ?? 0)}
        </span>
      </div>

      {!muted && (
        <div className="flex flex-col gap-2 text-sm">
          {fullAddress && (
            mapsUrl ? <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex items-start gap-2 font-semibold underline-offset-2 hover:underline">
              <MapPin className="mt-0.5 size-4 shrink-0 text-[#706961]" aria-hidden="true" />{fullAddress}
            </a> : null
          )}
          {phone && (
            <a href={`tel:${phone}`} className="flex items-center gap-2 font-semibold underline-offset-2 hover:underline">
              <Phone className="size-4 shrink-0 text-[#706961]" aria-hidden="true" />{order.phone}
            </a>
          )}
          {!payment.paid && <p className="font-semibold text-amber-800">{payment.text}</p>}
          {order.note && <p className="flex items-start gap-2 rounded-lg bg-[#f6f3ef] p-2 text-[#211e1b]"><MessageSquare className="mt-0.5 size-4 shrink-0 text-[#706961]" aria-hidden="true" />{order.note}</p>}
          {order.deliveryNote && variant === 'waiting' && <p className="rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-800">Wróciło z trasy: {order.deliveryNote}</p>}
        </div>
      )}

      {variant === 'waiting' && (
        <button type="button" onClick={onStart} disabled={busy} className="flex h-14 items-center justify-center gap-2 rounded-xl bg-[#211e1b] text-base font-black text-white transition-opacity disabled:opacity-50">
          <Bike className="size-5" aria-hidden="true" /> Jadę
        </button>
      )}

      {variant === 'mine' && (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button type="button" onClick={onDelivered} disabled={busy} className="flex h-14 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-base font-black text-white transition-opacity disabled:opacity-50">
            <Check className="size-5" aria-hidden="true" /> Dostarczone
          </button>
          <button type="button" onClick={onReturn} disabled={busy} className="flex h-14 items-center justify-center gap-2 rounded-xl border border-[#ddd5cc] px-4 text-sm font-bold text-[#706961] disabled:opacity-50" aria-label="Wracam z zamówieniem">
            <Undo2 className="size-5" aria-hidden="true" /> <span className="hidden sm:inline">Wracam z tym</span>
          </button>
        </div>
      )}
    </article>
  )
})
