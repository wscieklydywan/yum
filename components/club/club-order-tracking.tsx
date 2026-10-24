'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChefHat, ClipboardCheck, PackageCheck, Radio, Store, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isActiveOrder, isTrackableOrder, trackingEndsAt, useCustomerOrders, type CustomerOrder } from '@/lib/use-customer-orders'
import { cardClass } from './club-member-sections'
import { formatPrice, orderIcon } from './club-order-history'

type TrackStep = { label: string; hint: string; icon: typeof Check; time: string }

function stepsFor(order: CustomerOrder, current: number): TrackStep[] {
  const delivery = order.type === 'Dostawa'
  const at = (value: string | null | undefined, index: number) => (value ? formatTime(value) : index === current ? 'Teraz' : '–')
  return [
    { label: 'Złożone', hint: 'Czekamy, aż bar potwierdzi zamówienie.', icon: ClipboardCheck, time: formatTime(order.created_at) },
    { label: 'Na kuchni', hint: 'Bar przyjął zamówienie – kuchnia już przygotowuje.', icon: ChefHat, time: current > 1 ? '✓' : at(null, 1) },
    {
      label: 'Gotowe',
      hint: delivery ? 'Wszystko gotowe – czeka na kierowcę.' : 'Gotowe do odbioru w lokalu.',
      icon: delivery ? PackageCheck : Store,
      time: at(order.ready_at, 2),
    },
    {
      label: delivery ? 'W drodze' : 'Odebrane',
      hint: delivery ? 'Kierowca jest już w drodze do Ciebie. Smacznego!' : 'Zamówienie wydane. Smacznego!',
      icon: delivery ? Truck : Check,
      time: at(order.handed_off_at, 3),
    },
  ]
}

const STEP_INDEX: Record<CustomerOrder['status'], number> = { new: 0, preparing: 1, ready: 2, handed_off: 3, cancelled: -1 }

function formatTime(value: string) {
  return new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' }).format(new Date(value))
}

export function ClubOrderTracking({ highlight }: { highlight?: string | null }) {
  const { data: orders = [] } = useCustomerOrders()
  const [now, setNow] = useState(() => Date.now())
  const tracked = orders.filter((order) => isTrackableOrder(order, now) || (highlight && String(order.number) === highlight && order.status === 'cancelled'))
  const nextClose = tracked.reduce<number | null>((soonest, order) => {
    const endsAt = trackingEndsAt(order)
    return endsAt !== null && (soonest === null || endsAt < soonest) ? endsAt : soonest
  }, null)

  // Re-render exactly when the next finished order should drop out of live tracking.
  useEffect(() => {
    if (nextClose === null) return
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, nextClose - Date.now()) + 500)
    return () => window.clearTimeout(timer)
  }, [nextClose])
  const sectionRef = useRef<HTMLElement>(null)
  const scrolledFor = useRef<string | null>(null)
  const hasTracked = tracked.length > 0

  // The section appears only after orders load, so the browser's own #sledzenie jump can miss it.
  useEffect(() => {
    if (!highlight || !hasTracked || scrolledFor.current === highlight) return
    scrolledFor.current = highlight
    sectionRef.current?.scrollIntoView({ block: 'start' })
  }, [highlight, hasTracked])

  if (!hasTracked) return null

  return (
    <section ref={sectionRef} id="sledzenie" aria-labelledby="tracking-title" className="scroll-mt-20">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 id="tracking-title" className="text-base font-black tracking-tight sm:text-lg">
          {tracked.length > 1 ? 'Twoje zamówienia na żywo' : 'Twoje zamówienie na żywo'}
        </h2>
        {tracked.some((order) => isActiveOrder(order, now)) && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
            <Radio className="size-3" aria-hidden="true" />
            Na żywo
          </span>
        )}
      </div>
      <ul className="flex flex-col gap-3">
        {tracked.map((order) => (
          <li key={`${order.number}-${order.created_at}`}>
            <TrackingCard order={order} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function TrackingCard({ order }: { order: CustomerOrder }) {
  const Icon = orderIcon(order.type)
  const current = STEP_INDEX[order.status]
  const steps = stepsFor(order, current)
  const cancelled = order.status === 'cancelled'
  const finished = order.status === 'handed_off'
  const closesAt = order.type === 'Dostawa' ? trackingEndsAt(order) : null

  return (
    <article className={cn('overflow-hidden', cardClass)} aria-label={`Zamówienie #${order.number}`}>
      <header className="flex items-center gap-3 border-b border-border/60 px-3.5 py-3 sm:px-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold">#{order.number} · {order.type}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            Złożone {formatTime(order.created_at)}
            {order.scheduled_for ? ` · na ${formatTime(order.scheduled_for)}` : ''}
          </p>
        </div>
        <p className={cn('shrink-0 text-sm font-extrabold tabular-nums', cancelled && 'text-muted-foreground line-through')}>{formatPrice(order.total)}</p>
      </header>

      <div className="px-3.5 py-3.5 sm:px-4">
        {cancelled ? (
          <p role="status" className="rounded-xl bg-muted px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            Zamówienie zostało anulowane. W razie pytań zadzwoń do lokalu.
          </p>
        ) : (
          <>
            <ol className="grid grid-cols-4" aria-label="Etapy realizacji">
              {steps.map((step, index) => {
                const state = index < current || (finished && index === current) ? 'done' : index === current ? 'active' : 'todo'
                const StepIcon = step.icon
                return (
                  <li key={step.label} aria-current={state === 'active' ? 'step' : undefined} className="relative flex min-w-0 flex-col items-center text-center">
                    {index > 0 && (
                      <span
                        aria-hidden="true"
                        className={cn('absolute right-1/2 top-4 z-0 h-0.5 w-full -translate-y-1/2 sm:top-5', state === 'todo' ? 'bg-border' : 'bg-emerald-500')}
                      />
                    )}
                    <span
                      className={cn(
                        'relative z-10 grid size-8 place-items-center rounded-full ring-4 ring-card transition-colors sm:size-10',
                        state === 'done' && 'bg-emerald-500 text-white',
                        state === 'active' && 'bg-[#f28a24] text-white',
                        state === 'todo' && 'bg-[#f1ece7] text-muted-foreground',
                      )}
                    >
                      <StepIcon className="size-4 sm:size-5" aria-hidden="true" />
                    </span>
                    <span className={cn('mt-2 text-[10px] font-semibold leading-tight sm:text-sm', state === 'active' && 'text-[#e87512]', state === 'todo' && 'text-muted-foreground')}>
                      {step.label}
                    </span>
                    <span className="mt-0.5 text-[10px] tabular-nums text-muted-foreground sm:text-xs">{step.time}</span>
                  </li>
                )
              })}
            </ol>
            <p role="status" aria-live="polite" className="mt-4 rounded-[1.25rem] bg-[#f8f4ef] px-3 py-2.5 text-xs font-semibold leading-relaxed ring-1 ring-[#eee4dc]">
              {steps[current].hint}
              {finished && closesAt ? <span className="mt-0.5 block font-normal text-muted-foreground">Śledzenie zamknie się automatycznie o {formatTime(new Date(closesAt).toISOString())}.</span> : null}
            </p>
          </>
        )}

        <h3 className="mt-4 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Co zamówiono</h3>
        <ul className="mt-1.5 flex flex-col divide-y divide-border/60">
          {order.items.map((item, index) => (
            <li key={`${item.name}-${index}`} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-[13px] font-bold leading-snug"><span className="tabular-nums text-primary">{item.quantity}×</span> {item.name}</p>
                {item.options ? <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{item.options}</p> : null}
              </div>
              {item.unitPrice !== null ? <p className="shrink-0 text-[13px] font-semibold tabular-nums">{formatPrice(item.unitPrice * item.quantity)}</p> : null}
            </li>
          ))}
        </ul>
        {order.note ? <p className="mt-2 rounded-xl bg-muted/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground"><span className="font-bold text-foreground">Uwagi: </span>{order.note}</p> : null}
      </div>
    </article>
  )
}
