import { CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { scheduledLeadMinutes, type KitchenOrder } from './order-data'

const SOON_SECONDS = 15 * 60
const timeZone = 'Europe/Warsaw'

export const formatClock = (value: number | string) => new Date(value).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone })
const dayKey = (value: number) => new Date(value).toLocaleDateString('pl-PL', { timeZone })

export function formatCountdown(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} min`
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

export function scheduledLabel(scheduledFor: string, now: number | null) {
  const target = Date.parse(scheduledFor)
  const reference = now ?? target
  const tomorrow = dayKey(reference + 86_400_000) === dayKey(target)
  const day = dayKey(reference) === dayKey(target) ? '' : tomorrow ? 'jutro ' : `${new Date(target).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', timeZone })} `
  return `${day}${formatClock(target)}`
}

type Props = { order: KitchenOrder; now: number | null; variant?: 'compact' | 'large' }

/** Green countdown for orders placed for a specific time; turns amber close to the deadline and red once it has passed. */
export function ScheduledCountdown({ order, now, variant = 'compact' }: Props) {
  if (!order.scheduledFor) return null
  const target = Date.parse(order.scheduledFor)
  if (!Number.isFinite(target)) return null
  const active = order.status === 'new' || order.status === 'preparing' || order.status === 'ready'
  const seconds = active && now !== null ? Math.round((target - now) / 1000) : null
  const state = seconds === null ? 'static' : seconds < 0 ? 'late' : seconds <= SOON_SECONDS ? 'soon' : 'upcoming'
  const countdown = seconds === null ? null : seconds < 0 ? `po czasie ${formatCountdown(-seconds)}` : `za ${formatCountdown(seconds)}`
  const lead = scheduledLeadMinutes(order)
  const startAt = target - lead * 60_000
  const kitchenHint = variant === 'large' && seconds !== null && order.status !== 'ready'
    ? now !== null && now < startAt ? `Zacznij ok. ${formatClock(startAt)}` : seconds >= 0 ? 'Zacznij teraz' : null
    : null

  const tone = {
    upcoming: 'bg-emerald-600 text-white',
    soon: 'bg-amber-500 text-white',
    late: 'bg-red-600 text-white',
    static: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200',
  }[state]

  if (variant === 'large') {
    return <div role="timer" aria-label={`Zamówienie na godzinę ${scheduledLabel(order.scheduledFor, now)}${countdown ? `, ${countdown}` : ''}`} className={cn('flex items-center gap-3 rounded-xl px-3.5 py-2.5', tone)}>
      <CalendarClock className="size-6 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider opacity-85">Na godzinę</p>
        <p className="text-xl font-black leading-tight tabular-nums">{scheduledLabel(order.scheduledFor, now)}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        {countdown && <p className={cn('font-mono text-lg font-black tabular-nums', state === 'late' && 'animate-pulse')}>{countdown}</p>}
        {kitchenHint && <p className="text-[11px] font-bold opacity-90">{kitchenHint}</p>}
      </div>
    </div>
  }

  return <div role="timer" aria-label={`Zamówienie na godzinę ${scheduledLabel(order.scheduledFor, now)}${countdown ? `, ${countdown}` : ''}`} className={cn('flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold', tone)}>
    <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
    <span className="flex-1 truncate">Na {scheduledLabel(order.scheduledFor, now)}</span>
    {countdown && <span className={cn('shrink-0 font-mono tabular-nums', state === 'late' && 'animate-pulse')}>{countdown}</span>}
  </div>
}
