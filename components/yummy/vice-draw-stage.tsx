'use client'

import { useEffect, useState } from 'react'
import { Dices, Loader2, Star } from 'lucide-react'
import type { ViceWinner } from '@/lib/vice-draw'

export type DrawPhase = 'idle' | 'rolling' | 'wasted' | 'reveal'

/** Slot-machine name reel: starts fast and slows down while the server picks the winner. */
export function NameRoller({ names }: { names: string[] }) {
  const pool = names.length ? names : ['Gracz Yummy City']
  const [index, setIndex] = useState(0)

  useEffect(() => {
    let delay = 55
    let timeout: number
    const tick = () => {
      setIndex((value) => (value + 1) % pool.length)
      delay = Math.min(delay * 1.06, 260)
      timeout = window.setTimeout(tick, delay)
    }
    timeout = window.setTimeout(tick, delay)
    return () => window.clearTimeout(timeout)
  }, [pool.length])

  return (
    <div className="flex w-full flex-col items-center gap-3" role="status" aria-live="polite">
      <span className="sr-only">Trwa losowanie zwycięzcy…</span>
      <div className="relative w-full overflow-hidden rounded-2xl bg-black/60 py-6 ring-2 ring-[#ff6fa8]/70 shadow-[0_0_40px_rgba(255,111,168,0.45)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-black/80 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/80 to-transparent" />
        <p key={index} aria-hidden="true" className="vice-roll-tick truncate px-4 text-center text-3xl font-black uppercase italic tracking-tight text-white sm:text-4xl">
          {pool[index]}
        </p>
      </div>
      <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] text-[#4dd0e1]">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        Losowanie w toku
      </p>
    </div>
  )
}

/** GTA "WASTED"-style beat: the world drains to grey, five wanted stars slam in, then the headline hits. */
export function WastedOverlay() {
  return (
    <div aria-hidden="true" className="vice-wasted-backdrop fixed inset-0 z-30 flex flex-col items-center justify-center gap-6 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.85))]" />
      <div className="relative flex gap-2 sm:gap-3">
        {Array.from({ length: 5 }, (_, index) => (
          <Star
            key={index}
            style={{ animationDelay: `${index * 110}ms` }}
            className="vice-star-slam size-10 fill-white text-black drop-shadow-[0_0_14px_rgba(255,255,255,0.9)] sm:size-14"
          />
        ))}
      </div>
      <p className="vice-wasted-text relative font-black uppercase italic leading-none tracking-tight text-[#e8272c] [-webkit-text-stroke:1.5px_#000] [font-size:clamp(2.5rem,13vw,9rem)] sm:[-webkit-text-stroke:2px_#000] [text-shadow:0_6px_0_#000]">
        Wygrany
      </p>
    </div>
  )
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[9px] font-black uppercase tracking-[0.25em] text-[#12061a]/55">{label}</dt>
      <dd className="font-mono text-sm font-bold tabular-nums text-[#12061a]">{value}</dd>
    </div>
  )
}

/** Winner presented as a Vice City ID card. Contact details live only in the workshop "Losowanie" tab. */
export function WinnerIdCard({ winner, animate }: { winner: ViceWinner; animate: boolean }) {
  const odds = ((winner.tickets / winner.totalTickets) * 100).toLocaleString('pl-PL', { maximumFractionDigits: 1 })
  const drawnAt = new Date(winner.drawnAt).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <article
        aria-label={`Zwycięzca: ${winner.name}`}
        className={`${animate ? 'vice-id-card-in' : ''} relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#ffe3ef] via-[#fff4e0] to-[#d7f7fb] p-4 text-left shadow-[0_20px_60px_rgba(255,111,168,0.45)] ring-1 ring-white/60`}
      >
        <div className="vice-holo-sheen pointer-events-none absolute inset-0" aria-hidden="true" />

        <header className="relative flex items-center justify-between border-b border-[#12061a]/15 pb-2">
          <span className="font-[family-name:var(--font-kaushan)] text-2xl leading-none text-[#c2185b]">Yummy City</span>
          <span className="rounded bg-[#12061a] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.25em] text-[#ffd166]">Zwycięzca</span>
        </header>

        <div className="relative mt-3 flex gap-4">
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <span className="grid size-20 place-items-center rounded-lg bg-gradient-to-br from-[#ff6fa8] to-[#ff8a3d] text-3xl font-black text-white ring-2 ring-white">
              {initials(winner.name)}
            </span>
            <span className="flex gap-0.5" aria-label="5 gwiazdek">
              {Array.from({ length: 5 }, (_, index) => (
                <Star key={index} className="size-3 fill-[#12061a] text-[#12061a]" aria-hidden="true" />
              ))}
            </span>
          </div>
          <dl className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-col">
              <dt className="text-[9px] font-black uppercase tracking-[0.25em] text-[#12061a]/55">Imię</dt>
              <dd className="truncate text-xl font-black uppercase italic leading-tight text-[#12061a]">{winner.name}</dd>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Losy" value={`${winner.tickets}`} />
              <Field label="Szansa" value={`${odds}%`} />
              <Field label="Nr losu" value={`#${winner.ticketNumber}/${winner.totalTickets}`} />
              {winner.phoneHint && <Field label="Telefon" value={winner.phoneHint} />}
            </div>
          </dl>
        </div>

        <footer className="relative mt-3 flex items-end justify-between gap-3 border-t border-[#12061a]/15 pt-2">
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-[#12061a]/55">Wylosowano</span>
            <span className="font-mono text-xs font-bold text-[#12061a]">{drawnAt}</span>
          </div>
          <span aria-hidden="true" className="h-7 w-28 bg-[repeating-linear-gradient(90deg,#12061a_0px,#12061a_2px,transparent_2px,transparent_4px,#12061a_4px,#12061a_5px,transparent_5px,transparent_8px)]" />
        </footer>
      </article>
    </div>
  )
}

export function DrawButton({ hasWinner, disabled, onDraw }: { hasWinner: boolean; disabled: boolean; onDraw: () => void }) {
  const [confirming, setConfirming] = useState(false)

  if (hasWinner && !confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline"
      >
        Losuj ponownie
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        setConfirming(false)
        onDraw()
      }}
      className="vice-draw-button group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-[#ff1e3c] via-[#ff6fa8] to-[#2a6eff] px-6 py-4 text-xl font-black uppercase italic tracking-wide text-white shadow-[0_0_40px_rgba(255,111,168,0.55)] ring-2 ring-white/70 transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
    >
      <Dices className="size-6 transition-transform group-hover:rotate-12" aria-hidden="true" />
      {confirming ? 'Na pewno? Losuj nowego' : 'Losuj'}
    </button>
  )
}
