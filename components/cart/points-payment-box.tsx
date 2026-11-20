'use client'

import { Minus, Plus, Star, X } from 'lucide-react'
import { formatPrice } from '@/lib/menu'
import { starsLabel, type PublicPointsPayment } from '@/lib/points-payment'
import { cn } from '@/lib/utils'

export function PointsPaymentBox({
  settings,
  used,
  max,
  discount,
  onChange,
}: {
  settings: PublicPointsPayment
  used: number
  max: number
  discount: number
  onChange: (points: number) => void
}) {
  const balance = settings.balance ?? 0
  const active = used > 0
  const step = (delta: number) => onChange(Math.max(0, Math.min(max, used + delta)))

  return (
    <section
      aria-labelledby="points-payment-title"
      className={cn('mt-2 rounded-lg px-2.5 py-2', active ? 'bg-primary/10' : 'border border-dashed border-foreground/25')}
    >
      <div className="flex items-center gap-2">
        <Star className={cn('size-3.5 shrink-0', active ? 'fill-current text-primary' : 'text-muted-foreground')} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p id="points-payment-title" className={cn('text-xs font-bold', active && 'text-primary')}>Zapłać Stars</p>
          <p className="truncate text-[11px] text-muted-foreground">
            Masz <strong className="font-semibold tabular-nums text-foreground">{balance} {starsLabel(balance)}</strong> · 1 Star = {formatPrice(settings.value)}
          </p>
        </div>
        {active ? (
          <button type="button" onClick={() => onChange(0)} className="grid size-7 shrink-0 place-items-center rounded-full hover:bg-background">
            <X className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Nie używaj Stars</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onChange(max)}
            disabled={max === 0}
            className="inline-flex h-7 shrink-0 items-center rounded-md bg-foreground px-3 text-xs font-semibold text-background disabled:opacity-30"
          >
            Użyj
          </button>
        )}
      </div>

      {active && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1" role="group" aria-label="Liczba Stars do użycia">
            <button type="button" onClick={() => step(-1)} disabled={used <= 0} className="grid size-7 place-items-center rounded-full bg-background ring-1 ring-border disabled:opacity-30">
              <Minus className="size-3" aria-hidden="true" />
              <span className="sr-only">Mniej Stars</span>
            </button>
            <span className="min-w-12 text-center font-mono text-xs font-bold tabular-nums" aria-live="polite">
              {used} / {max}
            </span>
            <button type="button" onClick={() => step(1)} disabled={used >= max} className="grid size-7 place-items-center rounded-full bg-background ring-1 ring-border disabled:opacity-30">
              <Plus className="size-3" aria-hidden="true" />
              <span className="sr-only">Więcej Stars</span>
            </button>
            {used < max && (
              <button type="button" onClick={() => onChange(max)} className="ml-1 rounded-md px-2 py-1 text-[11px] font-semibold text-primary hover:bg-background">
                Maks.
              </button>
            )}
          </div>
          <span className="font-mono text-xs font-bold tabular-nums text-primary">−{formatPrice(discount)}</span>
        </div>
      )}

      {!active && max === 0 && (
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          {balance < 1 ? 'Zbieraj Stars przy każdym zamówieniu i płać nimi w koszyku.' : `Zamówienie jest za małe, by użyć Stars (1 Star = ${formatPrice(settings.value)}).`}
        </p>
      )}
    </section>
  )
}
