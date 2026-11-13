import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const PRINTER_LOG_TOKEN_TTL_SECONDS = 30 * 60
export const MAX_ENTRY_BODY_BYTES = 64 * 1024
export const MAX_TEXT_LENGTH = 8000
export const MAX_SHORT_TEXT_LENGTH = 200
export const MAX_PARAMETERS_BYTES = 16 * 1024
/** Sequence 0 is the server's own `attempt_started` entry; the APK numbers its entries from 1. */
export const FIRST_CLIENT_SEQUENCE = 1
export const MAX_SEQUENCE = 1_000_000

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_PATTERN.test(value)

export type PrinterLogClaims = { a: string; d: string; o: string; u: string; exp: number }

function signingKey() {
  const dedicated = process.env.PRINTER_LOG_TOKEN_SECRET
  if (dedicated) return dedicated
  const secret = process.env.YUMMY_SUPABASE_SECRET_KEY
  if (!secret) throw new Error('YUMMY_SUPABASE_SECRET_KEY is not configured')
  // A purpose-bound derivation, so the Supabase secret itself is never used directly as an HMAC key nor exposed.
  return createHmac('sha256', secret).update('yummy:printer-log-token:v1').digest()
}

const sign = (payload: string) => createHmac('sha256', signingKey()).update(payload).digest('base64url')

export function issuePrinterLogToken(claims: Omit<PrinterLogClaims, 'exp'>) {
  const payload = Buffer.from(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + PRINTER_LOG_TOKEN_TTL_SECONDS })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

function verifyToken(token: string): PrinterLogClaims | null {
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra !== undefined) return null
  const expected = Buffer.from(sign(payload))
  const received = Buffer.from(signature)
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as PrinterLogClaims
    if (![claims.a, claims.d, claims.o, claims.u].every(isUuid) || typeof claims.exp !== 'number') return null
    if (claims.exp < Math.floor(Date.now() / 1000)) return null
    return claims
  } catch {
    return null
  }
}

export type AttemptRow = { id: string; document_id: string | null; order_id: string | null; created_by: string | null; result: string }

/** Verifies the Bearer token's signature, expiry and binding to this exact attempt, document, order and user. */
export async function authorizeAttempt(request: Request, attemptId: string) {
  const unauthorized = (message: string) => ({ error: NextResponse.json({ error: message }, { status: 401 }) })
  if (!isUuid(attemptId)) return { error: NextResponse.json({ error: 'Nieprawidłowa próba.' }, { status: 400 }) }
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(\S+)$/i.exec(header)
  if (!match) return unauthorized('Brak uprawnienia.')
  const claims = verifyToken(match[1])
  if (!claims || claims.a !== attemptId) return unauthorized('Uprawnienie jest nieważne lub wygasło.')
  const admin = createAdminClient()
  const { data: attempt } = await admin
    .from('printer_log_attempts')
    .select('id, document_id, order_id, created_by, result')
    .eq('id', attemptId)
    .maybeSingle<AttemptRow>()
  if (!attempt || attempt.document_id !== claims.d || attempt.order_id !== claims.o || attempt.created_by !== claims.u) {
    return unauthorized('Uprawnienie nie pasuje do próby.')
  }
  return { admin, attempt, claims }
}

const SECRET_KEY_PATTERN = /token|secret|password|passwd|authorization|api[-_]?key|bearer|cookie|session/i
const REDACTED = '[REDACTED]'

export function redactText(value: string) {
  return value
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/=]+/gi, `Bearer ${REDACTED}`)
    .replace(/\b(token|secret|password|api[-_]?key|authorization)(\s*[=:]\s*)("?)[^\s"&,;}]+/gi, `$1$2$3${REDACTED}`)
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, REDACTED)
}

function redactValue(value: unknown, depth: number): unknown {
  if (value === null || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') return truncate(redactText(value), MAX_TEXT_LENGTH)
  if (depth >= 6) return '[TRUNCATED]'
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => redactValue(item, depth + 1))
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 200)) {
      const safeKey = truncate(key, MAX_SHORT_TEXT_LENGTH)
      result[safeKey] = SECRET_KEY_PATTERN.test(key) ? REDACTED : redactValue(item, depth + 1)
    }
    return result
  }
  return null
}

export function sanitizeParameters(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null) return {}
  const redacted = redactValue(Array.isArray(value) || typeof value !== 'object' ? { value } : value, 0) as Record<string, unknown>
  if (Buffer.byteLength(JSON.stringify(redacted)) > MAX_PARAMETERS_BYTES) return null
  return redacted
}

export const truncate = (value: string, max: number) => (value.length > max ? `${value.slice(0, max)}…[+${value.length - max}]` : value)

export function optionalText(value: unknown, max: number, redact = true): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return undefined
  return truncate(redact ? redactText(value) : value, max)
}

export function optionalTimestamp(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  const date = typeof value === 'number' ? new Date(value) : typeof value === 'string' ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : undefined
}

/** POSNET `strns` flags arrive as 0/1, "0"/"1" or booleans; anything else means the status could not be read. */
export function posnetFlag(value: unknown): boolean | null {
  if (value === true || value === 1 || value === '1') return true
  if (value === false || value === 0 || value === '0') return false
  return null
}

export async function readLimitedJson(request: Request, maxBytes: number): Promise<{ body: unknown } | { error: NextResponse }> {
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > maxBytes) return { error: NextResponse.json({ error: 'Wpis jest zbyt duży.' }, { status: 413 }) }
  const text = await request.text().catch(() => null)
  if (text === null) return { error: NextResponse.json({ error: 'Nie udało się odczytać danych.' }, { status: 400 }) }
  if (Buffer.byteLength(text) > maxBytes) return { error: NextResponse.json({ error: 'Wpis jest zbyt duży.' }, { status: 413 }) }
  try {
    return { body: JSON.parse(text) as unknown }
  } catch {
    return { error: NextResponse.json({ error: 'Nieprawidłowy JSON.' }, { status: 400 }) }
  }
}

export function requestOrigin(request: Request) {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const url = new URL(request.url)
  const host = forwardedHost || request.headers.get('host') || url.host
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)
  const protocol = forwardedProto || (isLocal ? url.protocol.replace(':', '') : 'https')
  return `${protocol}://${host}`
}
