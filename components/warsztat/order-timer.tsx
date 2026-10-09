import { Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KitchenOrder } from './order-data'

export function elapsedSeconds(receivedAt: string | undefined, now: number | null, endedAt?: string) {
  if (!receivedAt || now === null) return null
  const start = Date.parse(receivedAt)
  const end = endedAt ? Date.parse(endedAt) : now
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  return Math.max(0, Math.floor((end - start) / 1000))
}

export function formatElapsed(seconds: number | null) {
  if (seconds === null) return '—:—'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  return `${hours > 0 ? `${hours}:` : ''}${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

export function OrderTimer({ order, now }: { order: KitchenOrder; now: number | null }) {
  const seconds = elapsedSeconds(order.receivedAt, now, order.handedOffAt)
  const level = order.handedOff ? 'complete' : seconds !== null && seconds >= 1200 ? 'late' : seconds !== null && seconds >= 600 ? 'warning' : 'normal'
  return (
    <div className={cn('order-timer flex items-center justify-between gap-2 rounded-lg px-3 py-2', `timer-${level}`)}>
      <span className="flex items-center gap-1.5 text-[11px] font-medium"><Timer className="size-3.5 shrink-0" aria-hidden="true" />{order.handedOff ? 'Czas do wydania' : 'Od przyjęcia'}</span>
      <span role="timer" aria-live="off" aria-label={order.handedOff ? 'Czas od przyjęcia do wydania' : 'Czas od przyjęcia zamówienia'} className="font-mono text-lg font-bold leading-none tracking-tight tabular-nums">{formatElapsed(seconds)}</span>
    </div>
  )
}
