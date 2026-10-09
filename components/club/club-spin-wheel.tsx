'use client'

import { useRef, useState } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { mutate as globalMutate } from 'swr'
import { ChevronLeft, Crown, Gift, LoaderCircle } from 'lucide-react'
import { ACTIVE_COUPONS_KEY } from '@/lib/coupons'
import { createClient } from '@/lib/supabase/client'
import { PrizeWheel, segmentAngle } from '@/components/yummy/prize-wheel'
import { EXTRA_SPIN_COST } from '@/lib/loyalty'
import { useWheelPrizes } from '@/lib/use-wheel-prizes'
import { rewardSummary, type WheelPrize, type WheelRewardType } from '@/lib/wheel'
import { ClubFreeSpinCountdown, ClubPrizeList } from './club-member-sections'
import { ClubWinBurst } from './club-win-burst'

export type SpinResult = {
  segment: number
  prizeId: string
  type: WheelRewardType
  label: string
  prize: number
  productName: string
  discountValue: number
  code: string | null
  expiresAt: string | null
  points: number
  free: boolean
}

const SPIN_DURATION = 4800

const errorMessages: Record<string, string> = {
  free_spin_used: 'Darmowe zakręcenie na dziś zostało już wykorzystane.',
  not_enough_points: `Potrzebujesz co najmniej ${EXTRA_SPIN_COST} pkt na dodatkowe zakręcenie.`,
  not_authenticated: 'Sesja wygasła. Zaloguj się ponownie.',
  wheel_unavailable: 'Koło fortuny jest chwilowo niedostępne.',
}

export function ClubWheelDialog({
  open,
  onOpenChange,
  points,
  freeSpinAvailable,
  onFreeSpinReady,
  onSpinComplete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  points: number
  freeSpinAvailable: boolean
  onFreeSpinReady: () => void
  onSpinComplete: (result: SpinResult) => void
}) {
  const { data: prizes, mutate } = useWheelPrizes()
  const [rotation, setRotation] = useState(0)
  const [duration, setDuration] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [message, setMessage] = useState<{ tone: 'win' | 'error'; text: string } | null>(null)
  const [win, setWin] = useState<{ id: number; prize: WheelPrize | undefined; result: SpinResult } | null>(null)
  const rotationRef = useRef(0)

  const canPaySpin = points >= EXTRA_SPIN_COST

  async function spin() {
    if (spinning) return
    setSpinning(true)
    setMessage(null)
    setWin(null)
    const { data, error } = await createClient().rpc('spin_wheel', { use_points: !freeSpinAvailable })
    if (error || !data) {
      setSpinning(false)
      setMessage({ tone: 'error', text: errorMessages[error?.message ?? ''] ?? 'Nie udało się zakręcić kołem. Spróbuj ponownie.' })
      return
    }

    const result = data as SpinResult
    let wheel = prizes
    if (!wheel.some((item) => item.id === result.prizeId)) wheel = (await mutate()) ?? wheel
    const index = Math.max(0, wheel.findIndex((item) => item.id === result.prizeId))
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const spinTime = reduceMotion ? 0 : SPIN_DURATION
    const current = rotationRef.current
    const target = -index * segmentAngle(wheel.length)
    const delta = (((target - current) % 360) + 360) % 360
    const next = current + delta + (reduceMotion ? 0 : 360 * 6)
    rotationRef.current = next
    setDuration(spinTime)
    setRotation(next)

    window.setTimeout(() => {
      setSpinning(false)
      setWin({ id: Date.now(), prize: wheel[index], result })
      onSpinComplete(result)
      if (result.code) void globalMutate(ACTIVE_COUPONS_KEY)
    }, spinTime + 150)
  }

  const label = spinning ? 'Kręcimy…' : freeSpinAvailable ? 'Zakręć za darmo' : `Zakręć za ${EXTRA_SPIN_COST} pkt`

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (spinning && !next) return
        if (!next) {
          setMessage(null)
          setWin(null)
        }
        onOpenChange(next)
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 hidden bg-black/45 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 sm:block" />
        <DialogPrimitive.Popup className="fixed inset-0 z-50 flex flex-col bg-background outline-none transition-[opacity,transform] duration-200 data-[ending-style]:translate-y-4 data-[ending-style]:opacity-0 data-[starting-style]:translate-y-4 data-[starting-style]:opacity-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[92dvh] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:overflow-hidden sm:rounded-[2rem] sm:shadow-2xl sm:data-[ending-style]:-translate-y-[48%] sm:data-[starting-style]:-translate-y-[48%]">
          <header className="relative flex h-14 shrink-0 items-center justify-center border-b border-border/60 px-4">
            <DialogPrimitive.Close
              aria-label="Wróć do panelu"
              disabled={spinning}
              className="absolute left-2 grid size-10 place-items-center rounded-full transition-colors hover:bg-muted disabled:opacity-40"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </DialogPrimitive.Close>
            <DialogPrimitive.Title className="text-base font-bold">Koło fortuny</DialogPrimitive.Title>
          </header>

          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:px-6">
            <div className="text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Koło fortuny</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Zakręć i wygraj!</h2>
              <DialogPrimitive.Description className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-foreground/75">
                {freeSpinAvailable
                  ? 'Masz dziś darmowe zakręcenie. Wygrywaj punkty, darmowe pozycje z menu i rabaty.'
                  : `Darmowe zakręcenie wróci jutro. Możesz zakręcić ponownie za ${EXTRA_SPIN_COST} pkt.`}
              </DialogPrimitive.Description>
            </div>

            <div className="relative mx-auto mt-4 w-full max-w-[16.5rem] [container-type:inline-size] sm:max-w-[19rem]">
              <PrizeWheel rotation={rotation} durationMs={duration} className="max-w-full" />
              {win && <ClubWinBurst key={win.id} prize={win.prize} result={win.result} />}
            </div>

            <button
              type="button"
              onClick={spin}
              disabled={spinning || (!freeSpinAvailable && !canPaySpin)}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-bold text-primary-foreground shadow-[0_10px_22px_rgba(226,38,28,0.3)] transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 sm:h-14"
            >
              {spinning ? (
                <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
              ) : freeSpinAvailable ? (
                <Gift className="size-5" aria-hidden="true" />
              ) : (
                <Crown className="size-5" aria-hidden="true" />
              )}
              {label}
            </button>
            {!freeSpinAvailable && !canPaySpin && !spinning && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Brakuje Ci {EXTRA_SPIN_COST - points} pkt do dodatkowego zakręcenia. Wróć jutro po darmowe!
              </p>
            )}
            <p aria-live="polite" className="mt-2 min-h-6 text-center text-sm font-semibold">
              {message?.tone === 'error' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-primary">
                  {message.text}
                </span>
              )}
              {win && <span className="sr-only">{`${win.result.label}: ${rewardSummary({ reward_type: win.result.type, points: win.result.prize, product_name: win.result.productName, discount_value: win.result.discountValue })}`}</span>}
            </p>

            <div className="mt-3 flex flex-col gap-4">
              <ClubPrizeList />
              {!freeSpinAvailable && <ClubFreeSpinCountdown onReady={onFreeSpinReady} />}
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
