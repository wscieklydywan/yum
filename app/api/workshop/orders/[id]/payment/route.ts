import { NextResponse } from 'next/server'
import { isValidNip, paymentLabels, type PaymentMethod } from '@/lib/fiscal-receipt'
import { parsePaymentSplit, primaryMethod, splitCash, SPLIT_METHOD } from '@/lib/payment-split'
import { loadOrderPaymentState, logPaymentChange, parsePaymentChangeAuthor, PAYMENT_CHANGE_SIGNATURE_REQUIRED, receiptPaymentChange } from '@/lib/payment-change'
import { requireCashier } from '@/lib/workshop-documents'

const isUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value)

/** Cash received in grosze; anything that is not a sane non-negative integer is treated as missing. */
function parseCashReceived(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10_000_000 ? value : null
}

/**
 * Marks an order as paid (independently of the receipt) and records how the customer paid for the cash report.
 * A split bill sends `split` (parts in grosze); its largest part becomes payment_method.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCashier()
  if ('error' in auth) return auth.error
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Nieprawidłowe zamówienie.' }, { status: 400 })

  const body = (await request.json().catch(() => null)) as { method?: unknown; cashReceived?: unknown; split?: unknown; buyerNip?: unknown; changedBy?: unknown; changeReason?: unknown } | null
  const buyerNip = typeof body?.buyerNip === 'string' ? body.buyerNip.replace(/[\s-]/g, '') : undefined
  if (buyerNip && !isValidNip(buyerNip)) return NextResponse.json({ error: 'Nieprawidłowy NIP nabywcy.' }, { status: 400 })
  const split = body?.split != null ? parsePaymentSplit(body.split) : null
  if (body?.split != null && !split) return NextResponse.json({ error: 'Nieprawidłowy podział płatności.' }, { status: 400 })
  const method = split ? primaryMethod(split) : body?.method
  if (typeof method !== 'string' || !(method in paymentLabels)) return NextResponse.json({ error: 'Wybierz formę płatności.' }, { status: 400 })
  const cashReceived = split ? splitCash(split) : parseCashReceived(body?.cashReceived)
  if (!split && method === 'cash' && cashReceived === null) return NextResponse.json({ error: 'Wpisz kwotę otrzymaną w gotówce.' }, { status: 400 })

  const state = await loadOrderPaymentState(auth.admin, id)
  if ('error' in state) return NextResponse.json({ error: state.error }, { status: 404 })
  const change = receiptPaymentChange(state.order, split ? SPLIT_METHOD : method)
  const author = parsePaymentChangeAuthor(body)
  if (change && !author) return NextResponse.json({ error: PAYMENT_CHANGE_SIGNATURE_REQUIRED, signatureRequired: true }, { status: 422 })

  const { data, error } = await auth.admin.from('orders').update({
    payment_method: method as PaymentMethod,
    payment_split: split,
    paid_at: new Date().toISOString(),
    cash_received_grosze: split || method === 'cash' ? cashReceived : null,
    ...(buyerNip !== undefined ? { buyer_nip: buyerNip || null } : {}),
  }).eq('id', id).neq('status', 'cancelled').select('id').maybeSingle()
  if (error) return NextResponse.json({ error: 'Nie udało się zapisać płatności.' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Anulowanego zamówienia nie można opłacić.' }, { status: 409 })
  if (change && author) await logPaymentChange(auth.admin, id, change, author, auth.userId)
  return NextResponse.json({ ok: true })
}

/** Reverts a payment recorded by mistake; the method stays so the cash report keeps its column if a receipt exists. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCashier()
  if ('error' in auth) return auth.error
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Nieprawidłowe zamówienie.' }, { status: 400 })
  const { error } = await auth.admin.from('orders').update({ paid_at: null, cash_received_grosze: null }).eq('id', id)
  if (error) return NextResponse.json({ error: 'Nie udało się cofnąć płatności.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
