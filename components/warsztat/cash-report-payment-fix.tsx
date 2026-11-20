'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ASSIGNABLE_METHODS, cashMethodLabels, type CashMethod, type CashUnassignedOrder } from '@/lib/cash-report-types'
import { SPLIT_LABEL } from '@/lib/payment-split'
import { isSignatureValid, PaymentChangeSignature, signaturePayload } from './payment-change-signature'

const CASH_REPORT_KEY = '/api/workshop/cash-report'

const money = (value: number) => `${value.toFixed(2).replace('.', ',')} zł`
const time = (value: string) => new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
const methodLabel = (method: CashMethod | 'split') => (method === 'split' ? SPLIT_LABEL : cashMethodLabels[method])

type Props = {
  order: CashUnassignedOrder
  receiptMethod?: CashMethod
  paymentMethod?: CashMethod | 'split'
  signerName: string
  onSignerNameChange: (name: string) => void
  onSaved: () => Promise<unknown>
}

/** One order on the cash report whose payment method needs fixing. Receipted orders ask for a signature. */
export function CashReportPaymentFix({ order, receiptMethod, paymentMethod, signerName, onSignerNameChange, onSaved }: Props) {
  const [target, setTarget] = useState<CashMethod | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const signature = { name: signerName, reason }
  const receipted = !!receiptMethod

  async function save(method: CashMethod, withSignature: boolean) {
    setBusy(true)
    const response = await fetch(CASH_REPORT_KEY, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id, method, ...(withSignature ? signaturePayload(signature) : {}) }),
    }).catch(() => null)
    const result = response ? await response.json().catch(() => null) : null
    setBusy(false)
    if (response?.status === 422 && result?.signatureRequired) { setTarget(method); return }
    if (!response?.ok) { toast.error(result?.error ?? 'Nie udało się zapisać formy płatności.'); return }
    setTarget(null)
    setReason('')
    toast.success(`#${order.number}: ${cashMethodLabels[method]}`)
    await onSaved()
  }

  function choose(method: CashMethod) {
    if (receipted) { setTarget(method); return }
    void save(method, false)
  }

  return <li className="flex flex-col gap-2 rounded-lg bg-white px-2.5 py-2 text-[12px]">
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="font-bold">#{order.number}</span>
      <span className="text-[#756e67]">{order.type} · {time(order.createdAt)}</span>
      <span className="ml-auto font-bold tabular-nums">{money(order.total)}</span>
    </div>
    {receiptMethod && paymentMethod && <p className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="rounded bg-[#f7f3ef] px-1.5 py-0.5 font-semibold">Paragon: {cashMethodLabels[receiptMethod]}</span>
      <ArrowRight className="size-3 text-[#8b827a]" aria-hidden="true" />
      <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-950">W systemie: {methodLabel(paymentMethod)}</span>
    </p>}
    <div className="flex flex-wrap gap-1" role="group" aria-label={`Forma płatności zamówienia ${order.number}`}>
      {ASSIGNABLE_METHODS.map((method) => {
        const current = method === paymentMethod
        return <button key={method} type="button" disabled={busy || current} aria-pressed={target === method} onClick={() => choose(method)} className={cn('h-8 rounded-md border px-2.5 text-[11px] font-semibold disabled:opacity-50', target === method ? 'border-primary bg-primary text-primary-foreground' : 'border-[#e5ded6] hover:bg-[#f7f3ef]', current && 'cursor-default')}>
          {cashMethodLabels[method]}{current ? ' (obecna)' : ''}
        </button>
      })}
    </div>
    {target && <form className="flex flex-col gap-2" onSubmit={(event) => { event.preventDefault(); if (isSignatureValid(signature)) void save(target, true) }}>
      <PaymentChangeSignature idPrefix={`fix-${order.id}`} value={signature} onChange={(value) => { onSignerNameChange(value.name); setReason(value.reason) }} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => { setTarget(null); setReason('') }}>Anuluj</Button>
        <Button type="submit" size="sm" disabled={busy || !isSignatureValid(signature)}>
          {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          Zmień na: {cashMethodLabels[target]}
        </Button>
      </div>
    </form>}
  </li>
}
