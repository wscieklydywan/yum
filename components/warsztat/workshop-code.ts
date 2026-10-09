import type { CheckoutCode } from '@/lib/checkout-codes'

export type WorkshopCodePreview = CheckoutCode & { customer: string | null; customerId: string | null }

export function normalizeCodeInput(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24)
}

export async function fetchWorkshopCode(code: string) {
  const response = await fetch(`/api/workshop/codes?code=${encodeURIComponent(code)}`).catch(() => null)
  const result = (await response?.json().catch(() => null)) as (WorkshopCodePreview & { error?: string }) | null
  if (!response?.ok || !result) throw new Error(result?.error ?? 'Nie udało się sprawdzić kodu.')
  return result
}
