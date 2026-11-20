'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import useSWR, { useSWRConfig } from 'swr'
import { Star, Ticket, Users, Volume2, VolumeX, X } from 'lucide-react'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { splitRemaining, type Remaining } from '@/lib/vice-countdown'
import type { ViceDrawState, ViceWinner } from '@/lib/vice-draw'
import { DrawButton, NameRoller, WastedOverlay, WinnerIdCard, type DrawPhase } from './vice-draw-stage'

const THEME_SRC = '/audio/gta-theme.mp3'
const THEME_VOLUME = 0.45
const MIN_ROLL_MS = 4200
const WASTED_MS = 2300

async function fetchStats(url: string): Promise<ViceDrawState> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('draw stats failed')
  return response.json()
}

const DRAW_KEY = '/api/vice/draw'
const isFinalForVisitor = (state: ViceDrawState | undefined) => Boolean(state?.winner && !state.canDraw)

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

function Digit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="w-full rounded-xl bg-black/55 py-3 text-center font-mono text-4xl font-black tabular-nums text-[#ffd166] ring-1 ring-white/15 backdrop-blur-sm sm:text-6xl">
        {String(value).padStart(2, '0')}
      </span>
      <span className="mt-2 text-[10px] font-black uppercase tracking-[0.3em] text-white/70">{label}</span>
    </div>
  )
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number | null; label: string }) {
  return (
    <div className="flex flex-1 items-center gap-3 rounded-xl bg-white/[0.07] px-4 py-3 text-left ring-1 ring-white/10 backdrop-blur-sm">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ff6fa8] to-[#ff8a3d]">{icon}</span>
      <span className="flex flex-col">
        <span className="font-mono text-2xl font-black leading-none tabular-nums">{value === null ? '–' : value.toLocaleString('pl-PL')}</span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">{label}</span>
      </span>
    </div>
  )
}

/** Police lightbar: red and blue beacons strobing alternately, each throwing a rotating beam and a wash of light. */
function SirenLights() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
      <Image src="/images/vice-sunset.webp" alt="" fill priority sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#12061a]/40 via-[#12061a]/80 to-[#12061a]" />

      <div className="siren-wash-red absolute inset-y-0 left-0 w-2/3 bg-[radial-gradient(ellipse_at_0%_0%,rgba(255,30,60,0.55),transparent_65%)] mix-blend-screen" />
      <div className="siren-wash-blue absolute inset-y-0 right-0 w-2/3 bg-[radial-gradient(ellipse_at_100%_0%,rgba(40,110,255,0.6),transparent_65%)] mix-blend-screen" />

      <div className="siren-beam-red absolute left-[22%] top-0 size-[160vmax] -translate-x-1/2 -translate-y-1/2 opacity-30 mix-blend-screen [background:conic-gradient(from_0deg,transparent_0deg,rgba(255,40,60,0.9)_12deg,transparent_28deg,transparent_180deg,rgba(255,40,60,0.9)_192deg,transparent_208deg)]" />
      <div className="siren-beam-blue absolute left-[78%] top-0 size-[160vmax] -translate-x-1/2 -translate-y-1/2 opacity-30 mix-blend-screen [background:conic-gradient(from_90deg,transparent_0deg,rgba(40,110,255,0.9)_12deg,transparent_28deg,transparent_180deg,rgba(40,110,255,0.9)_192deg,transparent_208deg)]" />

      <div className="absolute inset-x-0 top-0 flex h-2 gap-1 bg-black/60 px-1">
        {['red', 'blue', 'red', 'blue'].map((color, index) => (
          <span
            key={index}
            className={
              color === 'red'
                ? 'siren-strobe-red flex-1 rounded-b bg-[#ff1e3c] shadow-[0_0_32px_10px_rgba(255,30,60,0.85)]'
                : 'siren-strobe-blue flex-1 rounded-b bg-[#2a6eff] shadow-[0_0_32px_10px_rgba(42,110,255,0.85)]'
            }
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.18)_0px,rgba(0,0,0,0.18)_1px,transparent_1px,transparent_3px)] opacity-40" />
    </div>
  )
}

/** Plays the theme while the modal is open; the open click is the user gesture that lets the browser start audio. */
function useThemeMusic(open: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    if (!open) return
    const audio = audioRef.current ?? new Audio(THEME_SRC)
    audioRef.current = audio
    audio.loop = true
    audio.volume = THEME_VOLUME
    audio.currentTime = 0
    if (!muted) audio.play().catch(() => setMuted(true))
    return () => audio.pause()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- muting is handled by toggle(), the effect only reacts to opening and closing
  }, [open])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (muted) {
      audio.play().catch(() => undefined)
      setMuted(false)
    } else {
      audio.pause()
      setMuted(true)
    }
  }

  return { muted, toggle }
}

export function ViceResultsModal({ open, onOpenChange, remaining }: { open: boolean; onOpenChange: (open: boolean) => void; remaining: Remaining | null }) {
  const parts = remaining === null ? null : splitRemaining(remaining)
  const { muted, toggle } = useThemeMusic(open)
  const { cache } = useSWRConfig()
  const cachedState = cache.get(DRAW_KEY)?.data as ViceDrawState | undefined
  // A drawn result is final for visitors: keep it in memory and stop polling or refetching on reopen/focus.
  const { data: stats, mutate } = useSWR<ViceDrawState>(open ? DRAW_KEY : null, fetchStats, {
    refreshInterval: (latest) => (isFinalForVisitor(latest) ? 0 : 60_000),
    revalidateOnFocus: false,
    revalidateOnMount: !isFinalForVisitor(cachedState),
  })
  const [phase, setPhase] = useState<DrawPhase>('idle')
  const [freshWinner, setFreshWinner] = useState<ViceWinner | null>(null)
  const [drawError, setDrawError] = useState<string | null>(null)

  const winner = phase === 'rolling' || phase === 'wasted' ? null : (freshWinner ?? stats?.winner ?? null)
  const finished = remaining === 0 || Boolean(winner)
  const busy = phase === 'rolling' || phase === 'wasted'

  const draw = async () => {
    setDrawError(null)
    setPhase('rolling')
    try {
      const [response] = await Promise.all([fetch('/api/vice/draw', { method: 'POST' }), wait(MIN_ROLL_MS)])
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Losowanie nie powiodło się.')
      setFreshWinner(body.winner)
      setPhase('wasted')
      await wait(WASTED_MS)
      setPhase('reveal')
      mutate()
    } catch (error) {
      setDrawError(error instanceof Error ? error.message : 'Losowanie nie powiodło się.')
      setPhase('idle')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent
        showCloseButton={false}
        className="left-0 top-0 block h-dvh w-screen max-w-none translate-none gap-0 overflow-y-auto overflow-x-hidden overscroll-contain rounded-none border-0 bg-[#12061a] p-0 text-white sm:max-w-none"
      >
        <SirenLights />
        {phase === 'wasted' && <WastedOverlay />}

        <div className="fixed right-3 top-5 z-10 flex gap-2 sm:right-5 sm:top-6">
          <button
            type="button"
            onClick={toggle}
            aria-pressed={!muted}
            className="grid size-10 place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/25 backdrop-blur-sm transition-colors hover:bg-black/75"
          >
            {muted ? <VolumeX className="size-5" aria-hidden="true" /> : <Volume2 className="size-5" aria-hidden="true" />}
            <span className="sr-only">{muted ? 'Włącz muzykę' : 'Wyłącz muzykę'}</span>
          </button>
          <DialogClose className="grid size-10 place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/25 backdrop-blur-sm transition-colors hover:bg-black/75">
            <X className="size-5" aria-hidden="true" />
            <span className="sr-only">Zamknij</span>
          </DialogClose>
        </div>

        <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center gap-5 px-4 pb-10 pt-20 text-center sm:gap-7 sm:px-5 sm:pb-12 sm:pt-24">
          <header className="mt-auto flex flex-col items-center gap-2">
            <div className="flex gap-1.5" aria-hidden="true">
              {Array.from({ length: 5 }, (_, index) => (
                <Star key={index} className="gta-star-flash size-5 fill-white text-black sm:size-6" />
              ))}
            </div>
            <p className="font-[family-name:var(--font-kaushan)] text-[2.75rem] leading-none text-white drop-shadow-[0_4px_0_#c2185b] sm:text-8xl">Yummy City</p>
            <p className="text-[11px] font-black uppercase tracking-[0.4em] text-[#4dd0e1]">Losowanie GTA VI</p>
          </header>

          <div className="flex flex-col items-center gap-2">
            <DialogTitle className="text-balance bg-gradient-to-r from-[#ff6fa8] via-[#ff8a3d] to-[#ffd166] bg-clip-text px-2 text-4xl font-black uppercase italic leading-none tracking-tight text-transparent sm:text-6xl">
              {busy ? 'Losujemy…' : winner ? 'Mamy zwycięzcę!' : finished ? 'Wyniki już są!' : 'Dziś o 15:00'}
            </DialogTitle>
            <DialogDescription className="max-w-xs text-pretty text-sm leading-relaxed text-white/75">
              {winner
                ? 'Gratulacje! Skontaktujemy się ze zwycięzcą mailowo lub telefonicznie.'
                : finished
                  ? 'Losowanie się odbyło. Zwycięzcę powiadomimy przez Yummy Club lub telefonicznie.'
                  : 'Losujemy zwycięzcę spośród wszystkich, którzy kupili VICE Zestaw.'}
            </DialogDescription>
          </div>

          {phase === 'rolling' && <NameRoller names={stats?.names ?? []} />}
          {winner && <WinnerIdCard winner={winner} animate={phase === 'reveal'} />}

          {!finished && !busy && (
            <div role="timer" aria-live="off" aria-label="Czas do losowania" className="grid w-full grid-cols-3 gap-3">
              <Digit value={parts?.hours ?? 0} label="Godz." />
              <Digit value={parts?.minutes ?? 0} label="Min." />
              <Digit value={parts?.seconds ?? 0} label="Sek." />
            </div>
          )}

          <div className="flex w-full flex-col gap-3 sm:flex-row">
            <Stat icon={<Users className="size-5" aria-hidden="true" />} value={stats?.participants ?? null} label="Uczestników" />
            <Stat icon={<Ticket className="size-5" aria-hidden="true" />} value={stats?.tickets ?? null} label="Losów w puli" />
          </div>

          {stats?.canDraw && !busy && (
            <div className="flex w-full flex-col items-center gap-2">
              <DrawButton hasWinner={Boolean(winner)} disabled={!stats.tickets} onDraw={draw} />
              {drawError && <p role="alert" className="text-sm font-bold text-[#ff6b6b]">{drawError}</p>}
            </div>
          )}

          <p className="mb-auto text-[11px] font-bold uppercase tracking-[0.25em] text-white/55">1 VICE Zestaw = 1 los</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
