import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createReceipt, createRefund, paymentLabels, type FiscalReceipt, type PaymentMethod, type RefundRequestLine } from '@/lib/fiscal-receipt'
import { adjustItems, dbError, requireCashier, toReceiptSource, type DocumentResponse, type OrderRow } from '@/lib/workshop-documents'

type Body = { kind?: string; payment?: string; buyerNip?: string; reason?: string; lines?: RefundRequestLine[] }

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

  const { data: order } = await admin.from('orders').select('id, number, status, items, discount, delivery_fee').eq('id', id).maybeSingle<OrderRow>()
  if (!order) return NextResponse.json({ error: 'Zamówienie nie istnieje.' }, { status: 404 })

  let document: FiscalReceipt
  if (body.kind === 'receipt') {
    if (!ACTIVE.includes(order.status) && order.status !== 'handed_off') return NextResponse.json({ error: 'Anulowanego zamówienia nie można zafiskalizować.' }, { status: 409 })
    const { data: pending } = await admin.from('order_documents').select('payload').eq('order_id', id).eq('kind', 'receipt').eq('status', 'pending').maybeSingle<{ payload: FiscalReceipt }>()
    if (pending) return NextResponse.json({ document: pending.payload, status: 'pending', resumed: true } satisfies DocumentResponse)
    const draft = createReceipt(toReceiptSource(order), payment, body.buyerNip)
    if (draft.issues.length) return NextResponse.json({ error: draft.issues[0] }, { status: 400 })
    document = draft.receipt
  } else {
    if (!Array.isArray(body.lines) || body.lines.length > 50) return NextResponse.json({ error: 'Wybierz pozycje do zwrotu.' }, { status: 400 })
    const draft = createRefund(toReceiptSource(order), body.lines.map((line) => ({ itemId: String(line?.itemId), quantity: Number(line?.quantity) })), String(body.reason ?? ''), payment)
    if (draft.issues.length) return NextResponse.json({ error: draft.issues[0] }, { status: 400 })
    document = draft.receipt
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
  if (document.kind === 'receipt') await admin.from('orders').update({ payment_method: payment }).eq('id', id)
  return NextResponse.json({ document, status: 'pending' } satisfies DocumentResponse, { status: 201 })
}
