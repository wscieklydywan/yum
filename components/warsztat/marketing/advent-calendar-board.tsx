'use client'

import { AlertTriangle, ChevronLeft, ChevronRight, Gift, Percent, Sparkles, Star, UtensilsCrossed } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AdventKind } from '@/lib/advent'
import { TILE_SWATCH, type DayDraft } from './advent-day-editor'

const KIND_ICON: Record<AdventKind, typeof Star> = { stars: Star, food: UtensilsCrossed, discount: Percent, none: Sparkles }

function tileValue(day: DayDraft) {
  if (day.kind === 'stars') return `${Number(day.stars) || 0} Stars`
  if (day.kind === 'discount') return `-${day.discount_value || 0}${day.discount_type === 'percent' ? '%' : ' zł'}`
  if (day.kind === 'food') return day.items.length ? day.items.map((item) => item.name).join(', ') : 'Brak pozycji'
  return 'Życzenia'
}

export function AdventCalendarBoard({
  days,
  selected,
  onSelect,
  dateLabel,
  issues,
  todayIndex,
}: {
  days: DayDraft[]
  selected: number
  onSelect: (index: number) => void
  dateLabel: (index: number) => string
  issues: (string | null)[]
  todayIndex: number | null
}) {
  return (
    <div className="min-w-0 rounded-3xl bg-[#2a0608] p-3 shadow-inner sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2 text-white">
        <p className="inline-flex items-center gap-2 text-sm font-black">
          <Gift className="size-4 text-[#f2c14e]" aria-hidden="true" />
          Podgląd kalendarza
        </p>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Poprzedni dzień" disabled={selected === 0} onClick={() => onSelect(selected - 1)} className="grid size-8 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <span className="min-w-16 text-center text-xs font-bold tabular-nums text-white/80">
            {selected + 1} / {days.length}
          </span>
          <button type="button" aria-label="Następny dzień" disabled={selected === days.length - 1} onClick={() => onSelect(selected + 1)} className="grid size-8 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30">
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <ol aria-label="Okienka kalendarza" className="grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-2.5">
        {days.map((day, index) => {
          const Icon = KIND_ICON[day.kind]
          const issue = issues[index]
          const active = index === selected
          return (
            <li key={index}>
              <button
                type="button"
                aria-pressed={active}
                aria-label={`Dzień ${index + 1}, ${dateLabel(index)}: ${day.title || tileValue(day)}${issue ? ` – ${issue}` : ''}`}
                onClick={() => onSelect(index)}
                className={cn(
                  'relative flex aspect-square w-full flex-col justify-between overflow-hidden rounded-xl p-1.5 text-left transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c14e] sm:p-2',
                  TILE_SWATCH[day.color],
                  day.color === 'gold' ? 'text-[#3a1306]' : 'text-white',
                  active ? 'scale-[1.04] ring-2 ring-[#f2c14e] ring-offset-2 ring-offset-[#2a0608]' : 'hover:-translate-y-0.5',
                )}
              >
                <span className="flex items-start justify-between gap-1">
                  <span className="text-lg font-black leading-none sm:text-2xl">{index + 1}</span>
                  {issue ? <AlertTriangle className="size-3.5 shrink-0 text-amber-300 drop-shadow" aria-hidden="true" /> : <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden="true" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[9px] font-bold leading-tight opacity-90 sm:text-[11px]">{tileValue(day)}</span>
                  <span className="block truncate text-[8px] font-semibold uppercase tracking-wide opacity-70 sm:text-[9px]">{dateLabel(index)}</span>
                </span>
                {todayIndex === index && <span className="absolute bottom-0 left-0 right-0 h-1 bg-[#f2c14e]" aria-hidden="true" />}
              </button>
            </li>
          )
        })}
      </ol>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/70">
        <span className="inline-flex items-center gap-1"><Star className="size-3" aria-hidden="true" />Stars</span>
        <span className="inline-flex items-center gap-1"><UtensilsCrossed className="size-3" aria-hidden="true" />Jedzenie</span>
        <span className="inline-flex items-center gap-1"><Percent className="size-3" aria-hidden="true" />Rabat</span>
        <span className="inline-flex items-center gap-1"><Sparkles className="size-3" aria-hidden="true" />Życzenia</span>
        <span className="inline-flex items-center gap-1"><AlertTriangle className="size-3 text-amber-300" aria-hidden="true" />Do poprawy</span>
      </p>
    </div>
  )
}
