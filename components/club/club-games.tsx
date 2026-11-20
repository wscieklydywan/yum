'use client'

import { ChevronDown, Trophy } from 'lucide-react'
import type { GameFinishResult } from '@/lib/halloween'
import { ClubSectionHeader } from './club-section-header'
import { ClubWheelBanner } from './club-wheel-banner'
import { ClubFreeSpinCountdown, ClubGroup, ClubPrizeList } from './club-member-sections'
import { HalloweenSection, useHalloweenState } from './halloween/halloween-section'

export function ClubGames({ freeSpinAvailable, onSpin, onFreeSpinReady, onGameFinished }: {
  freeSpinAvailable: boolean
  onSpin: () => void
  onFreeSpinReady: () => void
  onGameFinished: (result: GameFinishResult) => void
}) {
  const { data: halloween } = useHalloweenState()
  const ended = Boolean(halloween && !halloween.active && new Date(halloween.ends_at) <= new Date())

  return (
    <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
      <ClubSectionHeader eyebrow="Więcej niż jedzenie" title="Mała gra. Wielka frajda." description="Twoja codzienna porcja zabawy, Stars i pysznych nagród." />
      <ClubGroup id="club-daily-game" title="Spróbuj szczęścia" description="Codziennie jedno darmowe zakręcenie">
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">
            <ClubWheelBanner freeSpinAvailable={freeSpinAvailable} onOpen={onSpin} />
            {!freeSpinAvailable && <ClubFreeSpinCountdown onReady={onFreeSpinReady} />}
          </div>
          <details className="group min-w-0 rounded-3xl border border-border bg-card">
            <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 p-4 text-sm font-bold [&::-webkit-details-marker]:hidden">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted"><Trophy className="size-4 text-primary" aria-hidden="true" /></span>
              Co możesz wygrać?
              <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="border-t border-border p-4"><ClubPrizeList /></div>
          </details>
        </div>
      </ClubGroup>
      {ended ? (
        <section aria-labelledby="club-past-events" className="flex min-w-0 flex-col gap-3">
          <h2 id="club-past-events" className="text-lg font-bold tracking-tight sm:text-xl">Poprzednie wydarzenia</h2>
          <details className="group min-w-0 rounded-3xl border border-border bg-card">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-muted"><Trophy className="size-5 text-primary" aria-hidden="true" /></span>
              <span className="flex min-w-0 flex-1 flex-col gap-1"><span className="text-sm font-bold">Dyniowe Łowy</span><span className="text-xs text-muted-foreground">Zakończone · wyniki i nagrody</span></span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="border-t border-border p-3 sm:p-5"><HalloweenSection onPointsChange={onGameFinished} /></div>
          </details>
        </section>
      ) : <HalloweenSection onPointsChange={onGameFinished} />}
    </div>
  )
}
