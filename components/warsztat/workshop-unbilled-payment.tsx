'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { paymentLabels, type PaymentMethod } from '@/lib/fiscal-receipt'
import { paymentIcons, paymentMethods } from './workshop-print-dialog'

const isPaymentMethod = (value: unknown): value is PaymentMethod => typeof value === 'string' && value in paymentLabels

/** Lets staff record how a customer paid when the order was handed off without a printed receipt, so it still counts in the cash report. */
export function WorkshopUnbilledPayment({ orderId, current }: { orderId: string; current?: string }) {
  const [method, setMethod] = useState<PaymentMethod | null>(isPaymentMethod(current) ? current : null)
  const [saving, setSaving] = useState<PaymentMethod | null>(null)

  async function choose(next: PaymentMethod) {
    if (saving || next === method) return
    setSaving(next)
    try {
      const response = await fetch('/api/workshop/cash-report', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, method: next }),
      })
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(data?.error || 'Nie udało się zapisać formy płatności.')
      setMethod(next)
      toast.success(`Zapisano: ${paymentLabels[next]}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się zapisać formy płatności.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <fieldset className="mt-2 flex flex-col gap-1.5">
      <legend className="mb-1.5 text-[11px] font-semibold text-[#4a443f]">
        {method ? 'Klient zapłacił:' : 'Jak klient zapłacił? (trafi do raportu kasowego)'}
      </legend>
      <div className="grid grid-cols-3 gap-2">
        {paymentMethods.map((option) => {
          const Icon = paymentIcons[option]
          const active = method === option
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              disabled={saving !== null}
              onClick={() => void choose(option)}
              className={`relative flex flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 ${active ? 'border-primary bg-primary/10 text-primary' : 'border-[#e5ded6] bg-white text-[#25211f] hover:bg-[#f5f2ee]'}`}
            >
              {active && <Check className="absolute right-1.5 top-1.5 size-3.5" aria-hidden="true" />}
              <Icon className="size-5" aria-hidden="true" />
              {saving === option ? 'Zapisywanie…' : paymentLabels[option]}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
