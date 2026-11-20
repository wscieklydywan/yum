'use client'

import type { ReactNode } from 'react'
import useSWR from 'swr'
import { ChevronRight, Clock, Ticket } from 'lucide-react'
import { ACTIVE_COUPONS_KEY } from '@/lib/coupons'
import { describeReward, describeSchedule, isPromotionRunning, type Promotion } from '@/lib/promotions'
import { cn } from '@/lib/utils'
import { PromotionBadge } from '@/components/promotion-badge'
import { fetchActiveCoupons } from './club-active-coupons'
import { ClubWheelBanner } from './club-wheel-banner'
import { cardClass, ClubGroup } from './club-member-sections'

const MAX_HOME_PROMOTIONS = 6

function useActiveCouponCount() {
  const { data } = useSWR(ACTIVE_COUPONS_KEY, fetchActiveCoupons, { dedupingInterval: 30_000 })
  const now = Date.now()
  return data?.filter((coupon) => new Date(coupon.expires_at).getTime() > now).length ?? 0
}

function promotionTags(promotion: Promotion) {
  return [
    promotion.online && (promotion.online_pickup_only ? 'Online · odbiór' : 'Online'),
    promotion.in_store && 'W lokalu',
    promotion.members_only && 'Tylko klub',
  ].filter((tag): tag is string => Boolean(tag))
}

function pluralCoupons(count: number) {
  if (count === 1) return 'aktywny kupon'
  const lastDigit = count % 10
  const lastTwo = count % 100
  return lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14) ? 'aktywne kupony' : 'aktywnych kuponów'
}

export function ClubPlaySection({ freeSpinAvailable, onSpin, children }: { freeSpinAvailable: boolean; onSpin: () => void; children?: ReactNode }) {
  return (
    <ClubGroup id="club-play" title="Zbieraj Stars" description="Graj codziennie i zgarniaj darmowe punkty">
      <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3 [&>*:only-child]:col-span-full">
        <ClubWheelBanner freeSpinAvailable={freeSpinAvailable} onOpen={onSpin} />
        {children}
      </div>
    </ClubGroup>
  )
}

export function ClubOffers({
  promotions,
  onShowPromotions,
  onShowMine,
}: {
  promotions: Promotion[]
  onShowPromotions: () => void
  onShowMine: () => void
}) {
  const couponCount = useActiveCouponCount()
  const highlighted = [...promotions]
    .sort((a, b) => Number(isPromotionRunning(b)) - Number(isPromotionRunning(a)))
    .slice(0, MAX_HOME_PROMOTIONS)

  if (couponCount === 0 && highlighted.length === 0) return null

  return (
    <ClubGroup
      id="club-offers"
      title="Promocje"
      description="Aktualne okazje dla klubowiczów"
      aside={
        highlighted.length > 0 ? (
          <button type="button" onClick={onShowPromotions} className="flex min-h-11 items-center gap-0.5 rounded-full text-xs font-bold text-primary hover:underline sm:text-sm">
            Wszystkie
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        ) : undefined
      }
    >
      {couponCount > 0 && (
        <button
          type="button"
          onClick={onShowMine}
          className="flex items-center gap-3 rounded-2xl bg-primary/[0.06] p-3 text-left ring-1 ring-primary/15 transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:rounded-3xl sm:p-3.5"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <Ticket className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-extrabold">Masz {couponCount} {pluralCoupons(couponCount)}</span>
            <span className="block truncate text-xs text-muted-foreground">Pokaż kod obsłudze albo użyj go w zamówieniu</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-primary" aria-hidden="true" />
        </button>
      )}

      {highlighted.length > 0 && (
        <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2 [scrollbar-width:none] [touch-action:pan-x_pan-y] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
          {highlighted.map((promotion) => {
            const live = isPromotionRunning(promotion)
            return (
              <li key={promotion.id} className="flex w-[min(72vw,17rem)] shrink-0 snap-start only:w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onShowPromotions}
                  className={cn(
                    'flex w-full flex-col gap-3 p-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-4',
                    cardClass,
                  )}
                >
                  <span className="flex w-full items-center gap-3">
                    <PromotionBadge promotion={promotion} className="size-14" />
                    <span className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                      {live && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase leading-none tracking-wide text-emerald-700">
                          <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
                          Trwa teraz
                        </span>
                      )}
                      <span className="line-clamp-2 text-pretty text-[13px] font-extrabold leading-snug text-primary sm:text-sm">
                        {promotion.headline?.trim() || describeReward(promotion)}
                      </span>
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="line-clamp-2 text-sm font-extrabold leading-snug sm:text-base">{promotion.title}</span>
                    {promotion.description?.trim() && (
                      <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">{promotion.description}</span>
                    )}
                  </span>
                  <span className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-dashed border-border pt-2.5 text-[11px] font-semibold text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                      {describeSchedule(promotion)}
                    </span>
                    {promotionTags(promotion).map((tag) => (
                      <span key={tag} className="rounded-full bg-muted px-2 py-0.5 leading-tight">{tag}</span>
                    ))}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </ClubGroup>
  )
}
