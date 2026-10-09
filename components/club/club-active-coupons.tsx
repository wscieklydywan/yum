'use client'

import useSWR from 'swr'
import { Clock, LoaderCircle, Ticket } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ACTIVE_COUPONS_KEY, formatCouponExpiry, type ActiveCoupon } from '@/lib/coupons'
import { cardClass } from './club-member-sections'

async function fetchActiveCoupons() {
  const { data, error } = await createClient()
    .from('reward_redemptions')
    .select('id, code, reward, cost, items, expires_at, created_at')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ActiveCoupon[]
}

export function ClubActiveCoupons() {
  const { data, isLoading } = useSWR(ACTIVE_COUPONS_KEY, fetchActiveCoupons, { dedupingInterval: 30_000 })
  const now = Date.now()
  const coupons = data?.filter((coupon) => new Date(coupon.expires_at).getTime() > now)

  return (
    <section id="kupony" aria-labelledby="club-coupons-title" className="scroll-mt-20">
      <h2 id="club-coupons-title" className="text-sm font-extrabold uppercase tracking-[0.08em] sm:text-base">
        Aktywne kupony
      </h2>
      {isLoading ? (
        <p className="mt-2.5 flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Ładowanie kuponów…
        </p>
      ) : !coupons?.length ? (
        <p className={`mt-2.5 p-4 text-sm text-muted-foreground ${cardClass}`}>
          Nie masz aktywnych kuponów. Wymień punkty na nagrodę, a kod pojawi się tutaj.
        </p>
      ) : (
        <ul className="mt-2.5 flex flex-col gap-2">
          {coupons.map((coupon) => (
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
              <p className="shrink-0 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-2 py-1 font-mono text-sm font-extrabold tracking-[0.12em] text-primary sm:px-2.5 sm:text-lg sm:tracking-[0.2em]">
                {coupon.code}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
