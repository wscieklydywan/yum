import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const OUTCOMES = ['success', 'error', 'unknown'] as const

type CommandLog = {
  eventType?: unknown
  sequence?: unknown
  commandName?: unknown
  parameters?: unknown
  rawResponse?: unknown
  outcome?: unknown
  errorCode?: unknown
  errorMessage?: unknown
  startedAt?: unknown
  completedAt?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseTimestamp(value: unknown) {
  if (typeof value !== 'string') return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}

function optionalText(value: unknown, maxLength: number) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' || value.length > maxLength) return undefined
  return value
}

async function findAttempt(attemptId: string) {
  if (!UUID.test(attemptId)) return { error: NextResponse.json({ error: 'Nieprawidłowa sesja logowania.' }, { status: 404 }) }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('printer_log_attempts')
    .select('id, result')
    .eq('id', attemptId)
    .maybeSingle()
  if (error) return { error: NextResponse.json({ error: 'Nie udało się odczytać sesji logowania.' }, { status: 503 }) }
  if (!data) return { error: NextResponse.json({ error: 'Sesja logowania nie istnieje.' }, { status: 404 }) }
  if (data.result !== 'in_progress') return { error: NextResponse.json({ error: 'Sesja logowania jest już zamknięta.' }, { status: 409 }) }
  return { admin, attempt: data }
}

export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params
  const state = await findAttempt(attemptId)
  if ('error' in state) return state.error

  const body = (await request.json().catch(() => null)) as CommandLog | null
  const sequence = body?.sequence
  const commandName = body?.commandName
  const outcome = body?.outcome
  const startedAt = parseTimestamp(body?.startedAt)
  const completedAt = parseTimestamp(body?.completedAt)
  const rawResponse = optionalText(body?.rawResponse, 8192)
  const errorCode = optionalText(body?.errorCode, 32)
  const errorMessage = optionalText(body?.errorMessage, 1000)
  if (body?.eventType !== 'command' || typeof sequence !== 'number' || !Number.isSafeInteger(sequence)
    || sequence < 1 || sequence > 1000 || typeof commandName !== 'string' || !/^[a-z][a-z0-9]*$/i.test(commandName)
    || !OUTCOMES.includes(outcome as (typeof OUTCOMES)[number]) || !isRecord(body.parameters)
    || JSON.stringify(body.parameters).length > 8192 || rawResponse === undefined || errorCode === undefined
    || errorMessage === undefined || !startedAt || !completedAt || Date.parse(completedAt) < Date.parse(startedAt)) {
    return NextResponse.json({ error: 'Nieprawidłowy wpis polecenia POSNET.' }, { status: 400 })
  }

  const { error } = await state.admin.from('printer_log_entries').insert({
    attempt_id: attemptId,
    sequence,
    event_type: 'command',
    command_name: commandName,
    parameters: body.parameters,
    raw_response: rawResponse,
    started_at: startedAt,
    completed_at: completedAt,
    duration_ms: Date.parse(completedAt) - Date.parse(startedAt),
    sent: outcome !== 'unknown',
    outcome,
    error_code: errorCode,
    error_message: errorMessage,
  })
  if (error) return NextResponse.json({ error: 'Nie udało się zapisać odpowiedzi POSNET.' }, { status: 503 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params
  const state = await findAttempt(attemptId)
  if ('error' in state) return state.error

  const body = (await request.json().catch(() => null)) as {
    result?: unknown
    failureCommand?: unknown
    errorCode?: unknown
    errorMessage?: unknown
  } | null
  if (body?.result !== 'success' && body?.result !== 'warning' && body?.result !== 'error') {
    return NextResponse.json({ error: 'Nieprawidłowy wynik logowania POSNET.' }, { status: 400 })
  }
  const failureCommand = optionalText(body.failureCommand, 64)
  const errorCode = optionalText(body.errorCode, 32)
  const errorMessage = optionalText(body.errorMessage, 1000)
  if (failureCommand === undefined || errorCode === undefined || errorMessage === undefined) {
    return NextResponse.json({ error: 'Nieprawidłowe szczegóły błędu POSNET.' }, { status: 400 })
  }

  const { error } = await state.admin
    .from('printer_log_attempts')
    .update({
      completed_at: new Date().toISOString(),
      result: body.result === 'error' ? 'failed' : 'succeeded',
      failure_command: failureCommand,
      error_code: errorCode,
      error_message: errorMessage,
    })
    .eq('id', attemptId)
    .eq('result', 'in_progress')
  if (error) return NextResponse.json({ error: 'Nie udało się zamknąć logowania POSNET.' }, { status: 503 })
  return NextResponse.json({ ok: true })
}
