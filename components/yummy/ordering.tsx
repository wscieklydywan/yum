'use client'

import { useState } from 'react'
import { Bike, Check, ChefHat, Home, MapPin, MessageSquare, Phone, Store, Truck } from 'lucide-react'
import { SectionHeading } from './section-heading'
import { cn } from '@/lib/utils'

const deliverySteps = [
  { icon: Check, label: 'Przyjęte', time: '18:41', state: 'done' },
  { icon: ChefHat, label: 'W przygotowaniu', time: '18:48', state: 'done' },
  { icon: Truck, label: 'W drodze', time: '18:52', state: 'active' },
  { icon: Home, label: 'U Ciebie', time: '~19:10', state: 'todo' },
] as const

const pickupSteps = [
  { icon: Check, label: 'Przyjęte', time: '18:41', state: 'done' },
  { icon: ChefHat, label: 'W przygotowaniu', time: 'Teraz', state: 'active' },
  { icon: Store, label: 'Gotowe', time: '+15 min', state: 'todo' },
  { icon: Check, label: 'Odebrane', time: '–', state: 'todo' },
] as const

export function Ordering() {
  const [fulfillment, setFulfillment] = useState<'delivery' | 'pickup'>('delivery')
  const steps = fulfillment === 'delivery' ? deliverySteps : pickupSteps

  return (
    <section id="zamawianie" aria-labelledby="order-title" className="bg-cream py-8 sm:py-20">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <SectionHeading
          id="order-title"
          eyebrow="Szybko, prosto, pysznie"
          title="Dostawa lub odbiór"
          description="Zamów jak Ci wygodnie i śledź zamówienie na żywo – od grilla aż pod Twoje drzwi."
          compactMobile
        />

        <div className="mt-5 grid gap-3 sm:mt-12 sm:gap-6 lg:grid-cols-2">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
            <button
              type="button"
              aria-pressed={fulfillment === 'delivery'}
              onClick={() => setFulfillment('delivery')}
              className={cn(
                'relative min-w-0 rounded-[1.35rem] border p-3 text-left shadow-[0_8px_22px_rgba(48,32,21,0.045)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:rounded-3xl sm:p-6',
                fulfillment === 'delivery' ? 'border-primary bg-[#fff1ed]' : 'border-transparent bg-white hover:border-primary/40',
              )}
            >
              <span className={cn('absolute right-3.5 top-3.5 grid size-5 place-items-center rounded-full sm:right-5 sm:top-5 sm:size-6', fulfillment === 'delivery' ? 'bg-primary text-white' : 'border-2 border-border')}>
                {fulfillment === 'delivery' && <Check className="size-3.5 sm:size-4" aria-hidden="true" />}
              </span>
              <span className={cn('mb-2 grid size-9 place-items-center rounded-full sm:mb-4 sm:size-14', fulfillment === 'delivery' ? 'bg-[#fde4df] text-primary' : 'bg-[#f1ece7] text-muted-foreground')}>
                <Bike className="size-[1.125rem] sm:size-7" aria-hidden="true" />
              </span>
              <span className="block text-[13px] font-bold sm:text-xl">Dostawa</span>
              <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground sm:text-base">Pod Twój adres w około 30–45 minut.</span>
              <span className="mt-1.5 block text-[11px] font-semibold text-primary sm:mt-2 sm:text-base">Darmowa od 80 zł.</span>
            </button>
            <button
              type="button"
              aria-pressed={fulfillment === 'pickup'}
              onClick={() => setFulfillment('pickup')}
              className={cn(
                'relative min-w-0 rounded-[1.35rem] border p-3 text-left shadow-[0_8px_22px_rgba(48,32,21,0.06)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:rounded-3xl sm:p-6',
                fulfillment === 'pickup' ? 'border-primary bg-[#fff1ed]' : 'border-transparent bg-white hover:border-primary/40',
              )}
            >
              <span className={cn('absolute right-3.5 top-3.5 grid size-5 place-items-center rounded-full sm:right-5 sm:top-5 sm:size-6', fulfillment === 'pickup' ? 'bg-primary text-white' : 'border-2 border-border')}>
                {fulfillment === 'pickup' && <Check className="size-3.5 sm:size-4" aria-hidden="true" />}
              </span>
              <span className={cn('mb-2 grid size-9 place-items-center rounded-full sm:mb-4 sm:size-14', fulfillment === 'pickup' ? 'bg-[#fde4df] text-primary' : 'bg-[#f1ece7] text-muted-foreground')}>
                <Store className="size-[1.125rem] sm:size-7" aria-hidden="true" />
              </span>
              <span className="block text-[13px] font-bold sm:text-xl">Odbiór osobisty</span>
              <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground sm:text-base">Gotowe w 15 minut w naszym lokalu.</span>
              <span className="mt-1.5 block text-[11px] leading-relaxed text-muted-foreground sm:mt-2 sm:text-base">ul. Przykładowa 12, Rybnik</span>
            </button>
          </div>

          <article key={fulfillment} aria-live="polite" className="menu-card-enter rounded-[1.5rem] bg-white p-4 shadow-[0_8px_22px_rgba(48,32,21,0.06)] ring-1 ring-black/[0.035] sm:rounded-3xl sm:p-7">
            <h3 className="text-base font-black leading-snug sm:text-2xl">
              {fulfillment === 'delivery' ? 'Twoje zamówienie jest w drodze!' : 'Twoje zamówienie przygotowujemy do odbioru'}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground sm:text-base">
              {fulfillment === 'delivery' ? 'Szacowany czas dostawy:' : 'Szacowany czas odbioru:'}{' '}
              <span className="font-bold text-foreground">{fulfillment === 'delivery' ? '18 min' : '15 min'}</span>
            </p>

            <ol className="mt-5 grid grid-cols-4 sm:mt-8">
              {steps.map(({ icon: Icon, label, time, state }, i) => (
                <li key={label} className="relative flex min-w-0 flex-col items-center text-center">
                  {i > 0 && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute right-1/2 top-4 z-0 h-0.5 w-full -translate-y-1/2 sm:top-5',
                        state === 'todo' ? 'bg-border' : 'bg-emerald-500',
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      'relative z-10 grid size-8 place-items-center rounded-full ring-4 ring-white sm:size-10',
                      state === 'done' && 'bg-emerald-500 text-white',
                      state === 'active' && 'bg-[#f28a24] text-white',
                      state === 'todo' && 'bg-[#f1ece7] text-muted-foreground',
                    )}
                  >
                    <Icon className="size-4 sm:size-5" aria-hidden="true" />
                  </span>
                  <span className={cn('mt-2 text-[10px] font-semibold leading-tight sm:text-sm', state === 'active' && 'text-[#e87512]')}>{label}</span>
                  <span className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">{time}</span>
                </li>
              ))}
            </ol>

            {fulfillment === 'delivery' ? (
              <div className="mt-5 flex items-center gap-2.5 rounded-[1.25rem] bg-[#f8f4ef] p-2.5 ring-1 ring-[#eee4dc] sm:mt-8 sm:gap-4 sm:rounded-2xl sm:p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-base font-bold text-ink-foreground sm:size-12 sm:text-lg" aria-hidden="true">
                  K
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold sm:text-base">Kamil</p>
                  <p className="truncate text-xs text-muted-foreground sm:text-sm">Twój kurier · ★ 4,9</p>
                </div>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#fde4df] text-primary sm:size-12" aria-hidden="true">
                  <Phone className="size-4 sm:size-5" />
                </span>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#fde4df] text-primary sm:size-12" aria-hidden="true">
                  <MessageSquare className="size-4 sm:size-5" />
                </span>
              </div>
            ) : (
              <div className="mt-5 flex items-center gap-3 rounded-[1.25rem] bg-[#f8f4ef] p-3 ring-1 ring-[#eee4dc] sm:mt-8 sm:gap-4 sm:rounded-2xl sm:p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#fde4df] text-primary sm:size-12" aria-hidden="true">
                  <MapPin className="size-5 sm:size-6" />
                </span>
                <div>
                  <p className="text-sm font-bold sm:text-base">Odbierzesz w Yummy Rybnik</p>
                  <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">ul. Przykładowa 12 · Gotowe za około 15 minut</p>
                </div>
              </div>
            )}
          </article>
        </div>
      </div>
    </section>
  )
}
