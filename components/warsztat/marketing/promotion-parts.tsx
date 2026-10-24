'use client'

import { cn } from '@/lib/utils'
import { isPromotionRunning, matchesSchedule, type Promotion } from '@/lib/promotions'

export type PromotionState = 'running' | 'waiting' | 'off'

export function promotionState(promotion: Promotion, now: Date): PromotionState {
  if (!promotion.active) return 'off'
  return isPromotionRunning(promotion, now) ? 'running' : 'waiting'
}

export function PromotionStatusBadge({ promotion, now, className }: { promotion: Promotion; now: Date; className?: string }) {
  const state = promotionState(promotion, now)
  const label = state === 'running' ? 'Trwa teraz' : state === 'waiting' ? (matchesSchedule(promotion, now) ? 'Włączona' : 'Włączona · czeka na termin') : 'Wyłączona'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold',
        state === 'running' && 'bg-emerald-50 text-emerald-700',
        state === 'waiting' && 'bg-amber-50 text-amber-700',
        state === 'off' && 'bg-[#f1efec] text-[#777068]',
        className,
      )}
    >
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', state === 'running' ? 'animate-pulse bg-emerald-500' : state === 'waiting' ? 'bg-amber-500' : 'bg-[#b3aba2]')} />
      {label}
    </span>
  )
}

export function PromotionSwitch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (next: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50',
        checked ? 'bg-emerald-500' : 'bg-[#d9d2ca]',
      )}
    >
      <span className={cn('inline-block size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
    </button>
  )
}
