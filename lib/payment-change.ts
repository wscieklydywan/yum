import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SPLIT_METHOD } from './payment-split'

export type PaymentChangeAuthor = { name: string; reason: string }

type OrderPaymentState = { payment_method: string | null; payment_split: unknown; receipt_payment_method: string | null }

/** Reads the signature sent with a payment change; null when either part is missing or too short. */
export function parsePaymentChangeAuthor(body: { changedBy?: unknown; changeReason?: unknown } | null): PaymentChangeAuthor | null {
  const name = typeof body?.changedBy === 'string' ? body.changedBy.trim().slice(0, 80) : ''
  const reason = typeof body?.changeReason === 'string' ? body.changeReason.trim().slice(0, 500) : ''
  return name.length >= 2 && reason.length >= 3 ? { name, reason } : null
}

const currentMethod = (order: OrderPaymentState) =>
  Array.isArray(order.payment_split) && order.payment_split.length ? SPLIT_METHOD : order.payment_method ?? order.receipt_payment_method

/**
 * Once a receipt is printed its payment method is fixed on paper, so moving the money to another method
 * must be signed. Returns the change to log, or null when nothing needs a signature.
 */
export function receiptPaymentChange(order: OrderPaymentState, nextMethod: string) {
  if (!order.receipt_payment_method) return null
  const from = currentMethod(order)
  return from === nextMethod ? null : { receiptMethod: order.receipt_payment_method, from, to: nextMethod }
}

export async function loadOrderPaymentState(admin: SupabaseClient, orderId: string) {
  const { data, error } = await admin.from('orders').select('status, payment_method, payment_split, receipt_payment_method').eq('id', orderId).maybeSingle()
  if (error) return { error: 'Nie udało się wczytać zamówienia.' as const }
  if (!data) return { error: 'Nie znaleziono zamówienia.' as const }
  return { order: data as OrderPaymentState & { status: string } }
}

export async function logPaymentChange(admin: SupabaseClient, orderId: string, change: { receiptMethod: string; from: string | null; to: string }, author: PaymentChangeAuthor, userId: string) {
  const { error } = await admin.from('order_payment_changes').insert({
    order_id: orderId,
    receipt_method: change.receiptMethod,
    from_method: change.from,
    to_method: change.to,
    changed_by_name: author.name,
    reason: author.reason,
    created_by: userId,
  })
  return !error
}

export const PAYMENT_CHANGE_SIGNATURE_REQUIRED = 'Paragon jest już wydrukowany – wpisz swoje imię i powód zmiany formy płatności.'
