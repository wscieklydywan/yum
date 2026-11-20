'use client'

import { useState } from 'react'
import Image from 'next/image'
import { mutate } from 'swr'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { ChevronRight, Clock, LoaderCircle, Lock, Star, Ticket, X } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { describeStarRate } from '@/lib/loyalty-rate'
import { PUBLIC_LOYALTY_KEY } from '@/lib/loyalty-public'
import { usePublicLoyalty } from '@/lib/use-public-loyalty'
import { ACTIVE_COUPONS_KEY, COUPON_VALIDITY_HOURS, formatCouponExpiry, type CouponItem } from '@/lib/coupons'
import { useBackButtonClose } from '@/lib/use-back-button-close'
import { cn } from '@/lib/utils'
import { cardClass, ClubGroup } from './club-member-sections'

export type RedeemResult = {
  id: number
  code: string
  points: number
  reward: string
  cost: number
  items: CouponItem[]
  expires_at: string
}

const errorMessages: Record<string, string> = {
  not_enough_points: 'Masz za mało punktów na tę nagrodę.',
  not_authenticated: 'Sesja wygasła. Zaloguj się ponownie.',
  unknown_reward: 'Ta nagroda nie jest już dostępna.',
}

const backdropClass = 'fixed inset-0 z-50 bg-black/40 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0'
const popupClass = 'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-card p-6 text-center shadow-2xl outline-none transition-[opacity,translate,scale] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0'
const closeIconClass = 'absolute right-3 top-3 grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted'

export function ClubRewards({
  points,
  onRedeemed,
  variant = 'full',
  onShowAll,
}: {
  points: number
  onRedeemed: (result: RedeemResult) => void
  /** `preview`: short horizontal strip on the home tab; `full`: the whole catalogue as a grid in the coupons tab. */
  variant?: 'preview' | 'full'
  onShowAll?: () => void
}) {
  const loyalty = usePublicLoyalty()
  const preview = variant === 'preview'
  const allRewards = loyalty?.rewards
  const rewards = preview
    ? allRewards && [...allRewards].sort((a, b) => Number(b.cost <= points) - Number(a.cost <= points) || a.cost - b.cost).slice(0, 6)
    : allRewards
  const [confirming, setConfirming] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [voucher, setVoucher] = useState<RedeemResult | null>(null)
  const confirmReward = rewards?.find((reward) => reward.key === confirming)
  useBackButtonClose(confirming !== null, (open) => !open && !pending && setConfirming(null))
  useBackButtonClose(voucher !== null, (open) => !open && setVoucher(null))

  async function redeem() {
    if (!confirming) return
    setPending(true)
    const { data, error } = await createClient().rpc('redeem_reward', { reward_key: confirming })
    setPending(false)
    setConfirming(null)
    if (error || !data) {
      if (error?.message === 'unknown_reward') void mutate(PUBLIC_LOYALTY_KEY)
      toast.error(errorMessages[error?.message ?? ''] ?? 'Nie udało się odebrać nagrody. Spróbuj ponownie.')
      return
    }
    const result = data as RedeemResult
    setVoucher(result)
    onRedeemed(result)
    mutate(ACTIVE_COUPONS_KEY)
  }

  return (
    <ClubGroup
      id="nagrody"
      title={preview ? 'Nagrody za Stars' : 'Wymień Stars na nagrodę'}
      description={loyalty ? `${describeStarRate(loyalty.rate)} · odbierz do zamówienia` : 'Odbierz nagrodę do zamówienia'}
      aside={
        preview && onShowAll ? (
          <button type="button" onClick={onShowAll} className="flex min-h-11 shrink-0 items-center gap-0.5 rounded-full text-xs font-bold text-primary hover:underline sm:text-sm">
            Wszystkie
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        ) : undefined
      }
    >
      <div className={cn('flex items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-ink-foreground', !preview && 'sticky top-2 z-20 shadow-lg shadow-ink/20')}>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-club-gold/15">
          <Star className="size-4 fill-club-gold text-club-gold" aria-hidden="true" />
        </span>
        <p className="min-w-0 flex-1 text-xs font-medium text-ink-foreground/70">Twoje saldo Stars</p>
        <p className="shrink-0 whitespace-nowrap text-lg font-black tabular-nums">
          {points.toLocaleString('pl-PL')} <span className="text-xs font-bold text-ink-foreground/70">pkt</span>
        </p>
      </div>
      <ul
        className={
          preview
            ? '-mx-4 flex snap-x scroll-px-4 snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2 [scrollbar-width:none] [touch-action:pan-x_pan-y] [&::-webkit-scrollbar]:hidden'
            : 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4'
        }
      >
        {!rewards && Array.from({ length: 4 }, (_, index) => (
          <li key={index} aria-hidden="true" className={`h-52 shrink-0 animate-pulse bg-muted ${preview ? 'w-[min(66vw,17rem)]' : ''} ${cardClass}`} />
        ))}
        {rewards?.map((reward) => {
          const missing = reward.cost - points
          const canRedeem = missing <= 0
          return (
            <li key={reward.key} className={`flex min-w-0 flex-col overflow-hidden ${preview ? 'w-[min(66vw,17rem)] shrink-0 snap-start' : ''} ${cardClass}`}>
              <div className="relative aspect-[4/3] bg-muted">
                <Image src={reward.image} alt="" fill sizes="(min-width: 1024px) 280px, (min-width: 640px) 30vw, 66vw" className="object-cover" />
                <span className="absolute right-2.5 top-2.5 rounded-full bg-card px-2.5 py-1 text-xs font-extrabold leading-none tabular-nums text-primary shadow-sm sm:text-sm">
                  {reward.cost} pkt
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold leading-snug sm:text-base">{reward.name}</h3>
                  <p className="mt-0.5 truncate text-xs leading-relaxed text-muted-foreground">
                    {reward.note} · <span className="line-through">{reward.value.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirming(reward.key)}
                  disabled={!canRedeem || pending}
                  aria-label={canRedeem ? `Aktywuj kupon: ${reward.name}` : `${reward.name}: brakuje ${missing} pkt`}
                  className="mt-auto flex h-9 w-full min-w-0 items-center justify-center gap-1.5 rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground transition-[background-color,transform] hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground sm:text-[13px]"
                >
                  {canRedeem ? (
                    <>
                      <Ticket className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">Aktywuj kupon</span>
                    </>
                  ) : (
                    <>
                      <Lock className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">Brakuje <span className="tabular-nums">{missing.toLocaleString('pl-PL')}</span> pkt</span>
                    </>
                  )}
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <DialogPrimitive.Root open={confirming !== null} onOpenChange={(open) => !open && !pending && setConfirming(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className={backdropClass} />
          <DialogPrimitive.Popup className={popupClass}>
            <DialogPrimitive.Close aria-label="Zamknij" className={closeIconClass}>
              <X className="size-4" aria-hidden="true" />
            </DialogPrimitive.Close>
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
              <Clock className="size-7" aria-hidden="true" />
            </span>
            <DialogPrimitive.Title className="mt-3 text-xl font-extrabold">Odebrać {confirmReward?.name}?</DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
              Z konta zostanie odjęte <strong className="text-foreground">{confirmReward?.cost} pkt</strong>, a Ty otrzymasz jednorazowy kod.
            </DialogPrimitive.Description>
            <p className="mt-4 rounded-2xl bg-accent/60 p-3 text-left text-sm leading-relaxed">
              <strong>Kod będzie ważny przez {COUPON_VALIDITY_HOURS} godziny.</strong> Po tym czasie straci ważność, a punkty nie wrócą. Po wykorzystaniu w lokalu kod zostaje od razu usunięty.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={redeem}
                disabled={pending}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
                Odbieram kod
              </button>
              <DialogPrimitive.Close disabled={pending} className="h-11 w-full rounded-full text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted">
                Anuluj
              </DialogPrimitive.Close>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <DialogPrimitive.Root open={voucher !== null} onOpenChange={(open) => !open && setVoucher(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className={backdropClass} />
          <DialogPrimitive.Popup className={popupClass}>
            <DialogPrimitive.Close aria-label="Zamknij" className={closeIconClass}>
              <X className="size-4" aria-hidden="true" />
            </DialogPrimitive.Close>
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
              <Ticket className="size-7" aria-hidden="true" />
            </span>
            <DialogPrimitive.Title className="mt-3 text-xl font-extrabold">{voucher?.reward} jest Twój!</DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
              Podaj ten kod obsłudze przy zamówieniu.
            </DialogPrimitive.Description>
            <p className="mt-4 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 py-3 font-mono text-3xl font-extrabold tracking-[0.3em] text-primary">
              {voucher?.code}
            </p>
            {voucher && (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5" aria-hidden="true" />
                                    Ważny do <time dateTime={voucher.expires_at} className="whitespace-nowrap font-semibold text-foreground">{formatCouponExpiry(voucher.expires_at)}</time>
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Znajdziesz go też w zakładce Kupony → Moje.</p>
            <DialogPrimitive.Close className="mt-5 h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
              Super, dzięki!
            </DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </ClubGroup>
  )
}
