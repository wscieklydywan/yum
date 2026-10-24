import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createReceipt, createRefund, paymentLabels, type FiscalReceipt, type PaymentMethod, type RefundRequestLine } from '@/lib/fiscal-receipt'
import { adjustItems, dbError, requireCashier, toReceiptSource, type DocumentResponse, type OrderRow } from '@/lib/workshop-documents'
import { parsePaymentSplit, primaryMethod, SPLIT_METHOD, splitCash } from '@/lib/payment-split'

type Body = { kind?: string; payment?: string; split?: unknown; buyerNip?: string; paid?: boolean; cashReceived?: number; reason?: string; lines?: RefundRequestLine[] }

const ACTIVE = ['new', 'preparing', 'ready']

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCashier()
  if ('error' in auth) return auth.error
  const { admin, userId } = auth
  const { id } = await params

  const body = (await request.json().catch(() => null)) as Body | null
  const payment = body?.payment as PaymentMethod
  if (!payment || !(payment in paymentLabels)) return NextResponse.json({ error: 'Wybierz formę płatności.' }, { status: 400 })
  if (body?.kind !== 'receipt' && body?.kind !== 'refund') return NextResponse.json({ error: 'Nieznany dokument.' }, { status: 400 })
  const split = body.kind === 'receipt' && body.split != null ? parsePaymentSplit(body.split) : null
  if (body.kind === 'receipt' && body.split != null && !split) return NextResponse.json({ error: 'Nieprawidłowy podział płatności.' }, { status: 400 })

  const { data: order } = await admin.from('orders').select('id, number, status, items, discount, delivery_fee, buyer_nip').eq('id', id).maybeSingle<OrderRow & { buyer_nip?: string | null }>()
  if (!order) return NextResponse.json({ error: 'Zamówienie nie istnieje.' }, { status: 404 })

  let document: FiscalReceipt
  if (body.kind === 'receipt') {
    if (!ACTIVE.includes(order.status) && order.status !== 'handed_off') return NextResponse.json({ error: 'Anulowanego zamówienia nie można zafiskalizować.' }, { status: 409 })
    const { data: pending } = await admin.from('order_documents').select('payload').eq('order_id', id).eq('kind', 'receipt').eq('status', 'pending').maybeSingle<{ payload: FiscalReceipt }>()
    if (pending) return NextResponse.json({ document: pending.payload, status: 'pending', resumed: true } satisfies DocumentResponse)
    const buyerNip = typeof body.buyerNip === 'string' ? body.buyerNip : order.buyer_nip ?? undefined
    const draft = createReceipt(toReceiptSource(order), payment, buyerNip, split)
    if (draft.issues.length) return NextResponse.json({ error: draft.issues[0] }, { status: 400 })
    document = draft.receipt
  } else {
    if (!Array.isArray(body.lines) || body.lines.length > 50) return NextResponse.json({ error: 'Wybierz pozycje do zwrotu.' }, { status: 400 })
    const draft = createRefund(toReceiptSource(order), body.lines.map((line) => ({ itemId: String(line?.itemId), quantity: Number(line?.quantity) })), String(body.reason ?? ''), payment)
    if (draft.issues.length) return NextResponse.json({ error: draft.issues[0] }, { status: 400 })
    document = draft.receipt
  }

  const typedCash = typeof body.cashReceived === 'number' && Number.isInteger(body.cashReceived) && body.cashReceived >= 0 && body.cashReceived <= 10_000_000 ? body.cashReceived : null
  if (document.kind === 'receipt' && body.paid === true && payment === 'cash' && !split) {
    if (typedCash === null || typedCash < document.total) {
      return NextResponse.json({ error: 'Kwota otrzymanej gotówki nie może być niższa niż kwota paragonu.' }, { status: 400 })
    }
    document = { ...document, cashReceived: typedCash }
  }

  document = { ...document, id: randomUUID() }
  let nextItems = adjustItems(order.items, document, 1)
  if (document.kind === 'refund' && ACTIVE.includes(order.status)) {
    nextItems = nextItems.map((item) => (item.refunded ?? 0) >= item.quantity && !item.done ? { ...item, cancelled: true } : item)
  }

  const { error } = await admin.rpc('workshop_store_document', {
    p_order_id: id,
    p_expected_items: order.items,
    p_items: nextItems,
    p_document: { id: document.id, kind: document.kind, payload: document, total: document.total, reason: document.reason ?? '', createdBy: userId },
  })
  if (error) return dbError(error.message, 'Nie udało się zapisać dokumentu.')
  if (document.kind === 'receipt') {
    // A receipt printed ahead of payment (e.g. delivery) only pre-fills the method; it never overrides a payment already taken.
    const method = split ? primaryMethod(split) : payment
    const cashReceived = split ? splitCash(split) : method === 'cash' ? typedCash : null
    const receiptMethod = split ? SPLIT_METHOD : payment
    const buyer_nip = document.buyerNip ?? null
    if (body.paid === true) await admin.from('orders').update({ payment_method: method, payment_split: split, receipt_payment_method: receiptMethod, paid_at: new Date().toISOString(), cash_received_grosze: cashReceived, buyer_nip }).eq('id', id)
    else {
      await admin.from('orders').update({ receipt_payment_method: receiptMethod, buyer_nip }).eq('id', id)
      await admin.from('orders').update({ payment_method: method, payment_split: split }).eq('id', id).is('paid_at', null)
    }
  }
  return NextResponse.json({ document, status: 'pending' } satisfies DocumentResponse, { status: 201 })
}
