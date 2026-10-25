'use client'

import { useState } from 'react'
import Image from 'next/image'
import useSWR from 'swr'
import { Crown, Gamepad2, Ghost, Medal, Star, Trophy } from 'lucide-react'
import {
  fetchHalloweenLeaderboard,
  fetchHalloweenState,
  HALLOWEEN_ENDS_LABEL,
  HALLOWEEN_LEADERBOARD_KEY,
  HALLOWEEN_STATE_KEY,
  podiumPrizes,
  type GameFinishResult,
} from '@/lib/halloween'
import { cn } from '@/lib/utils'
import { cardClass, ClubSectionTitle } from '../club-member-sections'
import { HalloweenGameDialog } from './halloween-game-dialog'
import { HangingSpider, SpiderWeb, SpookyLogo } from './halloween-decor'

const medalColors = ['text-[#f5b936]', 'text-[#b9c0c8]', 'text-[#cd8a5a]']
const podiumOrder = [1, 0, 2]

function pluralGames(count: number) {
  if (count === 1) return 'gra'
  const lastDigit = count % 10
  const lastTwo = count % 100
  return lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14) ? 'gry' : 'gier'
}

export function useHalloweenState() {
  return useSWR(HALLOWEEN_STATE_KEY, fetchHalloweenState, { revalidateOnFocus: false })
}

export function HalloweenTeaser({ onOpen }: { onOpen: () => void }) {
  const { data } = useHalloweenState()
  if (data && !data.active) return null
  const gamesLabel = data ? `Graj · ${data.games_left} ${pluralGames(data.games_left)}` : 'Graj'
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative isolate flex min-h-40 w-full overflow-hidden rounded-2xl bg-[#140a20] p-4 text-left text-white shadow-[0_10px_28px_rgba(40,10,60,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f07b1d] focus-visible:ring-offset-2 sm:min-h-44 sm:rounded-3xl sm:p-5"
    >
      <Image src="/images/club/halloween-hero.webp" alt="" fill sizes="(min-width: 640px) 50vw, 100vw" className="-z-10 object-cover object-right opacity-80" />
      <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-[#140a20] via-[#140a20]/80 to-[#140a20]/10" />
      <SpiderWeb flip className="absolute right-0 top-0 size-14 text-white/25" />

      <span className="relative flex w-[64%] flex-col">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#f7a93b]">{`Halloween · do ${HALLOWEEN_ENDS_LABEL}`}</span>
        <span className="mt-1 text-base font-extrabold leading-tight tracking-tight sm:text-lg">Dyniowe Łowy</span>
        <span className="mt-1 text-pretty text-xs leading-relaxed text-white/70 sm:text-sm">Łap dynie, zbieraj Stars i walcz o top 3.</span>
        <span className="mt-auto inline-flex h-9 w-fit items-center gap-1.5 rounded-full bg-[#f07b1d] pl-3 pr-3.5 text-xs font-bold shadow-[0_6px_16px_rgba(240,123,29,0.35)] transition-transform group-hover:scale-[1.02] group-active:scale-[0.98] sm:h-10 sm:text-sm">
          <Gamepad2 className="size-4" aria-hidden="true" />
          {gamesLabel}
        </span>
      </span>
    </button>
  )
}

export function HalloweenSection({ onPointsChange }: { onPointsChange: (result: GameFinishResult) => void }) {
  const [open, setOpen] = useState(false)
  const { data: state } = useHalloweenState()
  const { data: board, isLoading } = useSWR(HALLOWEEN_LEADERBOARD_KEY, fetchHalloweenLeaderboard, {
    refreshInterval: open ? 0 : 60_000,
    revalidateOnFocus: !open,
  })
  const meOutsideTop = board?.me && !board.top.some((entry) => entry.me)

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section
        aria-labelledby="halloween-title"
        className="relative isolate overflow-hidden rounded-3xl bg-[#140a20] text-white shadow-[0_18px_40px_rgba(40,10,60,0.35)] sm:rounded-[2rem]"
      >
        <Image
          src="/images/club/halloween-hero.webp"
          alt=""
          fill
          sizes="(min-width: 768px) 720px, 100vw"
          className="-z-10 object-cover object-bottom opacity-80"
          priority
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-[#140a20]/30 via-[#140a20]/70 to-[#140a20]" />
        <SpiderWeb className="absolute left-0 top-0 size-20 text-white/30 sm:size-28" />
        <SpiderWeb flip className="absolute right-0 top-0 size-16 text-white/25 sm:size-24" />
        <HangingSpider className="absolute right-10 top-0 h-16 w-5 sm:right-16 sm:h-20" thread={34} />
        <Ghost aria-hidden="true" className="absolute bottom-40 right-4 size-7 animate-[spooky-float_5s_ease-in-out_infinite] text-white/30 sm:size-9" />

        <div className="flex flex-col items-center px-4 pb-5 pt-7 text-center sm:px-8 sm:pb-8 sm:pt-10">
          <SpookyLogo />
          <p className="mt-6 rounded-full bg-[#f07b1d]/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ffb46a] ring-1 ring-[#f07b1d]/40 sm:text-xs">
            Halloween · do {HALLOWEEN_ENDS_LABEL}
          </p>
          <h2 id="halloween-title" className="mt-3 text-balance text-3xl font-black leading-none tracking-tight sm:text-5xl">
            Dyniowe <span className="text-[#f7a93b]">Łowy</span>
          </h2>
          <p className="mt-2.5 max-w-sm text-pretty text-sm leading-relaxed text-white/75 sm:text-base">
            Łap dynie do kociołka (nie przepuść żadnej!), omijaj czaszki i nietoperze. Zdobywaj Stars i walcz o podium.
          </p>

          <dl className="mt-5 grid w-full max-w-md grid-cols-3 gap-2">
            <Stat label="Rekord" value={state?.best_score ?? '–'} />
            <Stat label="Gry dziś" value={state ? `${state.games_left}/${state.daily_games}` : '–'} />
            <Stat label="Stars dziś" value={state ? `${state.stars_today}/${state.daily_star_cap}` : '–'} />
          </dl>

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            disabled={!state?.active}
            className="mt-5 inline-flex h-13 w-full max-w-md items-center justify-center gap-2 rounded-full bg-[#f07b1d] text-base font-extrabold text-white shadow-[0_10px_28px_rgba(240,123,29,0.5)] transition-transform hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 sm:h-14"
          >
            <Gamepad2 className="size-5" aria-hidden="true" />
            {state && !state.active ? 'Wydarzenie zakończone' : 'Zagraj teraz'}
          </button>
        </div>
      </section>

      <section aria-labelledby="halloween-prizes-title" className="flex flex-col gap-3">
        <ClubSectionTitle id="halloween-prizes-title" title="Nagrody dla top 3" aside={`Po ${HALLOWEEN_ENDS_LABEL}`} />
        <ol className="grid grid-cols-3 items-end gap-2 sm:gap-3">
          {podiumOrder.map((index) => {
            const prize = podiumPrizes[index]
            const first = index === 0
            return (
              <li
                key={prize.place}
                style={{ order: podiumOrder.indexOf(index) }}
                className={cn(
                  'flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-2 pb-3 text-center ring-1',
                  first
                    ? 'bg-gradient-to-b from-[#3b1650] to-[#1f0d33] pt-4 text-white ring-[#f5b936]/40 sm:pt-5'
                    : 'bg-card pt-3 ring-border',
                )}
              >
                {first ? (
                  <Trophy className="size-8 text-[#f5b936] sm:size-9" aria-hidden="true" />
                ) : (
                  <Medal className={cn('size-7', medalColors[index])} aria-hidden="true" />
                )}
                <p className={cn('text-[11px] font-bold uppercase tracking-wide', first ? 'text-[#f7a93b]' : 'text-muted-foreground')}>
                  {prize.place}. miejsce
                </p>
                <p className="text-balance text-xs font-extrabold leading-snug sm:text-sm">
                  <span className="sm:hidden">{prize.short}</span>
                  <span className="hidden sm:inline">{prize.title}</span>
                </p>
              </li>
            )
          })}
        </ol>
      </section>

      <section aria-labelledby="halloween-board-title" className="flex flex-col gap-3">
        <ClubSectionTitle id="halloween-board-title" title="Ranking" aside={board ? `${board.players} graczy` : undefined} />
        <div className={cn('overflow-hidden', cardClass)}>
          {isLoading ? (
            <ul className="divide-y divide-border" aria-label="Ładowanie rankingu">
              {Array.from({ length: 4 }, (_, i) => (
                <li key={i} className="flex items-center gap-3 px-3.5 py-3">
                  <span className="size-9 animate-pulse rounded-full bg-muted" />
                  <span className="h-3.5 flex-1 animate-pulse rounded bg-muted" />
                  <span className="h-3.5 w-12 animate-pulse rounded bg-muted" />
                </li>
              ))}
            </ul>
          ) : !board || board.top.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <Ghost className="size-9 text-muted-foreground/60" aria-hidden="true" />
              <p className="text-sm font-bold">Ranking jest pusty</p>
              <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">Nikt jeszcze nie zagrał. Zostań pierwszym liderem!</p>
            </div>
          ) : (
            <ol className="divide-y divide-border">
              {board.top.map((entry) => (
                <LeaderboardRow key={entry.rank} rank={entry.rank} name={entry.name} score={entry.score} me={entry.me} />
              ))}
              {meOutsideTop && board.me && (
                <>
                  <li aria-hidden="true" className="py-1 text-center text-xs font-bold tracking-[0.3em] text-muted-foreground">
                    •••
                  </li>
                  <LeaderboardRow rank={board.me.rank} name={board.me.name} score={board.me.score} me />
                </>
              )}
            </ol>
          )}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Liczy się najlepszy wynik. Przy remisie wygrywa ten, kto osiągnął go wcześniej. Podejrzane wyniki są automatycznie odrzucane.
        </p>
      </section>

      <HalloweenGameDialog open={open} onOpenChange={setOpen} state={state} onFinished={onPointsChange} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-2xl bg-white/10 px-1.5 py-2.5 ring-1 ring-white/10">
      <dt className="truncate text-[10px] font-semibold uppercase tracking-wide text-white/60">{label}</dt>
      <dd className="text-lg font-black tabular-nums sm:text-xl">{value}</dd>
    </div>
  )
}

function LeaderboardRow({ rank, name, score, me }: { rank: number; name: string; score: number; me?: boolean }) {
  const podium = rank <= 3
  return (
    <li className={cn('flex items-center gap-3 px-3.5 py-3 sm:px-4', me && 'bg-[#f07b1d]/10', rank === 1 && !me && 'bg-[#f5b936]/5')}>
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full text-sm font-black tabular-nums',
          podium ? 'bg-[#1f0d33] text-white' : 'bg-muted text-muted-foreground',
        )}
      >
        {podium ? <Crown className={cn('size-4', medalColors[rank - 1])} aria-label={`${rank}. miejsce`} /> : rank}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className={cn('truncate text-sm', podium ? 'font-extrabold' : 'font-semibold')}>{name}</span>
        {me && <span className="shrink-0 rounded-full bg-[#f07b1d] px-1.5 py-0.5 text-[10px] font-bold text-white">Ty</span>}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-black tabular-nums">
        <Star className="size-3.5 fill-[#f5b936] text-[#f5b936]" aria-hidden="true" />
        {score}
      </span>
    </li>
  )
}
