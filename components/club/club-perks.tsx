'use client'

import type { ReactNode } from 'react'
import useSWR from 'swr'
import { ChevronRight, Sparkles, Ticket } from 'lucide-react'
import { ACTIVE_COUPONS_KEY } from '@/lib/coupons'
import { describeSchedule, discountLabel, isPromotionRunning, type Promotion } from '@/lib/promotions'
import { cn } from '@/lib/utils'
import { fetchActiveCoupons } from './club-active-coupons'
import { ClubWheelBanner } from './club-wheel-banner'
import { cardClass, ClubGroup } from './club-member-sections'

function useActiveCouponCount() {
  const { data } = useSWR(ACTIVE_COUPONS_KEY, fetchActiveCoupons, { dedupingInterval: 30_000 })
  const now = Date.now()
  return data?.filter((coupon) => new Date(coupon.expires_at).getTime() > now).length ?? 0
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

export function ClubOffers({ promotions, onShowCoupons }: { promotions: Promotion[]; onShowCoupons: () => void }) {
  const couponCount = useActiveCouponCount()
  const highlighted = [...promotions]
    .sort((a, b) => Number(isPromotionRunning(b)) - Number(isPromotionRunning(a)))
    .slice(0, 2)

  if (couponCount === 0 && highlighted.length === 0) return null

  return (
    <ClubGroup
      id="club-offers"
      title="Kupony i promocje"
      description="Aktualne okazje dla klubowiczów"
      aside={<Sparkles className="size-4 text-primary" aria-hidden="true" />}
    >

      {couponCount > 0 && (
        <button
          type="button"
          onClick={onShowCoupons}
          className={cn('flex items-center gap-3 p-3 text-left transition-colors hover:bg-muted', cardClass)}
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <Ticket className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Masz {couponCount} {pluralCoupons(couponCount)}</span>
            <span className="block text-xs text-muted-foreground">Pokaż kod obsłudze albo użyj go w zamówieniu</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      )}

      {highlighted.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {highlighted.map((promotion) => {
            const live = isPromotionRunning(promotion)
            return (
              <li key={promotion.id}>
                <button
                  type="button"
                  onClick={onShowCoupons}
                  className={cn('flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted', cardClass)}
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary text-sm font-black text-primary-foreground tabular-nums">
                    {discountLabel(promotion)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold">{promotion.title}</span>
                      {live && <span className="shrink-0 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">Teraz</span>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{describeSchedule(promotion)}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </ClubGroup>
  )
}
