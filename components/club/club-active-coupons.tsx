'use client'

import type { ReactNode } from 'react'
import useSWR from 'swr'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronDown, ChevronRight, Clock, Crown, Info, Ticket } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ACTIVE_COUPONS_KEY, formatCouponExpiry, type ActiveCoupon } from '@/lib/coupons'
import { describeReward, describeSchedule, describeScope, isPromotionRunning, type Promotion } from '@/lib/promotions'
import { cn } from '@/lib/utils'
import { PromotionBadge } from '@/components/promotion-badge'
import { cardClass } from './club-member-sections'
import { ClubSectionHeader } from './club-section-header'

export async function fetchActiveCoupons() {
  const { data, error } = await createClient()
    .from('reward_redemptions')
    .select('id, code, reward, cost, items, expires_at, created_at')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ActiveCoupon[]
}

export type CouponsTab = 'rewards' | 'mine' | 'public'

const subheadingClass = 'px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground'

export function ClubActiveCoupons({
  promotions,
  tierPercent,
  points,
  tab,
  onTabChange,
  rewards,
  children,
}: {
  promotions: Promotion[]
  tierPercent: number
  points: number
  tab: CouponsTab
  onTabChange: (tab: CouponsTab) => void
  rewards: ReactNode
  children?: ReactNode
}) {
  const { data, error, isLoading, mutate } = useSWR(ACTIVE_COUPONS_KEY, fetchActiveCoupons, { dedupingInterval: 30_000 })
  const now = Date.now()
  const coupons = data?.filter((coupon) => new Date(coupon.expires_at).getTime() > now)
  const tabs: { key: CouponsTab; label: string; count?: number }[] = [
    { key: 'rewards', label: 'Za Stars' },
    { key: 'mine', label: 'Moje', count: (coupons?.length ?? 0) + (tierPercent > 0 ? 1 : 0) },
    { key: 'public', label: 'Promocje', count: promotions.length },
  ]
  const activeIndex = tabs.findIndex((item) => item.key === tab)

  return (
    <section id="kupony" aria-labelledby="club-coupons-title" className="w-full min-w-0 scroll-mt-20">
      <ClubSectionHeader
        id="club-coupons-title"
        eyebrow="Członkostwo smakuje lepiej"
        title="Nagrody i kupony"
        description="Twoje Stars zamieniają się w coś pysznego. Wybierz nagrodę dla siebie."
      />

      <div
        role="tablist"
        aria-label="Rodzaje kuponów"
        className="relative mt-6 grid grid-cols-3 rounded-2xl bg-muted p-1 sm:mt-8 sm:max-w-xl"
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-xl bg-card shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(${Math.max(activeIndex, 0) * 100}%)` }}
        />
        {tabs.map((item) => {
          const selected = tab === item.key
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              id={`coupons-tab-${item.key}`}
              aria-selected={selected}
              aria-controls={`coupons-panel-${item.key}`}
              tabIndex={selected ? 0 : -1}
              onKeyDown={(event) => {
                const index = tabs.findIndex((candidate) => candidate.key === item.key)
                const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
                if (next < 0) return
                event.preventDefault()
                onTabChange(tabs[next].key)
                document.getElementById(`coupons-tab-${tabs[next].key}`)?.focus()
              }}
              onClick={() => onTabChange(item.key)}
              className={cn(
                'relative z-10 flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-full px-2 text-[13px] font-bold transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:h-11 sm:text-sm',
                selected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span className="truncate">{item.label}</span>
              {item.count ? (
                <span
                  className={cn(
                    'grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full px-1 text-[10px] font-extrabold leading-none tabular-nums transition-colors duration-300',
                    selected ? 'bg-primary/10 text-primary' : 'bg-card text-muted-foreground',
                  )}
                >
                  {item.count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" tabIndex={0} id={`coupons-panel-${tab}`} aria-labelledby={`coupons-tab-${tab}`} className="mt-6 focus-visible:outline-2 focus-visible:outline-primary sm:mt-8">
        {tab === 'rewards' ? (
          rewards
        ) : tab === 'mine' ? (
          <div className="flex flex-col gap-3">
            {children}

            {tierPercent > 0 && (
              <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#fff3d1] to-[#fffaf0] p-3.5 ring-1 ring-[#eed08a]/70 sm:rounded-3xl sm:p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f5b936]/25 text-[#8a5a00]">
                  <Crown className="size-5 fill-current" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold">Stały rabat statusowy</p>
                  <p className="mt-0.5 text-pretty text-xs leading-snug text-[#6b5320]">Naliczany automatycznie przy każdym zamówieniu</p>
                </div>
                <p className="shrink-0 text-2xl font-black tabular-nums tracking-tight text-[#8a5a00]">-{tierPercent}%</p>
              </div>
            )}

            <h2 className={cn('mt-2', subheadingClass)}>Aktywne kody</h2>
            {error ? (
              <Alert variant="destructive" className="rounded-2xl p-5">
                <AlertTitle>Nie udało się wczytać Twoich kuponów</AlertTitle>
                <AlertDescription className="flex flex-col items-start gap-3">
                  <p>To problem z połączeniem, nie utrata nagród. Spróbuj ponownie za chwilę.</p>
                  <Button variant="outline" size="lg" onClick={() => { void mutate() }} className="min-h-11 rounded-full">Spróbuj ponownie</Button>
                </AlertDescription>
              </Alert>
            ) : isLoading ? (
              <ul className="flex flex-col gap-2.5" aria-label="Ładowanie kuponów">
                {Array.from({ length: 2 }, (_, index) => (
                  <li key={index} aria-hidden="true"><Skeleton className="h-20 rounded-2xl" /></li>
                ))}
              </ul>
            ) : !coupons?.length ? (
              <Empty className="rounded-3xl border py-10">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Ticket aria-hidden="true" /></EmptyMedia>
                  <EmptyTitle>Tu będą czekać Twoje nagrody</EmptyTitle>
                  <EmptyDescription>Wymień Stars na coś pysznego lub zakręć kołem. Aktywne kody znajdziesz w tym miejscu.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button size="lg" onClick={() => onTabChange('rewards')} className="min-h-11 rounded-full">Zobacz nagrody<ChevronRight data-icon="inline-end" aria-hidden="true" /></Button>
                </EmptyContent>
              </Empty>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {coupons.map((coupon) => (
                  <li key={coupon.id} className={cn('flex items-stretch overflow-hidden', cardClass)}>
                    <div className="flex min-w-0 flex-1 items-center gap-3 p-3.5 sm:p-4">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                        <Ticket className="size-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-extrabold leading-snug">{coupon.reward}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs leading-snug text-muted-foreground">
                          <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                          <span className="min-w-0">
                            do{' '}
                            <time dateTime={coupon.expires_at} className="font-semibold text-foreground">
                              {formatCouponExpiry(coupon.expires_at)}
                            </time>
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex w-[34%] max-w-36 shrink-0 flex-col items-center justify-center gap-1 border-l-2 border-dashed border-primary/25 bg-primary/[0.04] px-2 py-3 text-center">
                      <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Kod</span>
                      <span className="break-all font-mono text-base font-extrabold leading-tight tracking-[0.1em] text-primary sm:text-lg sm:tracking-[0.16em]">
                        {coupon.code}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : !promotions.length ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-input px-4 py-7 text-center sm:rounded-3xl">
            <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
              <Clock className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm font-extrabold">Teraz nie ma aktywnych promocji</p>
            <p className="text-xs text-muted-foreground">Zajrzyj wkrótce!</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {promotions.map((promotion) => {
              const live = isPromotionRunning(promotion)
              const channels = [promotion.online && 'Online', promotion.in_store && 'W lokalu'].filter(Boolean).join(' i ') || 'Online'
              return (
                <li key={promotion.id} className={cn('overflow-hidden', cardClass)}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 p-3.5 outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/60 sm:p-4 [&::-webkit-details-marker]:hidden">
                      <PromotionBadge promotion={promotion} className="size-12 sm:size-14" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold leading-snug sm:text-base">{promotion.title}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          {live && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase leading-none tracking-wide text-emerald-700">
                              <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />
                              Trwa teraz
                            </span>
                          )}
                          <span>{describeSchedule(promotion)}</span>
                        </p>
                      </div>
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition-transform duration-200 group-open:rotate-180">
                        <ChevronDown className="size-4" aria-hidden="true" />
                      </span>
                      <span className="sr-only">Pokaż szczegóły</span>
                    </summary>
                    <div className="border-t border-border/70 bg-background/50 px-3.5 pb-3.5 pt-3 sm:px-4 sm:pb-4">
                      {promotion.description && <p className="mb-3 text-pretty text-sm leading-relaxed">{promotion.description}</p>}
                      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-xs">
                        <dt className="text-muted-foreground">Rabat</dt>
                        <dd className="font-semibold">{describeReward(promotion)}</dd>
                        <dt className="text-muted-foreground">Na co</dt>
                        <dd className="font-semibold">{describeScope(promotion)}</dd>
                        <dt className="text-muted-foreground">Kiedy</dt>
                        <dd className="font-semibold">{describeSchedule(promotion)}</dd>
                        {promotion.valid_to && (
                          <>
                            <dt className="text-muted-foreground">Do dnia</dt>
                            <dd className="font-semibold">{new Date(`${promotion.valid_to}T12:00:00`).toLocaleDateString('pl-PL')}</dd>
                          </>
                        )}
                        <dt className="text-muted-foreground">Gdzie</dt>
                        <dd className="font-semibold">{channels}</dd>
                      </dl>
                      <p className="mt-3 text-xs text-muted-foreground">Rabat nalicza się automatycznie – bez kodu.</p>
                    </div>
                  </details>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {tab !== 'rewards' && (
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-muted/70 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Rabat statusowy nie sumuje się z kodem rabatowym – przy zamówieniu zawsze stosujemy korzystniejszą cenę.
        </p>
      )}
    </section>
  )
}
