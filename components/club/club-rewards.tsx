'use client'

import { useState } from 'react'
import Image from 'next/image'
import { mutate } from 'swr'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { Clock, LoaderCircle, Ticket, X } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { rewards, type RewardKey } from '@/lib/loyalty'
import { ACTIVE_COUPONS_KEY, COUPON_VALIDITY_HOURS, formatCouponExpiry, type CouponItem } from '@/lib/coupons'
import { cardClass } from './club-member-sections'

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
}

const backdropClass = 'fixed inset-0 z-50 bg-black/40 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0'
const popupClass = 'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-card p-6 text-center shadow-2xl outline-none transition-[opacity,transform] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0'
const closeIconClass = 'absolute right-3 top-3 grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted'

export function ClubRewards({ points, onRedeemed }: { points: number; onRedeemed: (result: RedeemResult) => void }) {
  const [confirming, setConfirming] = useState<RewardKey | null>(null)
  const [pending, setPending] = useState(false)
  const [voucher, setVoucher] = useState<RedeemResult | null>(null)
  const confirmReward = rewards.find((reward) => reward.key === confirming)

  async function redeem() {
    if (!confirming) return
    setPending(true)
    const { data, error } = await createClient().rpc('redeem_reward', { reward_key: confirming })
    setPending(false)
    setConfirming(null)
    if (error || !data) {
      toast.error(errorMessages[error?.message ?? ''] ?? 'Nie udało się odebrać nagrody. Spróbuj ponownie.')
      return
    }
    const result = data as RedeemResult
    setVoucher(result)
    onRedeemed(result)
    mutate(ACTIVE_COUPONS_KEY)
  }

  return (
    <section id="nagrody" aria-labelledby="club-rewards-title" className="scroll-mt-20">
      <h2 id="club-rewards-title" className="text-sm font-extrabold uppercase tracking-[0.08em] sm:text-base">
        Twoje nagrody
      </h2>
      <ul className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {rewards.map((reward) => {
          const missing = reward.cost - points
          return (
            <li key={reward.key} className={`flex flex-col overflow-hidden ${cardClass}`}>
              <div className="relative aspect-[4/3] bg-muted">
                <Image src={reward.image} alt="" fill sizes="(min-width: 1024px) 140px, 50vw" className="object-cover" />
                <span className="absolute right-1.5 top-1.5 rounded-full bg-card px-1.5 py-0.5 text-[10px] font-bold text-primary shadow-sm sm:right-2 sm:top-2 sm:px-2 sm:text-xs">
                  {reward.cost} pkt
                </span>
              </div>
              <div className="flex flex-1 flex-col items-center gap-2 p-2 text-center sm:p-3">
                <h3 className="text-xs font-bold leading-tight sm:text-sm">{reward.name}</h3>
                <button
                  type="button"
                  onClick={() => setConfirming(reward.key)}
                  disabled={missing > 0 || pending}
                  className="mt-auto flex h-8 w-full items-center justify-center gap-1 rounded-full bg-primary/10 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground sm:h-9 sm:text-sm"
                >
                  {missing > 0 ? `Brak ${missing} pkt` : 'Odbierz'}
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
            <p className="mt-1 text-xs text-muted-foreground">Znajdziesz go też w sekcji „Aktywne kupony”.</p>
            <DialogPrimitive.Close className="mt-5 h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
              Super, dzięki!
            </DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </section>
  )
}
