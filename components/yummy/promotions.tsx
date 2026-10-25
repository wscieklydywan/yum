'use client'

import Image from 'next/image'
import { ArrowRight, BadgePercent, Bike } from 'lucide-react'
import { describeSchedule, describeScope, discountLabel, isPromotionRunning, type Promotion } from '@/lib/promotions'
import { usePromotions } from '@/lib/use-promotions'
import { useRestaurantStatus } from '@/lib/use-restaurant-status'
import { deliveryRadius, formatKm } from '@/lib/order-settings'
import { SectionHeading } from './section-heading'

const formatAmount = (value: number) => `${value.toLocaleString('pl-PL', { maximumFractionDigits: 2 })} zł`

function promotionText(promotion: Promotion) {
  return promotion.description || describeScope(promotion)
}

export function Promotions() {
  const { promotions, now } = usePromotions()
  const { status: restaurant } = useRestaurantStatus()
  const visible = promotions.filter((promotion) => promotion.online || promotion.in_store)
  const running = now ? visible.filter((promotion) => isPromotionRunning(promotion, now)) : []
  const featured = running[0] ?? visible[0]
  const others = visible.filter((promotion) => promotion.id !== featured?.id)
  const featuredRunning = featured ? running.some((promotion) => promotion.id === featured.id) : false

  return (
    <section id="promocje" aria-labelledby="promo-title" className="bg-ink py-6 text-ink-foreground sm:py-20">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <SectionHeading
          id="promo-title"
          tone="dark"
          eyebrow="Tylko w Yummy"
          title="Promocje"
          description="Smakuje lepiej, kiedy kosztuje mniej. Sprawdź, co dziś dla Ciebie mamy."
          compactMobile
        />

        <div className="mt-4 grid gap-2.5 sm:mt-12 sm:gap-6 lg:grid-cols-5">
          <article className="relative overflow-hidden rounded-3xl bg-primary lg:col-span-3">
            <Image
              src="/images/spicy-jalapeno.webp"
              alt=""
              fill
              sizes="(min-width: 1024px) 60vw, 100vw"
              className="object-cover object-right opacity-90"
            />
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-transparent" />
            <div className="relative flex min-h-[205px] flex-col justify-end p-4 sm:min-h-[380px] sm:p-10">
              {featured ? <>
                {featuredRunning && (
                  <span className="mb-2 w-fit rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">Trwa teraz</span>
                )}
                <p className="max-w-md text-2xl font-black uppercase italic leading-none text-white text-balance sm:text-5xl">{featured.title}</p>
                <p className="mt-1.5 text-4xl font-black italic leading-none text-primary sm:mt-2 sm:text-8xl">{discountLabel(featured)}</p>
                <p className="mt-2.5 max-w-xs text-sm leading-snug text-ink-foreground/80 sm:mt-4 sm:text-base">
                  {describeSchedule(featured)} · {promotionText(featured)}. Rabat naliczy się sam – bez kodów.
                </p>
              </> : <>
                <p className="font-script text-2xl leading-none text-white sm:text-5xl">Codziennie</p>
                <p className="mt-1 text-3xl font-black uppercase italic leading-none text-primary sm:text-6xl">coś dobrego</p>
                <p className="mt-2.5 max-w-xs text-sm leading-snug text-ink-foreground/80 sm:mt-4 sm:text-base">
                  Nowe promocje pojawią się tutaj, gdy tylko je uruchomimy.
                </p>
              </>}
              <a
                href="#menu"
                className="mt-3 inline-flex h-10 w-fit items-center gap-2 rounded-full bg-white px-4 text-xs font-bold text-primary transition-colors hover:bg-cream sm:mt-6 sm:h-12 sm:px-6 sm:text-sm"
              >
                {featured ? 'Skorzystaj' : 'Zobacz menu'}
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            </div>
          </article>

          <div className="grid content-start gap-3 sm:gap-6 lg:col-span-2">
            <ul className="grid gap-2 sm:gap-3">
              {others.map((promotion) => {
                const isRunning = running.some((entry) => entry.id === promotion.id)
                return (
                  <li key={promotion.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10 sm:gap-4 sm:rounded-2xl sm:p-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground sm:size-12 sm:rounded-xl">
                      <BadgePercent className="size-5 sm:size-6" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="flex items-center gap-2 text-sm font-bold text-white sm:text-base">
                        {promotion.title}
                        {isRunning && <span className="rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold uppercase text-white">Teraz</span>}
                      </h3>
                      <p className="text-xs leading-snug sm:text-sm">
                        <span className="font-semibold text-primary">{discountLabel(promotion)}</span>
                        <span className="text-ink-foreground/60"> · {describeSchedule(promotion)}</span>
                      </p>
                    </div>
                  </li>
                )
              })}
              {restaurant && (
                <li className="flex items-center gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10 sm:gap-4 sm:rounded-2xl sm:p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground sm:size-12 sm:rounded-xl">
                    <Bike className="size-5 sm:size-6" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white sm:text-base">
                      {restaurant.freeDeliveryFrom !== null ? 'Darmowa dostawa' : 'Dostawa'}
                    </h3>
                    <p className="text-xs leading-snug sm:text-sm">
                      <span className="font-semibold text-primary">
                        {restaurant.freeDeliveryFrom !== null
                          ? `od ${formatAmount(restaurant.freeDeliveryFrom)}`
                          : `przy zamówieniu od ${formatAmount(restaurant.minOrderOnline)}`}
                      </span>
                      <span className="text-ink-foreground/60"> · do {formatKm(deliveryRadius(restaurant.deliveryZones))} km od lokalu</span>
                    </p>
                  </div>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
