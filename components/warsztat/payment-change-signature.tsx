'use client'

import { PenLine } from 'lucide-react'

export type PaymentChangeSignatureValue = { name: string; reason: string }

export const emptySignature: PaymentChangeSignatureValue = { name: '', reason: '' }

export const isSignatureValid = (value: PaymentChangeSignatureValue) => value.name.trim().length >= 2 && value.reason.trim().length >= 3

export const signaturePayload = (value: PaymentChangeSignatureValue) => ({ changedBy: value.name.trim(), changeReason: value.reason.trim() })

const fieldClass = 'h-10 w-full rounded-lg border border-amber-300 bg-white px-3 text-sm font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary'

/** Required whenever money moves to another method on an order whose receipt is already printed. */
export function PaymentChangeSignature({ value, onChange, idPrefix }: { value: PaymentChangeSignatureValue; onChange: (value: PaymentChangeSignatureValue) => void; idPrefix: string }) {
  return <fieldset className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
    <legend className="sr-only">Podpis zmiany formy płatności</legend>
    <p className="flex items-start gap-2 text-xs font-semibold text-amber-950">
      <PenLine className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      Paragon jest już wydrukowany. Zmiana formy płatności wymaga podpisu – zostanie zapisana w historii.
    </p>
    <div className="grid gap-2 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
      <label htmlFor={`${idPrefix}-name`} className="flex flex-col gap-1 text-[11px] font-semibold text-amber-950">
        Twoje imię
        <input id={`${idPrefix}-name`} value={value.name} maxLength={80} autoComplete="given-name" placeholder="np. Kasia" onChange={(event) => onChange({ ...value, name: event.target.value })} className={fieldClass} />
      </label>
      <label htmlFor={`${idPrefix}-reason`} className="flex flex-col gap-1 text-[11px] font-semibold text-amber-950">
        Powód zmiany
        <input id={`${idPrefix}-reason`} value={value.reason} maxLength={500} placeholder="np. klient zapłacił kartą przy odbiorze" onChange={(event) => onChange({ ...value, reason: event.target.value })} className={fieldClass} />
      </label>
    </div>
  </fieldset>
}
