'use client'

import { useEffect, useState } from 'react'
import { Timer, Trophy } from 'lucide-react'
import { WantedLevel } from './wanted-level'
import { ViceResultsModal } from './vice-results-modal'
import { formatRemaining, useViceCountdown } from '@/lib/vice-countdown'
import { cn } from '@/lib/utils'

/** Pinned bottom-right GTA VI HUD: wanted level plus a label that alternates between the contest name and the results countdown. */
export function ViceHud({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const remaining = useViceCountdown()
  const finished = remaining === 0

  useEffect(() => {
    if (finished) return
    const id = window.setInterval(() => setShowTimer((value) => !value), 3500)
    return () => window.clearInterval(id)
  }, [finished])

  const timerVisible = showTimer && remaining !== null && !finished

  return (
    <aside aria-label="Yummy City HUD" className={cn('pointer-events-none fixed bottom-3 right-3 z-40 flex flex-col items-end gap-2 sm:bottom-5 sm:right-5', className)}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="pointer-events-auto flex items-center gap-2 rounded-lg bg-black/75 px-2.5 py-1.5 text-white shadow-lg ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-black/85"
      >
        <span className="flex flex-col items-start">
          <WantedLevel size="sm" />
          <span key={timerVisible ? 'timer' : 'label'} className="vice-id-enter mt-0.5 flex h-3.5 items-center gap-1 text-[9px] font-black uppercase tracking-[0.2em] text-[#ff6fa8]">
            {timerVisible ? (
              <>
                <Timer className="size-3" aria-hidden="true" />
                <span className="font-mono text-[11px] tracking-[0.12em] text-[#ffd166] tabular-nums">{formatRemaining(remaining ?? 0)}</span>
              </>
            ) : (
              <>
                <Trophy className="size-3" aria-hidden="true" />
                {finished ? 'Wyniki GTA6 już są!' : 'Wyniki konkursu GTA6'}
              </>
            )}
          </span>
        </span>
        <span className="sr-only">Pokaż informacje o wynikach konkursu GTA6</span>
      </button>

      <ViceResultsModal open={open} onOpenChange={setOpen} remaining={remaining} />
    </aside>
  )
}
