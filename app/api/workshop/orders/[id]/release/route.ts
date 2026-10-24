import { NextResponse } from 'next/server'
import type { FiscalReceipt } from '@/lib/fiscal-receipt'
import { adjustItems, dbError, requireCashier, type OrderRow } from '@/lib/workshop-documents'

/**
 * Voids every receipt of the order that was issued but never printed, so the order can be edited
 * or cancelled normally. Printed receipts stay untouched and still require a refund.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCashier()
  if ('error' in auth) return auth.error
  const { admin } = auth
  const { id } = await params

  const { data: documents, error: listError } = await admin
    .from('order_documents')
    .select('id, payload')
    .eq('order_id', id)
    .eq('kind', 'receipt')
    .eq('status', 'pending')
    .returns<{ id: string; payload: FiscalReceipt }[]>()
  if (listError) return dbError(listError.message, 'Nie udało się sprawdzić paragonów.')

  for (const document of documents ?? []) {
    const { data: order } = await admin.from('orders').select('items').eq('id', id).maybeSingle<Pick<OrderRow, 'items'>>()
    if (!order) return NextResponse.json({ error: 'Zamówienie nie istnieje.' }, { status: 404 })
    const restored = adjustItems(order.items, document.payload, -1)
    const { error } = await admin.rpc('workshop_finish_document', { p_document_id: document.id, p_status: 'void', p_expected_items: order.items, p_items: restored })
    if (error) return dbError(error.message, 'Nie udało się anulować niewydrukowanego paragonu.')
  }

  const { data: order } = await admin.from('orders').select('items').eq('id', id).maybeSingle<Pick<OrderRow, 'items'>>()
  return NextResponse.json({ voided: documents?.length ?? 0, items: order?.items ?? [] })
}
