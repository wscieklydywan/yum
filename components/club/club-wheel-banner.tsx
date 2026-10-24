import { ChevronRight, Crown, Gift } from 'lucide-react'
import { PrizeWheel } from '@/components/yummy/prize-wheel'
import { EXTRA_SPIN_COST } from '@/lib/loyalty'

export function ClubWheelBanner({ freeSpinAvailable, onOpen }: { freeSpinAvailable: boolean; onOpen: () => void }) {
  return (
    <article
      aria-labelledby="club-wheel-title"
      className="relative flex min-h-40 overflow-hidden rounded-2xl bg-gradient-to-br from-[#fff4ea] via-[#ffe9da] to-[#ffd9c4] p-4 shadow-[0_10px_28px_rgba(150,50,20,0.1)] ring-1 ring-[#f6cdb5] sm:min-h-44 sm:rounded-3xl sm:p-5"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-[16%] top-1/2 w-[52%] -translate-y-1/2 sm:-right-[12%] sm:w-[48%]">
        <PrizeWheel className="max-w-none" />
      </div>

      <div className="relative flex w-[64%] flex-col">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Koło fortuny</p>
        <h3 id="club-wheel-title" className="mt-1 text-base font-extrabold leading-tight tracking-tight sm:text-lg">
          Zakręć i wygraj!
        </h3>
        <p className="mt-1 text-pretty text-xs leading-relaxed text-foreground/70 sm:text-sm">
          {freeSpinAvailable ? 'Masz dziś darmowe zakręcenie.' : `Darmowe wróci jutro. Teraz za ${EXTRA_SPIN_COST} pkt.`}
        </p>
        <button
          type="button"
          onClick={onOpen}
          aria-haspopup="dialog"
          className="mt-auto inline-flex h-9 w-fit items-center gap-1.5 rounded-full bg-primary pl-3 pr-2.5 text-xs font-bold text-primary-foreground shadow-[0_6px_16px_rgba(226,38,28,0.28)] transition-transform hover:scale-[1.02] active:scale-[0.98] sm:h-10 sm:text-sm"
        >
          {freeSpinAvailable ? <Gift className="size-4" aria-hidden="true" /> : <Crown className="size-4" aria-hidden="true" />}
          {freeSpinAvailable ? 'Zakręć za darmo' : `Zakręć za ${EXTRA_SPIN_COST} pkt`}
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </article>
  )
}
