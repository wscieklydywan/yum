'use client'

import { ChevronRight, Crown, Gift } from 'lucide-react'
import { PrizeWheel } from '@/components/yummy/prize-wheel'
import { useWheelConfig } from '@/lib/use-wheel-config'

export function ClubWheelBanner({ freeSpinAvailable, onOpen }: { freeSpinAvailable: boolean; onOpen: () => void }) {
  const { extraSpinCost: EXTRA_SPIN_COST } = useWheelConfig()
  return (
    <article
      aria-labelledby="club-wheel-title"
      className="relative flex min-h-56 overflow-hidden rounded-3xl bg-ink p-5 text-ink-foreground sm:min-h-64 sm:p-6"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-[16%] top-1/2 w-[52%] max-w-56 -translate-y-1/2 sm:-right-8 sm:w-[48%]">
        <PrizeWheel className="max-w-none" />
      </div>

      <div className="relative flex w-[64%] flex-col">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-club-gold">Koło fortuny</p>
        <h3 id="club-wheel-title" className="mt-3 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
          Zakręć i wygraj!
        </h3>
        <p className="mt-2 text-pretty text-xs leading-relaxed text-ink-foreground/75 sm:text-sm">
          {freeSpinAvailable ? 'Masz dziś darmowe zakręcenie.' : `Darmowe wróci jutro. Teraz za ${EXTRA_SPIN_COST} pkt.`}
        </p>
        <button
          type="button"
          onClick={onOpen}
          aria-haspopup="dialog"
          className="mt-5 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full bg-club-gold px-3 text-xs font-bold text-ink transition-colors hover:bg-club-gold/90 sm:mt-auto sm:text-sm"
        >
          {freeSpinAvailable ? <Gift className="size-4" aria-hidden="true" /> : <Crown className="size-4" aria-hidden="true" />}
          {freeSpinAvailable ? 'Zakręć za darmo' : `Zakręć za ${EXTRA_SPIN_COST} pkt`}
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </article>
  )
}
