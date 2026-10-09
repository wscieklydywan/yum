import { ChevronRight, Crown, Gift } from 'lucide-react'
import { PrizeWheel } from '@/components/yummy/prize-wheel'
import { EXTRA_SPIN_COST } from '@/lib/loyalty'

export function ClubWheelBanner({ freeSpinAvailable, onOpen }: { freeSpinAvailable: boolean; onOpen: () => void }) {
  return (
    <section
      aria-labelledby="club-wheel-title"
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#fff4ea] via-[#ffe9da] to-[#ffd9c4] p-4 shadow-[0_14px_36px_rgba(150,50,20,0.12)] ring-1 ring-[#f6cdb5] sm:rounded-[2rem] sm:p-7"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-[22%] top-1/2 w-[58%] -translate-y-1/2 sm:-right-[8%] sm:w-[46%]">
        <PrizeWheel className="max-w-none" />
      </div>

      <div className="relative w-[64%] sm:w-[58%]">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary sm:text-xs">Koło fortuny</p>
        <h2 id="club-wheel-title" className="mt-1 text-xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          Zakręć i wygraj!
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-foreground/75 sm:mt-2.5 sm:text-base">
          {freeSpinAvailable
            ? 'Masz dziś darmowe zakręcenie. Sprawdź, co wygrasz!'
            : `Darmowe zakręcenie wróci jutro. Możesz zakręcić ponownie za ${EXTRA_SPIN_COST} pkt.`}
        </p>
        <button
          type="button"
          onClick={onOpen}
          aria-haspopup="dialog"
          className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-primary pl-3.5 pr-3 text-sm font-bold text-primary-foreground shadow-[0_8px_18px_rgba(226,38,28,0.3)] transition-transform hover:scale-[1.02] sm:mt-5 sm:h-12 sm:gap-2 sm:pl-5 sm:pr-4 sm:text-base"
        >
          {freeSpinAvailable ? <Gift className="size-4" aria-hidden="true" /> : <Crown className="size-4" aria-hidden="true" />}
          {freeSpinAvailable ? 'Zakręć za darmo' : `Zakręć za ${EXTRA_SPIN_COST} pkt`}
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
