import { NextResponse } from 'next/server'
import { requireCashier } from '@/lib/workshop-documents'
import { isUuid, issuePrinterLogToken, readLimitedJson, requestOrigin } from '@/lib/printer-log'

export async function POST(request: Request) {
  const auth = await requireCashier()
  if ('error' in auth) return auth.error
  const { admin, userId } = auth

  const parsed = await readLimitedJson(request, 4 * 1024)
  if ('error' in parsed) return parsed.error
  const documentId = (parsed.body as { documentId?: unknown } | null)?.documentId
  if (!isUuid(documentId)) return NextResponse.json({ error: 'Nieprawidłowy dokument.' }, { status: 400 })

  const { data: document } = await admin
    .from('order_documents')
    .select('id, order_id, status, payload')
    .eq('id', documentId)
    .maybeSingle<{ id: string; order_id: string | null; status: string; payload: { kind?: string } | null }>()
  if (!document) return NextResponse.json({ error: 'Dokument nie istnieje.' }, { status: 404 })
  if (!document.order_id) return NextResponse.json({ error: 'Dokument nie jest powiązany z zamówieniem.' }, { status: 409 })
  const kind = document.payload?.kind
  if (kind !== 'receipt' && kind !== 'refund') return NextResponse.json({ error: 'Nieobsługiwany rodzaj dokumentu.' }, { status: 409 })

  const { data: order } = await admin.from('orders').select('id, number').eq('id', document.order_id).maybeSingle<{ id: string; number: number }>()
  if (!order) return NextResponse.json({ error: 'Zamówienie nie istnieje.' }, { status: 404 })

  const applicationStatus = ['pending', 'printed', 'void'].includes(document.status) ? document.status : 'pending'
  const { data: attempt, error: attemptError } = await admin
    .from('printer_log_attempts')
    .insert({ order_id: order.id, document_id: document.id, order_number: order.number, document_kind: kind, created_by: userId, application_status: applicationStatus })
    .select('id, started_at')
    .single<{ id: string; started_at: string }>()
  if (attemptError || !attempt) return NextResponse.json({ error: 'Nie udało się rozpocząć logowania wydruku.' }, { status: 500 })

  const { error: entryError } = await admin.from('printer_log_entries').insert({
    attempt_id: attempt.id,
    sequence: 0,
    event_type: 'attempt_started',
    parameters: { documentStatus: document.status, documentKind: kind, orderNumber: order.number },
    started_at: attempt.started_at,
    completed_at: attempt.started_at,
    outcome: 'started',
  })
  if (entryError) {
    await admin.from('printer_log_attempts').delete().eq('id', attempt.id)
    return NextResponse.json({ error: 'Nie udało się rozpocząć logowania wydruku.' }, { status: 500 })
  }

  const token = issuePrinterLogToken({ a: attempt.id, d: document.id, o: order.id, u: userId })
  return NextResponse.json(
    { attemptId: attempt.id, endpoint: `${requestOrigin(request)}/api/workshop/printer-logs/${attempt.id}`, token },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
