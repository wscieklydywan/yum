'use client'

import { useState, type ReactNode } from 'react'
import Image from 'next/image'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { mutate } from 'swr'
import { Candy, ChevronLeft, Gamepad2, LoaderCircle, Maximize, Minimize, RotateCcw, Skull, Star, Trophy, Volume2, VolumeX } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useBackButtonClose } from '@/lib/use-back-button-close'
import { enterFullscreen, exitFullscreen, isTouchDevice, useFullscreenSupported, useIsFullscreen } from '@/lib/use-fullscreen'
import { setSoundMuted, unlockAudio, useSoundMuted } from '@/lib/halloween-sound'
import { cn } from '@/lib/utils'
import { BatIcon, PumpkinIcon, SpiderWeb, SpookyLogo } from './halloween-decor'
import {
  gameErrorMessages,
  HALLOWEEN_LEADERBOARD_KEY,
  HALLOWEEN_STATE_KEY,
  type GameFinishResult,
  type HalloweenState,
} from '@/lib/halloween'
import { HalloweenGameCanvas } from './halloween-game-canvas'

type Phase =
  | { name: 'intro' }
  | { name: 'starting' }
  | { name: 'playing'; gameId: string; round: number }
  | { name: 'saving' }
  | { name: 'result'; result: GameFinishResult }

export function HalloweenGameDialog({
  open,
  onOpenChange,
  state,
  onFinished,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  state: HalloweenState | undefined
  onFinished: (result: GameFinishResult) => void
}) {
  const [phase, setPhase] = useState<Phase>({ name: 'intro' })
  const [error, setError] = useState('')
  const busy = phase.name === 'playing' || phase.name === 'saving' || phase.name === 'starting'
  const gamesLeft = state?.games_left ?? 0

  const handleOpenChange = (next: boolean) => {
    if (busy && !next) return
    if (!next) {
      setPhase({ name: 'intro' })
      setError('')
      exitFullscreen()
    }
    onOpenChange(next)
  }
  useBackButtonClose(open, handleOpenChange)

  async function start() {
    unlockAudio()
    if (isTouchDevice()) enterFullscreen()
    setError('')
    setPhase({ name: 'starting' })
    const { data, error: rpcError } = await createClient().rpc('halloween_start_game')
    if (rpcError || !data) {
      setPhase({ name: 'intro' })
      setError(gameErrorMessages[rpcError?.message ?? ''] ?? 'Nie udało się rozpocząć gry. Spróbuj ponownie.')
      return
    }
    void mutate(HALLOWEEN_STATE_KEY)
    setPhase({ name: 'playing', gameId: data as string, round: Date.now() })
  }

  async function finish(gameId: string, score: number) {
    setPhase({ name: 'saving' })
    const { data, error: rpcError } = await createClient().rpc('halloween_finish_game', { p_game: gameId, p_score: score })
    if (rpcError || !data) {
      setPhase({ name: 'intro' })
      setError(gameErrorMessages[rpcError?.message ?? ''] ?? 'Nie udało się zapisać wyniku.')
      return
    }
    const result = data as GameFinishResult
    setPhase({ name: 'result', result })
    onFinished(result)
    void mutate(HALLOWEEN_STATE_KEY)
    void mutate(HALLOWEEN_LEADERBOARD_KEY)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-[#140a20] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 sm:bg-black/60" />
        <DialogPrimitive.Popup className="fixed inset-0 z-50 flex flex-col bg-[#140a20] text-white outline-none transition-[opacity,translate,scale] duration-200 data-[ending-style]:translate-y-4 data-[ending-style]:opacity-0 data-[starting-style]:translate-y-4 data-[starting-style]:opacity-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[94svh] sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:overflow-hidden sm:rounded-[2rem] sm:shadow-2xl sm:data-[ending-style]:-translate-y-[48%] sm:data-[starting-style]:-translate-y-[48%]">
          <header className="relative flex h-14 shrink-0 items-center justify-center border-b border-white/10 px-4">
            <DialogPrimitive.Close
              aria-label="Wróć do panelu"
              disabled={busy}
              className="absolute left-2 grid size-10 place-items-center rounded-full transition-colors hover:bg-white/10 disabled:opacity-40"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </DialogPrimitive.Close>
            <DialogPrimitive.Title className="text-base font-bold">Dyniowe Łowy</DialogPrimitive.Title>
            <FullscreenToggle />
            <SoundToggle />
          </header>

          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-6">
            {phase.name === 'playing' ? (
              <HalloweenGameCanvas key={phase.round} onGameOver={(score) => finish(phase.gameId, score)} />
            ) : phase.name === 'saving' ? (
              <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-white/80">
                <LoaderCircle className="size-8 animate-spin text-[#f7a93b]" aria-hidden="true" />
                <p className="text-sm font-semibold">Zapisujemy wynik…</p>
              </div>
            ) : phase.name === 'result' ? (
              <GameResult result={phase.result} gamesLeft={gamesLeft} onReplay={start} />
            ) : (
              <GameIntro state={state} starting={phase.name === 'starting'} onStart={start} />
            )}

            <p aria-live="polite" className="mt-3 min-h-6 text-center text-sm font-semibold text-[#ff8f8f]">
              {error}
            </p>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function FullscreenToggle() {
  const supported = useFullscreenSupported()
  const fullscreen = useIsFullscreen()
  if (!supported) return null
  const label = fullscreen ? 'Wyjdź z pełnego ekranu' : 'Pełny ekran'
  return (
    <button
      type="button"
      onClick={() => (fullscreen ? exitFullscreen() : enterFullscreen())}
      aria-pressed={fullscreen}
      aria-label={label}
      title={label}
      className="absolute right-12 grid size-10 place-items-center rounded-full transition-colors hover:bg-white/10"
    >
      {fullscreen ? <Minimize className="size-5" aria-hidden="true" /> : <Maximize className="size-5" aria-hidden="true" />}
    </button>
  )
}

function SoundToggle() {
  const muted = useSoundMuted()
  return (
    <button
      type="button"
      onClick={() => {
        if (muted) unlockAudio()
        setSoundMuted(!muted)
      }}
      aria-pressed={!muted}
      aria-label={muted ? 'Włącz dźwięk' : 'Wycisz dźwięk'}
      title={muted ? 'Włącz dźwięk' : 'Wycisz dźwięk'}
      className="absolute right-2 grid size-10 place-items-center rounded-full transition-colors hover:bg-white/10"
    >
      {muted ? <VolumeX className="size-5 text-white/60" aria-hidden="true" /> : <Volume2 className="size-5" aria-hidden="true" />}
    </button>
  )
}

function GameIntro({ state, starting, onStart }: { state: HalloweenState | undefined; starting: boolean; onStart: () => void }) {
  const gamesLeft = state?.games_left ?? 0
  const catchItems: { label: string; value: string; icon: ReactNode }[] = [
    { label: 'Dynia', value: '+10', icon: <PumpkinIcon /> },
    { label: 'Cukierek', value: '+5', icon: <Candy className="size-5 text-[#ff7eb6]" aria-hidden="true" /> },
    { label: 'Złota dynia', value: '+50', icon: <PumpkinIcon gold /> },
  ]
  const avoidItems: { label: string; hint: string; demo: ReactNode }[] = [
    {
      label: 'Czaszka',
      hint: 'Spada prosto w dół',
      demo: (
        <span className="animate-[hazard-fall_1.8s_linear_infinite] motion-reduce:animate-none">
          <Skull className="size-5 text-white/90" aria-hidden="true" />
        </span>
      ),
    },
    {
      label: 'Nietoperz',
      hint: 'Lata zygzakiem',
      demo: (
        <span className="animate-[bat-zigzag_2.4s_ease-in-out_infinite] motion-reduce:animate-none">
          <BatIcon className="h-5 w-7 origin-center animate-[bat-flap_0.28s_ease-in-out_infinite] motion-reduce:animate-none" />
        </span>
      ),
    },
  ]
  const starProgress = state ? Math.min(100, (state.stars_today / Math.max(1, state.daily_star_cap)) * 100) : 0

  return (
    <div className="flex min-h-full flex-col gap-4">
      <div className="relative -mx-4 -mt-4 overflow-hidden px-4 pb-4 pt-6 text-center sm:-mx-6 sm:px-6">
        <Image src="/images/club/halloween-hero.webp" alt="" fill sizes="448px" className="-z-10 object-cover object-bottom opacity-60" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-[#140a20]/40 via-[#140a20]/60 to-[#140a20]" />
        <SpiderWeb className="absolute left-0 top-0 size-16 text-white/30" />
        <SpiderWeb flip className="absolute right-0 top-0 size-12 text-white/25" />
        <SpookyLogo className="mx-auto" />
        <h2 className="mt-7 text-balance text-2xl font-black leading-tight tracking-tight">
          Łap dynie, <span className="text-[#f7a93b]">unikaj straszydeł</span>
        </h2>
        <DialogPrimitive.Description className="mx-auto mt-1.5 max-w-xs text-pretty text-sm leading-relaxed text-white/70">
          Przesuwaj kociołek palcem, myszką lub strzałkami. Łap bez pudła, by nabić combo aż do x3.
        </DialogPrimitive.Description>
      </div>

      <section aria-labelledby="halloween-catch-title" className="flex flex-col gap-2">
        <h3 id="halloween-catch-title" className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#f7c948]">
          Łap · każda przepuszczona to −1 życie
        </h3>
        <ul className="grid grid-cols-3 gap-2">
          {catchItems.map((item) => (
            <li key={item.label} className="flex min-w-0 flex-col items-center gap-1 rounded-2xl bg-white/5 px-2 py-2.5 text-center ring-1 ring-white/10">
              <span className="grid size-8 place-items-center rounded-full bg-white/5">{item.icon}</span>
              <span className="w-full truncate text-[11px] text-white/70">{item.label}</span>
              <span className="text-sm font-black leading-none text-[#f7c948]">{`${item.value} pkt`}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="halloween-avoid-title" className="flex flex-col gap-2">
        <h3 id="halloween-avoid-title" className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#ff8f8f]">
          Unikaj · każde trafienie to −1 życie
        </h3>
        <ul className="grid grid-cols-2 gap-2">
          {avoidItems.map((item) => (
            <li key={item.label} className="flex min-w-0 items-center gap-2.5 rounded-2xl bg-[#ff8f8f]/8 p-2 pr-3 ring-1 ring-[#ff8f8f]/20">
              <span
                aria-hidden="true"
                className="relative grid h-14 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-black/35 ring-1 ring-inset ring-white/10"
              >
                {item.demo}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{item.label}</span>
                <span className="block truncate text-[11px] text-white/60">{item.hint}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {state && (
        <div className="rounded-2xl bg-[#f7a93b]/10 p-3 ring-1 ring-[#f7a93b]/25">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-bold text-[#ffd8a6]">
              <Star className="size-3.5 fill-[#f7c948] text-[#f7c948]" aria-hidden="true" />
              Stars dziś
            </span>
            <span className="font-black tabular-nums text-white">{`${state.stars_today}/${state.daily_star_cap}`}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-gradient-to-r from-[#f07b1d] to-[#f7c948]" style={{ width: `${starProgress}%` }} />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-white/60">
            {`${state.points_per_star} pkt = 1 Star · max ${state.max_stars_per_game} na grę`}
          </p>
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 mt-auto bg-gradient-to-t from-[#140a20] via-[#140a20] to-transparent px-4 pt-3 sm:-mx-6 sm:px-6">
        <button
          type="button"
          onClick={onStart}
          disabled={starting || !state?.active || gamesLeft <= 0}
          className="flex h-13 w-full items-center justify-center gap-2 rounded-full bg-[#f07b1d] text-base font-extrabold text-white shadow-[0_10px_28px_rgba(240,123,29,0.45)] transition-transform hover:scale-[1.01] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 sm:h-14"
        >
          {starting ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <Gamepad2 className="size-5" aria-hidden="true" />}
          {!state?.active ? 'Wydarzenie zakończone' : gamesLeft > 0 ? 'Graj teraz' : 'Brak gier na dziś'}
        </button>
        {state?.active && (
          <p className="mt-2 text-center text-xs font-semibold text-white/55">
            {`Pozostało ${gamesLeft} z ${state.daily_games} gier dzisiaj`}
          </p>
        )}
      </div>
    </div>
  )
}

function GameResult({ result, gamesLeft, onReplay }: { result: GameFinishResult; gamesLeft: number; onReplay: () => void }) {
  const newRecord = !result.flagged && result.score > 0 && result.score >= result.best_score
  return (
    <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-[#f7c948]/15 text-[#f7c948]">
        <Trophy className="size-8" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm text-white/70">{newRecord ? 'Nowy rekord!' : 'Twój wynik'}</p>
        <p className="text-5xl font-black tracking-tight">{result.score}</p>
        <p className="mt-1 text-xs text-white/60">Najlepszy: {result.best_score} pkt</p>
      </div>
      {result.flagged ? (
        <p className="max-w-xs text-sm text-[#ff8f8f]">Wynik nie przeszedł weryfikacji i nie został zaliczony.</p>
      ) : (
        <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-bold">
          <Star className="size-4 fill-[#f7c948] text-[#f7c948]" aria-hidden="true" />
          {result.stars > 0 ? `+${result.stars} Stars na konto` : 'Tym razem bez Stars – celuj wyżej!'}
        </p>
      )}
      <button
        type="button"
        onClick={onReplay}
        disabled={gamesLeft <= 0}
        className="mt-2 inline-flex h-12 items-center gap-2 rounded-full bg-[#f07b1d] px-6 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RotateCcw className="size-4" aria-hidden="true" />
        {gamesLeft > 0 ? `Zagraj ponownie (${gamesLeft})` : 'Wróć jutro po więcej gier'}
      </button>
    </div>
  )
}
