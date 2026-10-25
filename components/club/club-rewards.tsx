'use client'

import { useState } from 'react'
import Image from 'next/image'
import { mutate } from 'swr'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { Clock, LoaderCircle, Plus, Star, Ticket, X } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { rewards, type RewardKey } from '@/lib/loyalty'
import { ACTIVE_COUPONS_KEY, COUPON_VALIDITY_HOURS, formatCouponExpiry, type CouponItem } from '@/lib/coupons'
import { useBackButtonClose } from '@/lib/use-back-button-close'
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
}

const backdropClass = 'fixed inset-0 z-50 bg-black/40 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0'
const popupClass = 'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-card p-6 text-center shadow-2xl outline-none transition-[opacity,translate,scale] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0'
const closeIconClass = 'absolute right-3 top-3 grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted'

export function ClubRewards({ points, onRedeemed }: { points: number; onRedeemed: (result: RedeemResult) => void }) {
  const [confirming, setConfirming] = useState<RewardKey | null>(null)
  const [pending, setPending] = useState(false)
  const [voucher, setVoucher] = useState<RedeemResult | null>(null)
  const confirmReward = rewards.find((reward) => reward.key === confirming)
  useBackButtonClose(confirming !== null, (open) => !open && !pending && setConfirming(null))
  useBackButtonClose(voucher !== null, (open) => !open && setVoucher(null))

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
    <ClubGroup
      id="nagrody"
      title="Wydaj Stars"
      description="1 Star za każde 10 zł · odbierz do zamówienia"
      aside={
          <>
            <Star className="size-3.5 fill-[#f5b936] text-[#f5b936]" aria-hidden="true" />
            <span className="font-semibold tabular-nums">{points.toLocaleString('pl-PL')}</span>
          </>
        }
    >
      <ul className="-mx-4 flex snap-x scroll-px-4 px-4 snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:none] [touch-action:pan-x_pan-y] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-4 [&::-webkit-scrollbar]:hidden">
        {rewards.map((reward) => {
          const missing = reward.cost - points
          const canRedeem = missing <= 0
          return (
            <li key={reward.key} className={`flex w-[min(62vw,15rem)] min-w-0 shrink-0 snap-start flex-col overflow-hidden sm:w-auto sm:min-w-0 ${cardClass}`}>
              <div className="relative aspect-[4/3] bg-muted">
                <Image src={reward.image} alt="" fill sizes="(min-width: 1280px) 220px, (min-width: 640px) 30vw, 62vw" className="object-cover" />
                <span className="absolute right-2 top-2 rounded-full bg-card px-2 py-0.5 text-xs font-bold text-primary shadow-sm">
                  {reward.cost} pkt
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-2.5 sm:p-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold sm:text-base">{reward.name}</h3>
                  <p className="truncate text-xs text-muted-foreground">
                    {reward.note} · <span className="line-through">{reward.value.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł</span>
                  </p>
                </div>
                <div className="mt-auto flex items-center gap-1.5">
                  <span
                    className={`flex h-8 min-w-0 flex-1 items-center gap-1 rounded-full px-2 text-[11px] font-semibold sm:h-9 sm:text-xs ${canRedeem ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}`}
                  >
                    <Star className="size-3.5 shrink-0 fill-[#f5b936] text-[#f5b936]" aria-hidden="true" />
                    <span className="truncate">{canRedeem ? 'Możesz odebrać' : `Brakuje ${missing} pkt`}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirming(reward.key)}
                    disabled={!canRedeem || pending}
                    aria-label={`Odbierz: ${reward.name}`}
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_14px_rgba(226,38,28,0.3)] transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none sm:size-9"
                  >
                    <Plus className="size-4" strokeWidth={2.5} aria-hidden="true" />
                  </button>
                </div>
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
    </ClubGroup>
  )
}
