import { NextResponse } from 'next/server'
import { authorizeRoles } from '@/lib/workshop-auth'
import { createAdminClient } from '@/lib/supabase/server'

const STAFF_ROLES = ['admin', 'szef', 'kelner'] as const
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type StartBody = {
  orderNumber?: unknown
  documentKind?: unknown
  documentId?: unknown
  testPrint?: unknown
}

function orderNumberFromPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const value = (payload as Record<string, unknown>).orderNumber
  if (typeof value !== 'string') return null
  const number = Number(value.replace(/^#/, ''))
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

export async function POST(request: Request) {
  const auth = await authorizeRoles(STAFF_ROLES)
  if ('response' in auth) return auth.response

  const body = (await request.json().catch(() => null)) as StartBody | null
  const documentKind = body?.documentKind
  if (documentKind !== 'receipt' && documentKind !== 'refund') {
    return NextResponse.json({ error: 'Nieprawidłowy typ dokumentu do logowania.' }, { status: 400 })
  }

  const admin = createAdminClient()
  let documentId: string | null = null
  let orderId: string | null = null
  let orderNumber: number

  if (typeof body?.documentId === 'string') {
    if (!UUID.test(body.documentId)) return NextResponse.json({ error: 'Nieprawidłowy identyfikator dokumentu.' }, { status: 400 })
    const { data: document, error } = await admin
      .from('order_documents')
      .select('id, order_id, kind, payload')
      .eq('id', body.documentId)
      .maybeSingle()
    if (error || !document || document.kind !== documentKind) {
      return NextResponse.json({ error: 'Nie udało się powiązać logu z dokumentem.' }, { status: 404 })
    }

    const storedOrderNumber = orderNumberFromPayload(document.payload)
    if (storedOrderNumber === null || storedOrderNumber !== body.orderNumber) {
      return NextResponse.json({ error: 'Numer zamówienia nie zgadza się z dokumentem.' }, { status: 400 })
    }
    documentId = document.id
    orderId = document.order_id
    orderNumber = storedOrderNumber
  } else {
    if (documentKind !== 'receipt' || body?.testPrint !== true
      || typeof body.orderNumber !== 'number' || !Number.isSafeInteger(body.orderNumber) || body.orderNumber < 1) {
      return NextResponse.json({ error: 'Nieprawidłowa sesja logowania wydruku testowego.' }, { status: 400 })
    }
    orderNumber = body.orderNumber
  }

  if (documentId) {
    const { data: existingAttempts, error } = await admin
      .from('printer_log_attempts')
      .select('id')
      .eq('document_id', documentId)
      .eq('result', 'in_progress')
      .order('started_at', { ascending: false })
      .limit(5)
    if (error) return NextResponse.json({ error: 'Nie udało się odczytać poprzednich logów drukarki.' }, { status: 503 })

    for (const attempt of existingAttempts ?? []) {
      const { data: entries, error: entryError } = await admin
        .from('printer_log_entries')
        .select('id, event_type')
        .eq('attempt_id', attempt.id)
      if (entryError) return NextResponse.json({ error: 'Nie udało się sprawdzić poprzednich logów drukarki.' }, { status: 503 })
      if (!entries?.some((entry) => entry.event_type === 'attempt_started')) {
        const { error: startError } = await admin.from('printer_log_entries').insert({
          attempt_id: attempt.id,
          sequence: 0,
          event_type: 'attempt_started',
          parameters: { orderNumber, documentKind, testPrint: false },
          outcome: 'started',
        })
        if (startError) return NextResponse.json({ error: 'Nie udało się zapisać początku logowania wydruku.' }, { status: 503 })
      }
      if (!entries?.some((entry) => entry.event_type === 'command')) {
        return NextResponse.json({ endpoint: new URL(`/api/workshop/printer-logs/${attempt.id}`, request.url).toString() })
      }
    }
  }

  const { data: attempt, error: attemptError } = await admin
    .from('printer_log_attempts')
    .insert({
      order_id: orderId,
      document_id: documentId,
      order_number: orderNumber,
      document_kind: documentKind,
      created_by: auth.user.id,
    })
    .select('id')
    .single()
  if (attemptError || !attempt) {
    return NextResponse.json({ error: 'Nie udało się rozpocząć logowania wydruku POSNET.' }, { status: 503 })
  }

  const { error: entryError } = await admin.from('printer_log_entries').insert({
    attempt_id: attempt.id,
    sequence: 0,
    event_type: 'attempt_started',
    parameters: { orderNumber, documentKind, testPrint: body?.testPrint === true },
    outcome: 'started',
  })
  if (entryError) {
    await admin.from('printer_log_attempts').delete().eq('id', attempt.id)
    return NextResponse.json({ error: 'Nie udało się zapisać początku logowania wydruku.' }, { status: 503 })
  }

  return NextResponse.json(
    { endpoint: new URL(`/api/workshop/printer-logs/${attempt.id}`, request.url).toString() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
