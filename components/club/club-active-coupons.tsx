'use client'

import { useState, type ReactNode } from 'react'
import useSWR from 'swr'
import { Clock, Crown, Info, LoaderCircle, Percent, Ticket } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ACTIVE_COUPONS_KEY, formatCouponExpiry, type ActiveCoupon } from '@/lib/coupons'
import { describeSchedule, discountLabel, type Promotion } from '@/lib/promotions'
import { cardClass, ClubSectionTitle } from './club-member-sections'

export async function fetchActiveCoupons() {
  const { data, error } = await createClient()
    .from('reward_redemptions')
    .select('id, code, reward, cost, items, expires_at, created_at')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ActiveCoupon[]
}

type Tab = 'mine' | 'public'

export function ClubActiveCoupons({
  promotions,
  tierPercent,
  children,
}: {
  promotions: Promotion[]
  tierPercent: number
  children?: ReactNode
}) {
  const [tab, setTab] = useState<Tab>('mine')
  const { data, isLoading } = useSWR(ACTIVE_COUPONS_KEY, fetchActiveCoupons, { dedupingInterval: 30_000 })
  const now = Date.now()
  const coupons = data?.filter((coupon) => new Date(coupon.expires_at).getTime() > now)
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'mine', label: 'Moje', count: (coupons?.length ?? 0) + (tierPercent > 0 ? 1 : 0) },
    { key: 'public', label: 'Dla wszystkich', count: promotions.length },
  ]

  return (
    <section id="kupony" aria-labelledby="club-coupons-title" className="scroll-mt-20">
      <ClubSectionTitle id="club-coupons-title" title="Kupony i rabaty" aside="Yummy QPON" />
      {children ? <div className="mt-3">{children}</div> : null}
      <div role="tablist" aria-label="Rodzaje kuponów" className="mt-4 flex gap-1 rounded-full bg-muted p-1">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={`coupons-tab-${item.key}`}
            aria-selected={tab === item.key}
            aria-controls={`coupons-panel-${item.key}`}
            onClick={() => setTab(item.key)}
            className={`flex-1 rounded-full px-3 py-1.5 text-sm font-bold transition-colors ${
              tab === item.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {item.label} <span className="tabular-nums opacity-60">{item.count}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`coupons-panel-${tab}`} aria-labelledby={`coupons-tab-${tab}`} className="mt-2.5">
        {tab === 'mine' ? (
          <ul className="flex flex-col gap-2">
            {tierPercent > 0 ? (
              <li className={`flex items-center gap-3 p-3 sm:p-4 ${cardClass}`}>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f5b936]/15 text-[#a8740a]">
                  <Crown className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">Stały rabat statusowy</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Naliczany automatycznie przy każdym zamówieniu</p>
                </div>
                <p className="shrink-0 text-lg font-extrabold text-primary">-{tierPercent}%</p>
              </li>
            ) : null}
            {isLoading ? (
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Ładowanie kuponów…
              </li>
            ) : !coupons?.length ? (
              <li className={`p-4 text-sm text-muted-foreground ${cardClass}`}>
                Nie masz aktywnych kodów. Wymień Stars na nagrodę lub zakręć kołem, a kod pojawi się tutaj.
              </li>
            ) : (
              coupons.map((coupon) => (
                <li key={coupon.id} className={`flex items-center gap-3 p-3 sm:p-4 ${cardClass}`}>
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Ticket className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{coupon.reward}</p>
                    <p className="mt-0.5 flex items-start gap-1 text-xs leading-snug text-muted-foreground">
                      <Clock className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="whitespace-nowrap">Ważny do</span>{' '}
                        <time dateTime={coupon.expires_at} className="whitespace-nowrap font-semibold text-foreground">
                          {formatCouponExpiry(coupon.expires_at)}
                        </time>
                      </span>
                    </p>
                  </div>
                  <p className="max-w-[45%] shrink-0 break-all rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-2 py-1 text-center font-mono text-sm font-extrabold tracking-[0.08em] text-primary sm:px-2.5 sm:text-lg sm:tracking-[0.2em]">
                    {coupon.code}
                  </p>
                </li>
              ))
            )}
          </ul>
        ) : !promotions.length ? (
          <p className={`p-4 text-sm text-muted-foreground ${cardClass}`}>Teraz nie ma aktywnych promocji. Zajrzyj wkrótce!</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {promotions.map((promotion) => (
              <li key={promotion.id} className={`flex items-center gap-3 p-3 sm:p-4 ${cardClass}`}>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Percent className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{promotion.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {promotion.description || describeSchedule(promotion)}
                  </p>
                </div>
                <p className="shrink-0 text-lg font-extrabold text-primary">{discountLabel(promotion)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-snug text-muted-foreground">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        Rabat statusowy nie sumuje się z kodem rabatowym – przy zamówieniu zawsze stosujemy korzystniejszą cenę.
      </p>
    </section>
  )
}
