'use client'

import { useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, HelpCircle, Info, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PosnetPrinter, type PosnetPrinterStatus } from '@/lib/native-posnet'

type PartialStatus = {
  mechanismCode: number | null
  mechanism: string | null
  deviceCode: number | null
  device: string | null
  queueEmpty: boolean | null
  paperNearEnd: boolean | null
  transactionOpen: boolean | null
  checkedAt: string | number | null
}

type Reading =
  | { kind: 'status'; status: PartialStatus; readAt: Date }
  | { kind: 'error'; message: string; readAt: Date }

function readErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : ''
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  if (code === 'UNIMPLEMENTED' || /not implemented/i.test(message)) {
    return 'Ta wersja aplikacji Android nie obsługuje odczytu statusu kasy. Zainstaluj nową APK.'
  }
  return message || 'Nie udało się odczytać statusu kasy.'
}

const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const bool = (value: unknown) => (typeof value === 'boolean' ? value : null)
const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)

function normalizeStatus(value: Partial<PosnetPrinterStatus> | null | undefined): PartialStatus {
  const raw = (value ?? {}) as Record<string, unknown>
  return {
    mechanismCode: num(raw.mechanismCode),
    mechanism: str(raw.mechanism),
    deviceCode: num(raw.deviceCode),
    device: str(raw.device),
    queueEmpty: bool(raw.queueEmpty),
    paperNearEnd: bool(raw.paperNearEnd),
    transactionOpen: bool(raw.transactionOpen),
    checkedAt: typeof raw.checkedAt === 'string' || typeof raw.checkedAt === 'number' ? raw.checkedAt : null,
  }
}

function isIncomplete(status: PartialStatus) {
  return status.mechanismCode === null || status.deviceCode === null || status.queueEmpty === null
    || status.paperNearEnd === null || status.transactionOpen === null
}

function formatTime(value: string | number | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'medium' })
}

type Tone = 'ok' | 'warn' | 'error' | 'unknown'

const toneClass: Record<Tone, string> = {
  ok: 'text-emerald-700',
  warn: 'text-amber-700',
  error: 'text-red-700',
  unknown: 'text-[#6f6963]',
}

const toneIcon = { ok: CheckCircle2, warn: AlertTriangle, error: XCircle, unknown: HelpCircle }

function StatusRow({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  const Icon = toneIcon[tone]
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className="text-[13px] font-semibold text-[#48423d]">{label}</dt>
      <dd className={`flex items-start gap-1.5 text-right text-[13px] font-semibold ${toneClass[tone]}`}>
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{value}</span>
      </dd>
    </div>
  )
}

function codeRow(code: number | null, text: string | null): { value: string; tone: Tone } {
  if (code === null) return { value: text ? `${text} (brak kodu)` : 'Brak danych', tone: 'unknown' }
  return { value: `${text || (code === 0 ? 'OK' : 'Zgłasza błąd')} (kod ${code})`, tone: code === 0 ? 'ok' : 'error' }
}

function flagRow(flag: boolean | null, whenTrue: string, whenFalse: string, trueTone: Tone, falseTone: Tone): { value: string; tone: Tone } {
  if (flag === null) return { value: 'Brak danych', tone: 'unknown' }
  return flag ? { value: whenTrue, tone: trueTone } : { value: whenFalse, tone: falseTone }
}

function Notice({ tone, title, children }: { tone: 'info' | 'warn'; title: string; children: React.ReactNode }) {
  const Icon = tone === 'warn' ? AlertTriangle : Info
  const cls = tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-[#e6e0d9] bg-[#fcfaf7] text-[#48423d]'
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${cls}`}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-bold">{title}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  )
}

/** Optional, on-demand diagnostics only: status is read when the button is clicked and never gates connection tests or printing. */
export function PosnetPrinterDiagnostics({ disabled }: { disabled?: boolean }) {
  const [checking, setChecking] = useState(false)
  const [reading, setReading] = useState<Reading | null>(null)

  async function checkStatus() {
    if (checking) return
    setChecking(true)
    try {
      const status = normalizeStatus(await PosnetPrinter.getPrinterStatus())
      setReading({ kind: 'status', status, readAt: new Date() })
      const problem = (status.mechanismCode ?? 0) !== 0 || (status.deviceCode ?? 0) !== 0
      if (problem) toast.warning('Kasa zgłasza problem', { description: 'Szczegóły w diagnostyce. Status jest tylko informacyjny.' })
      else if (isIncomplete(status)) toast.info('Odczytano niepełny status kasy.')
      else if (status.paperNearEnd || status.transactionOpen || status.queueEmpty === false) toast.warning('Status odczytany z ostrzeżeniami.')
      else toast.success('Status kasy odczytany — brak problemów.')
    } catch (error) {
      const message = readErrorMessage(error)
      setReading({ kind: 'error', message, readAt: new Date() })
      toast.error('Błąd odczytu statusu kasy', { description: message })
    } finally {
      setChecking(false)
    }
  }

  const status = reading?.kind === 'status' ? reading.status : null
  const mechanism = status ? codeRow(status.mechanismCode, status.mechanism) : null
  const device = status ? codeRow(status.deviceCode, status.device) : null
  const problem = mechanism?.tone === 'error' || device?.tone === 'error'
  const incomplete = !!status && isIncomplete(status)

  return (
    <div className="flex flex-col gap-3 border-t border-[#f0ece7] pt-4">
      <div>
        <h3 className="text-sm font-bold text-[#2b2622]">Diagnostyka kasy (opcjonalnie)</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-[#847c74]">Odczyt stanu mechanizmu i urządzenia tylko na żądanie. Nie wpływa na test połączenia ani drukowanie i nie jest nigdzie zapisywany.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => void checkStatus()} disabled={disabled || checking}>
          <Activity data-icon="inline-start" aria-hidden="true" />
          {checking ? 'Sprawdzanie…' : 'Sprawdź status kasy'}
        </Button>
        {reading && <span className="text-xs text-[#6f6963]">Odczyt: {formatTime(reading.readAt)}</span>}
      </div>

      <div aria-live="polite" className="flex flex-col gap-3">
        {reading?.kind === 'error' && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">
            <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-bold">Nie udało się odczytać statusu kasy</p>
              <p className="mt-0.5">{reading.message}</p>
              <p className="mt-1 text-xs text-red-800">Stan kasy jest nieznany. Możesz dalej pracować — test połączenia i drukowanie działają niezależnie od tego odczytu.</p>
            </div>
          </div>
        )}

        {status && mechanism && device && (
          <>
            {problem ? (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">
                <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-bold">Kasa zgłasza problem</p>
                  <p className="mt-0.5">Sprawdź kasę (np. papier, pokrywa). Jeśli problem uniemożliwi druk, kasa lub aplikacja pokaże komunikat przy wydruku.</p>
                </div>
              </div>
            ) : incomplete ? (
              <Notice tone="info" title="Status niepełny">Kasa nie zwróciła wszystkich pól. Brakujące wartości oznaczono jako „Brak danych”. Praca nie jest blokowana.</Notice>
            ) : (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p className="font-bold">Mechanizm i urządzenie bez błędów</p>
              </div>
            )}

            {status.paperNearEnd && (
              <Notice tone="warn" title="Kończy się papier.">Wymień rolkę przed kolejnymi paragonami.</Notice>
            )}

            {status.transactionOpen && (
              <Notice tone="warn" title="Na kasie jest otwarta transakcja.">Użyj „Odzyskaj paragon”, aby ją rozliczyć — nie drukuj paragonu ponownie.</Notice>
            )}

            <dl className="divide-y divide-[#f0ece7] rounded-xl border border-[#f0ece7] bg-[#fcfaf7] px-3">
              <StatusRow label="Mechanizm" {...mechanism} />
              <StatusRow label="Urządzenie" {...device} />
              <StatusRow label="Kolejka" {...flagRow(status.queueEmpty, 'Pusta', 'Oczekują komendy', 'ok', 'warn')} />
              <StatusRow label="Papier" {...flagRow(status.paperNearEnd, 'Kończy się', 'OK', 'warn', 'ok')} />
              <StatusRow label="Transakcja" {...flagRow(status.transactionOpen, 'Otwarta', 'Brak otwartej', 'warn', 'ok')} />
              <div className="flex items-start justify-between gap-3 py-2">
                <dt className="text-[13px] font-semibold text-[#48423d]">Odczyt kasy</dt>
                <dd className="text-right text-[13px] text-[#6f6963]">{status.checkedAt !== null ? formatTime(status.checkedAt) : 'Brak danych'}</dd>
              </div>
            </dl>
          </>
        )}
      </div>
    </div>
  )
}
