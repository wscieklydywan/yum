import { paymentLabels, type PaymentMethod, type PaymentPart } from './fiscal-receipt'

const MAX_PART_GROSZE = 10_000_000

/** Stored in receipt_payment_method when the receipt lists several payment methods. */
export const SPLIT_METHOD = 'split'
export const SPLIT_LABEL = 'Dzielona'

/** Validates untrusted input: 2–3 parts, distinct known methods, positive integer grosze. */
export function parsePaymentSplit(value: unknown): PaymentPart[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 3) return null
  const parts: PaymentPart[] = []
  for (const entry of value) {
    const method = (entry as { method?: unknown } | null)?.method
    const amount = (entry as { amount?: unknown } | null)?.amount
    if (typeof method !== 'string' || !(method in paymentLabels)) return null
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0 || amount > MAX_PART_GROSZE) return null
    if (parts.some((part) => part.method === method)) return null
    parts.push({ method: method as PaymentMethod, amount })
  }
  return parts
}

export const splitTotal = (parts: PaymentPart[]) => parts.reduce((sum, part) => sum + part.amount, 0)

/** The largest part – stored as payment_method so single-method views keep working. */
export const primaryMethod = (parts: PaymentPart[]) => parts.reduce((top, part) => (part.amount > top.amount ? part : top)).method

export const splitCash = (parts: PaymentPart[]) => parts.find((part) => part.method === 'cash')?.amount ?? null

export const splitLabel = (parts: PaymentPart[]) => parts.map((part) => paymentLabels[part.method]).join(' + ')
