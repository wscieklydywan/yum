'use client'

import { useMemo, useState } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DEFAULT_HOURS, orderingCutoff, type DayHours } from '@/lib/restaurant-status'

const SLOT_MINUTES = 15
const toMinutes = (value: string) => {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}
const clock = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
const weekdayIndex = (date: Date) => (date.getDay() + 6) % 7

function slotsFor(day: Date, hours: DayHours | undefined, earliest: Date, closeBeforeMinutes: number) {
  if (!hours || hours.closed) return []
  const open = toMinutes(hours.open)
  const close = Math.min(24 * 60, orderingCutoff(hours, closeBeforeMinutes))
  const result: Date[] = []
  for (let minutes = Math.ceil(open / SLOT_MINUTES) * SLOT_MINUTES; minutes <= close - SLOT_MINUTES; minutes += SLOT_MINUTES) {
    const slot = new Date(day)
    slot.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
    if (slot >= earliest) result.push(slot)
  }
  return result
}

export function SchedulePicker({ openingHours, leadMinutes, closeBeforeMinutes = 0 }: { openingHours?: DayHours[]; leadMinutes: number; closeBeforeMinutes?: number }) {
  const hours = openingHours?.length === 7 ? openingHours : DEFAULT_HOURS
  const days = useMemo(() => {
    const now = new Date()
    const earliest = new Date(now.getTime() + leadMinutes * 60_000)
    return [0, 1, 2].map((offset) => {
      const day = new Date(now)
      day.setDate(now.getDate() + offset)
      day.setHours(0, 0, 0, 0)
      const label = offset === 0 ? 'Dziś' : offset === 1 ? 'Jutro' : day.toLocaleDateString('pl-PL', { weekday: 'long' })
      return { key: day.toDateString(), label, date: day.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }), slots: slotsFor(day, hours[weekdayIndex(day)], earliest, closeBeforeMinutes) }
    }).filter((day) => day.slots.length > 0)
  }, [hours, leadMinutes, closeBeforeMinutes])

  const [dayKey, setDayKey] = useState(days[0]?.key ?? '')
  const activeDay = days.find((day) => day.key === dayKey) ?? days[0]
  const [selected, setSelected] = useState<string>('')
  const selectedValid = activeDay?.slots.some((slot) => slot.toISOString() === selected)

  if (!activeDay) {
    return <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">W najbliższych dniach nie ma wolnych terminów. Wybierz „Jak najszybciej”.</p>
  }

  return (
    <div className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-border">
      <input type="hidden" name="scheduledFor" value={selectedValid ? selected : ''} />
      <div role="radiogroup" aria-label="Dzień" className="flex gap-2 overflow-x-auto">
        {days.map((day) => (
          <button
            key={day.key}
            type="button"
            role="radio"
            aria-checked={day.key === activeDay.key}
            onClick={() => { setDayKey(day.key); setSelected('') }}
            className={cn('flex min-w-20 flex-col items-center rounded-xl px-3 py-2 text-xs transition-colors', day.key === activeDay.key ? 'bg-foreground text-background' : 'bg-muted hover:bg-muted/70')}
          >
            <span className="font-bold capitalize">{day.label}</span>
            <span className="opacity-70">{day.date}</span>
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label="Godzina" className="grid max-h-48 grid-cols-4 gap-2 overflow-y-auto pr-1">
        {activeDay.slots.map((slot) => {
          const value = slot.toISOString()
          const checked = value === selected
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => setSelected(value)}
              className={cn('h-10 rounded-lg text-sm font-semibold tabular-nums transition-colors', checked ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/70')}
            >
              {clock(slot.getHours() * 60 + slot.getMinutes())}
            </button>
          )
        })}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="size-3.5" aria-hidden="true" />
        {selectedValid ? `Wybrano: ${activeDay.label.toLowerCase()}, ${new Date(selected).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}` : 'Wybierz godzinę odbioru lub dostawy.'}
      </p>
    </div>
  )
}
