import { NextResponse } from 'next/server'
import type { FiscalReceipt } from '@/lib/fiscal-receipt'
import { adjustItems, dbError, requireCashier, type OrderRow } from '@/lib/workshop-documents'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCashier()
  if ('error' in auth) return auth.error
  const { id } = await params
  const { data: document } = await auth.admin.from('order_documents').select('payload, status').eq('id', id).maybeSingle<{ payload: FiscalReceipt; status: string }>()
  if (!document) return NextResponse.json({ error: 'Dokument nie istnieje.' }, { status: 404 })
  return NextResponse.json({ document: document.payload, status: document.status })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCashier()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const { id } = await params
  const body = (await request.json().catch(() => null)) as { status?: string } | null
  if (body?.status !== 'printed' && body?.status !== 'void' && body?.status !== 'printing') return NextResponse.json({ error: 'Nieznany status.' }, { status: 400 })

  if (body.status === 'printing') {
    const { error } = await admin.rpc('workshop_mark_document_printing', { p_document_id: id })
    if (error) return dbError(error.message, 'Nie udało się oznaczyć wydruku.')
    return NextResponse.json({ ok: true })
  }

  if (body.status === 'printed') {
    const { error } = await admin.rpc('workshop_finish_document', { p_document_id: id, p_status: 'printed' })
    if (error) return dbError(error.message, 'Nie udało się zapisać wydruku.')
    return NextResponse.json({ ok: true })
  }

  const { data: document } = await admin.from('order_documents').select('order_id, payload, status').eq('id', id).maybeSingle<{ order_id: string; payload: FiscalReceipt; status: string }>()
  if (!document || document.status !== 'pending') return NextResponse.json({ error: 'Dokument nie oczekuje na wydruk.' }, { status: 409 })
  const { data: order } = await admin.from('orders').select('items').eq('id', document.order_id).maybeSingle<Pick<OrderRow, 'items'>>()
  if (!order) return NextResponse.json({ error: 'Zamówienie nie istnieje.' }, { status: 404 })

  const restored = adjustItems(order.items, document.payload, -1).map((item) =>
    document.payload.kind === 'refund' && item.cancelled && (item.refunded ?? 0) < item.quantity && document.payload.lines.some((line) => line.itemId === item.id)
      ? { ...item, cancelled: false }
      : item,
  )
  const { error } = await admin.rpc('workshop_finish_document', { p_document_id: id, p_status: 'void', p_expected_items: order.items, p_items: restored })
  if (error) return dbError(error.message, 'Nie udało się anulować dokumentu.')
  return NextResponse.json({ ok: true })
}
