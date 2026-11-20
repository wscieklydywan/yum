'use client'

import { useId, useState } from 'react'
import { ChevronDown, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { trackingStepIndex, trackingSteps } from '@/lib/customer-tracking-steps'
import type { KitchenOrder } from './order-data'

/** Lets the bar check which tracking stage the Yummy Club customer currently sees – no extra request. */
export function CustomerViewPreview({ order }: { order: KitchenOrder }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const current = trackingStepIndex({ status: order.status, type: order.type, out_for_delivery_at: order.outForDeliveryAt })
  if (!order.clubCustomer || current < 0) return null
  const steps = trackingSteps(order.type)

  return (
    <div data-no-select className="flex cursor-default flex-col">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex h-8 items-center gap-1.5 self-start rounded-md px-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Smartphone className="size-3.5" aria-hidden="true" />
        Klient widzi: <span className="font-bold text-foreground">{steps[current].label}</span>
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div id={panelId} className="mt-1 rounded-lg border border-border bg-muted/40 p-2.5">
          <ol className="flex items-center gap-1" aria-label="Etapy widoczne dla klienta">
            {steps.map((step, index) => (
              <li key={step.label} aria-current={index === current ? 'step' : undefined} className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
                <span
                  className={cn(
                    'h-1.5 w-full rounded-full',
                    index < current ? 'bg-emerald-500' : index === current ? 'bg-amber-500' : 'bg-border',
                  )}
                  aria-hidden="true"
                />
                <span className={cn('truncate text-[10px] font-semibold', index === current ? 'text-foreground' : 'text-muted-foreground')}>{step.label}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{`„${steps[current].hint}”`}</p>
        </div>
      )}
    </div>
  )
}
