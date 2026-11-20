'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Gift, Loader2, Lock, Sparkles, Star, TreePine, X } from 'lucide-react'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  adventDateLabel,
  adventDefaultColor,
  isAdventColor,
  isAdventVisible,
  openAdventWindow,
  useAdventCalendar,
  type AdventCalendar,
  type AdventOpenResult,
  type AdventWindow,
} from '@/lib/advent'
import { cn } from '@/lib/utils'
import { Bauble, FestiveLogo, GiftBox, SantaHat, SnowCap, SnowDrift, Snowfall, StringLights } from './christmas-decor'

const tileTone = (window: AdventWindow) => (isAdventColor(window.color) ? window.color : adventDefaultColor(window.day))

type TileState = 'locked' | 'openable' | 'claimed' | 'missed'

const tileState = (window: AdventWindow): TileState =>
  window.claimed ? 'claimed' : window.openable ? 'openable' : window.missed ? 'missed' : 'locked'

/** Czy klient może już otwierać okienka (tryb „włączony” i data startu minęła). */
const isRunning = (data: AdventCalendar) => data.mode === 'live' && data.started && !data.ended

function AdventTile({ window, dateLabel, active, onSelect }: { window: AdventWindow; dateLabel: string; active: boolean; onSelect: () => void }) {
  const state = tileState(window)
  const tone = state === 'claimed' ? 'gold' : tileTone(window)
  const status = state === 'claimed' ? `otwarte: ${window.title ?? 'nagroda'}` : state === 'openable' ? 'można otworzyć' : state === 'missed' ? 'minęło' : 'jeszcze zamknięte'
  return (
    <li className="pt-2">
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Okienko ${dateLabel} – ${status}`}
        className={cn(
          'advent-tile group relative flex aspect-square w-full flex-col items-center justify-center rounded-2xl text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c14e] focus-visible:ring-offset-2 focus-visible:ring-offset-[#2a0608]',
          `advent-tile-${tone}`,
          active && state !== 'openable' && 'advent-tile-shake ring-2 ring-[#f2c14e]',
          state === 'openable' && 'ring-2 ring-[#f2c14e] shadow-[0_0_22px_rgba(242,193,78,0.65)] motion-safe:animate-pulse',
          state === 'missed' && 'opacity-45 saturate-50',
        )}
      >
        {window.day % 3 === 0 && state !== 'claimed' && (
          <span aria-hidden="true" className="absolute bottom-0 left-1/2 top-[14%] w-1.5 -translate-x-1/2 bg-gradient-to-r from-[#c9952c] via-[#f7d77c] to-[#c9952c] opacity-90 sm:w-2" />
        )}
        <SnowCap variant={(window.day * 7) % 3} className="-top-1 left-[-2%] h-[30%] w-[104%]" />
        <span
          className={cn(
            'relative mt-1 text-xl font-black italic tabular-nums [text-shadow:0_2px_0_rgba(0,0,0,0.35)] sm:text-3xl',
            tone === 'gold' && 'text-[#4a2a05] [text-shadow:0_1px_0_rgba(255,255,255,0.45)]',
          )}
        >
          {window.day}
        </span>
        {state === 'claimed' ? (
          <Check className="relative mt-0.5 size-3 text-[#4a2a05]/80 sm:size-4" aria-hidden="true" />
        ) : state === 'openable' ? (
          <Gift className="relative mt-0.5 size-3 text-white sm:size-4" aria-hidden="true" />
        ) : (
          <Lock className={cn('relative mt-0.5 size-3 sm:size-4', tone === 'gold' ? 'text-[#4a2a05]/70' : 'text-white/70')} aria-hidden="true" />
        )}
      </button>
    </li>
  )
}

function RewardCard({ result }: { result: AdventOpenResult }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-primary text-white shadow-inner">
        {result.kind === 'stars' ? <Star className="size-5" aria-hidden="true" /> : <Gift className="size-5" aria-hidden="true" />}
      </span>
      <p className="text-base font-black text-[#3a1306] sm:text-lg">{result.title}</p>
      {result.description && <p className="text-[12px] leading-relaxed text-[#3a1306]/75 sm:text-sm">{result.description}</p>}
      {result.code && (
        <p className="mt-1 rounded-xl border-2 border-dashed border-primary/50 bg-white px-4 py-2 font-mono text-lg font-black tracking-widest text-primary">{result.code}</p>
      )}
      {result.code && result.expires_at && (
        <p className="text-[11px] text-[#3a1306]/60">
          Ważny do {new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long' }).format(new Date(result.expires_at))} · znajdziesz go też w Yummy Club w zakładce kuponów
        </p>
      )}
      {result.kind === 'stars' && <p className="text-[11px] text-[#3a1306]/60">Masz teraz {result.points} Stars</p>}
    </div>
  )
}

function StatusPanel({ data, selected, result, opening, error, onOpen }: {
  data: AdventCalendar
  selected: AdventWindow | null
  result: AdventOpenResult | null
  opening: boolean
  error: string | null
  onOpen: (day: number) => void
}) {
  const startLabel = adventDateLabel(data.starts_on)
  if (result) return <RewardCard result={result} />

  if (!isRunning(data)) {
    if (data.mode === 'live' && data.ended) {
      return <p className="text-center text-[13px] font-semibold sm:text-base">Kalendarz na ten rok już się zakończył. Dziękujemy, że byliście z nami!</p>
    }
    return (
      <>
        <p aria-live="polite" className="text-center text-[13px] font-semibold sm:text-base">
          {selected ? (
            <>
              Okienko <strong className="text-primary">{adventDateLabel(data.starts_on, selected.day - 1)}</strong> jeszcze zamknięte – cierpliwości!
            </>
          ) : (
            `Okienka otworzą się ${startLabel}`
          )}
        </p>
        <p className="mt-1.5 text-center text-[11px] leading-relaxed text-[#3a1306]/70 sm:text-sm">
          Nagrody odbierzesz w <strong className="text-[#3a1306]">Yummy Club</strong> – załóż konto już teraz, żeby nic Cię nie ominęło.
        </p>
      </>
    )
  }

  if (!selected) {
    const todayOpenable = data.windows.find((window) => window.openable)
    return (
      <p className="text-center text-[13px] font-semibold sm:text-base">
        {todayOpenable ? 'Świecące okienko czeka na Ciebie – kliknij, żeby otworzyć!' : 'Na dziś to wszystko. Wróć jutro po kolejne okienko!'}
      </p>
    )
  }

  if (selected.claimed) {
    return (
      <div className="text-center">
        <p className="text-[13px] font-semibold sm:text-base">
          Okienko {adventDateLabel(data.starts_on, selected.day - 1)}: <strong className="text-primary">{selected.title}</strong>
        </p>
        {selected.code && <p className="mt-1.5 font-mono text-base font-black tracking-widest text-primary">{selected.code}</p>}
      </div>
    )
  }

  if (selected.openable) {
    if (!data.logged_in) {
      return (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-[13px] font-semibold sm:text-base">Zaloguj się do Yummy Club, żeby otworzyć okienko i odebrać nagrodę.</p>
          <Link href="/yummy-club" className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-bold text-white">
            Przejdź do Yummy Club
          </Link>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-[13px] font-semibold sm:text-base">Okienko {adventDateLabel(data.starts_on, selected.day - 1)} jest gotowe!</p>
        <button
          type="button"
          disabled={opening}
          onClick={() => onOpen(selected.day)}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-white shadow-[0_4px_0_#7a0d09] transition-transform hover:-translate-y-0.5 disabled:opacity-70"
        >
          {opening ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Gift className="size-4" aria-hidden="true" />}
          Otwórz okienko
        </button>
        {error && <p role="alert" className="text-xs font-semibold text-primary">{error}</p>}
      </div>
    )
  }

  return (
    <p aria-live="polite" className="text-center text-[13px] font-semibold sm:text-base">
      {selected.missed ? 'To okienko już minęło. Wróć jutro po kolejne!' : (
        <>
          Okienko <strong className="text-primary">{adventDateLabel(data.starts_on, selected.day - 1)}</strong> jeszcze zamknięte – cierpliwości!
        </>
      )}
    </p>
  )
}

export function AdventCalendarDialog({ open, onOpenChange, onPointsChange }: { open: boolean; onOpenChange: (open: boolean) => void; onPointsChange?: (points: number) => void }) {
  const { data, mutate } = useAdventCalendar()
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [result, setResult] = useState<AdventOpenResult | null>(null)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isAdventVisible(data)) return null

  const startLabel = adventDateLabel(data.starts_on)
  const selected = data.windows.find((window) => window.day === selectedDay) ?? null
  const running = isRunning(data)

  function select(day: number) {
    setSelectedDay(day)
    setResult(null)
    setError(null)
  }

  async function openWindow(day: number) {
    setOpening(true)
    setError(null)
    try {
      const opened = await openAdventWindow(day)
      setResult(opened)
      onPointsChange?.(opened.points)
      await mutate()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się otworzyć okienka.')
      await mutate()
    } finally {
      setOpening(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) {
          setSelectedDay(null)
          setResult(null)
          setError(null)
        }
      }}
    >
      <DialogContent
        data-keep-size
        showCloseButton={false}
        overlayClassName="bg-black/70"
        className="inset-0 top-0 left-0 block h-dvh w-full max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none bg-[#2a0608] p-0 text-white ring-0 sm:max-w-none data-open:zoom-in-100 data-closed:zoom-out-100"
      >
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#7a1418_0%,#4a0b0f_40%,#22050a_100%)]" />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_30%,rgba(242,193,78,0.18),transparent_35%),radial-gradient(circle_at_80%_60%,rgba(242,193,78,0.12),transparent_40%)]"
        />
        <Snowfall className="[--fall:105dvh]" />

        <div className="absolute inset-0 overflow-y-auto overscroll-contain">
          <div className="relative mx-auto flex min-h-full w-full max-w-lg flex-col items-center px-7 pb-16 pt-24 sm:max-w-3xl sm:px-8 sm:pb-28 sm:pt-32">
            <FestiveLogo className="h-8 sm:h-14" />

            <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#f2c14e]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#f2c14e] ring-1 ring-[#f2c14e]/35 sm:text-xs">
              <Sparkles className="size-3" aria-hidden="true" />
              {running ? `Dziś ${adventDateLabel(data.starts_on, data.today - 1)}` : data.mode === 'live' && data.ended ? 'Zakończony' : `Startuje ${startLabel}`}
            </p>

            <DialogTitle className="mt-3 text-center text-[1.85rem] font-black leading-[0.95] tracking-tight text-white [text-shadow:0_0_24px_rgba(255,120,90,0.55),0_3px_0_#5c0a0e] sm:text-6xl">
              Kalendarz <span className="block text-[#f2c14e] [text-shadow:0_0_22px_rgba(242,193,78,0.55),0_3px_0_#5c3a05]">Adwentowy</span>
            </DialogTitle>
            <DialogDescription className="mt-2.5 max-w-[17rem] text-center text-[13px] leading-relaxed text-white/80 sm:max-w-sm sm:text-base">
              {data.teaser_text || `${data.days} dni, ${data.days} niespodzianki. Od ${startLabel} codziennie otworzysz jedno okienko.`}
            </DialogDescription>

            <div aria-hidden="true" className="my-4 flex w-full max-w-[14rem] items-center gap-3 sm:my-5 sm:max-w-xs">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#f2c14e]/60" />
              <Gift className="size-4 text-[#f2c14e]" />
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#f2c14e]/60" />
            </div>

            <ol aria-label="Okienka kalendarza" className="grid w-full max-w-[18.5rem] grid-cols-4 gap-x-2.5 gap-y-3 [perspective:800px] sm:max-w-none sm:grid-cols-6 sm:gap-x-4 sm:gap-y-5">
              {data.windows.map((window) => (
                <AdventTile
                  key={window.day}
                  window={window}
                  dateLabel={adventDateLabel(data.starts_on, window.day - 1)}
                  active={selectedDay === window.day}
                  onSelect={() => select(window.day)}
                />
              ))}
            </ol>

            <div className="relative mt-7 w-full max-w-[18.5rem] rounded-2xl bg-[linear-gradient(180deg,#fff8e8,#f4e3c0)] px-4 pb-3.5 pt-5 text-[#3a1306] shadow-[0_10px_30px_rgba(0,0,0,0.45),inset_0_-3px_0_rgba(0,0,0,0.08)] sm:mt-8 sm:max-w-none sm:px-6 sm:pb-4">
              <SnowCap variant={1} className="-top-2.5 left-[-1.5%] h-6 w-[103%]" />
              <div aria-live="polite">
                <StatusPanel data={data} selected={selected} result={result} opening={opening} error={error} onOpen={(day) => void openWindow(day)} />
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10">
          <SnowDrift position="top" className="h-11 sm:h-16" />
          <StringLights bulbs={14} className="-mt-3 hidden sm:block" />
          <StringLights bulbs={8} className="-mt-3 sm:hidden" />
          <Bauble color="#d71f16" length={30} size={18} className="left-[5%] sm:left-[8%]" delay={-0.4} />
          <Bauble color="#f2c14e" length={48} size={15} className="left-[16%] hidden min-[380px]:flex sm:left-[16%]" delay={-1.3} />
          <Bauble color="#1f7a4c" length={40} size={17} className="right-[16%] sm:right-[16%]" delay={-0.8} />
          <Bauble color="#d71f16" length={26} size={18} className="right-[5%] hidden sm:right-[8%] sm:flex" delay={-2} />
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
          <GiftBox box="#d71f16" ribbon="#f2c14e" size={46} className="bottom-6 left-10 hidden scale-125 sm:block" />
          <GiftBox box="#1f7a4c" ribbon="#f7e7c4" size={32} className="bottom-5 left-28 hidden sm:block" />
          <GiftBox box="#f2c14e" ribbon="#d71f16" size={40} className="bottom-6 right-12 hidden scale-125 sm:block" />
          <SnowDrift position="bottom" className="relative h-6 sm:h-11" />
        </div>

        <DialogClose
          aria-label="Zamknij kalendarz"
          className="absolute right-3 top-3 z-20 grid size-11 place-items-center rounded-full bg-[#2a0608]/80 text-white shadow-lg ring-1 ring-white/30 transition-colors hover:bg-[#2a0608] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c14e] sm:right-5 sm:top-4"
        >
          <X className="size-5" aria-hidden="true" />
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}

/** Krótki podpis pod nazwą: „Od 1 grudnia”, „Dziś okienko 5” albo „Zakończony”. */
export function useAdventBadge() {
  const { data } = useAdventCalendar()
  if (!isAdventVisible(data)) return { data: undefined, badge: '' }
  const openableToday = data.windows.some((window) => window.openable)
  const badge = isRunning(data)
    ? openableToday ? `Okienko ${data.today} czeka!` : `Dziś ${adventDateLabel(data.starts_on, data.today - 1)}`
    : data.mode === 'live' && data.ended ? 'Zakończony' : `Od ${adventDateLabel(data.starts_on)}`
  return { data, badge, openableToday }
}

export function AdventCalendarBanner({ className, onPointsChange }: { className?: string; onPointsChange?: (points: number) => void }) {
  const [open, setOpen] = useState(false)
  const { data, badge } = useAdventBadge()
  if (!data || !data.show_club_banner || (data.mode === 'live' && data.ended)) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn(
          'group relative isolate flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-[#7a0f14] via-[#5a0a0e] to-[#2a0608] p-3 pr-3.5 text-left text-white shadow-[0_10px_26px_-10px_rgba(90,10,14,0.55)] ring-1 ring-[#f2c14e]/30 transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c14e] sm:gap-4 sm:rounded-3xl sm:p-4',
          className,
        )}
      >
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(80%_120%_at_100%_0%,rgba(242,193,78,0.22),transparent_60%)]" />
        <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-primary shadow-inner sm:size-14">
          <Gift className="size-6 motion-safe:animate-[advent-wiggle_2.6s_ease-in-out_infinite] sm:size-7" aria-hidden="true" />
          <SantaHat className="absolute -left-1.5 -top-3 w-7 -rotate-[22deg] sm:w-8" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f2c14e]">{badge}</span>
          <span className="block text-sm font-black leading-tight text-balance sm:text-lg">Kalendarz adwentowy</span>
          <span className="block truncate text-xs text-white/70">{data.days} dni, {data.days} niespodzianki</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <TreePine className="size-9 text-[#3f9a5b] drop-shadow-[0_0_10px_rgba(242,193,78,0.35)] sm:hidden" strokeWidth={2} aria-hidden="true" />
          <span className="sr-only sm:not-sr-only sm:inline-flex sm:h-10 sm:items-center sm:gap-1.5 sm:rounded-full sm:bg-[#f2c14e] sm:px-4 sm:text-sm sm:font-bold sm:text-[#3a1306]">
            <TreePine className="hidden size-4 sm:block" aria-hidden="true" />
            {isRunning(data) ? 'Otwórz' : 'Zajrzyj'}
          </span>
        </span>
      </button>
      <AdventCalendarDialog open={open} onOpenChange={setOpen} onPointsChange={onPointsChange} />
    </>
  )
}

export function AdventCalendarBubble() {
  const [open, setOpen] = useState(false)
  const { data, badge, openableToday } = useAdventBadge()
  if (!data || !data.show_bubble || (data.mode === 'live' && data.ended)) return null

  return (
    <>
      {/* Own compositor layer: without it Firefox repaints the fixed bubble on every scroll frame, which shows up as jitter. */}
      <div className="advent-bubble-layer fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 sm:bottom-6 sm:right-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Kalendarz adwentowy – ${badge}`}
          className="group relative flex items-center gap-2 rounded-full bg-[#2a0608] p-1.5 text-white shadow-[0_6px_18px_-4px_rgba(0,0,0,0.35)] ring-1 ring-[#f2c14e]/40 transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c14e] sm:pr-4"
        >
          <span className="relative grid size-10 place-items-center rounded-full bg-primary">
            <Gift className="size-5 motion-safe:animate-[advent-wiggle_2.6s_ease-in-out_infinite]" aria-hidden="true" />
            <SantaHat className="absolute -left-1.5 -top-3 w-6 -rotate-[22deg]" />
          </span>
          {openableToday && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-[#f2c14e] ring-2 ring-[#2a0608] sm:left-9 sm:right-auto" />}
          <span className="hidden flex-col text-left leading-tight sm:flex">
            <span className="text-xs font-black uppercase tracking-wide">Kalendarz adwentowy</span>
            <span className="text-[11px] font-semibold text-[#f2c14e]">{badge}</span>
          </span>
        </button>
      </div>
      <AdventCalendarDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
