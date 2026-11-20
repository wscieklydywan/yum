'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { CheckCircle2, Clock, History, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'

type RecoveryRequest = { status: 'pending' | 'done' | 'rejected'; points_awarded: number | null; created_at: string; handled_at: string | null }

const RECOVERY_KEY = '/api/club/points-recovery'

async function fetchRecovery(url: string): Promise<{ request: RecoveryRequest | null }> {
  const response = await fetch(url, { credentials: 'same-origin' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? 'Nie udało się sprawdzić zgłoszenia.')
  return data
}

const formatDate = (value: string) => new Date(value).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })

export function ClubPointsRecovery({ phone }: { phone: string | null }) {
  const { data, isLoading, mutate } = useSWR(RECOVERY_KEY, fetchRecovery)
  const [sending, setSending] = useState(false)
  const request = data?.request ?? null

  async function send() {
    setSending(true)
    const response = await fetch(RECOVERY_KEY, { method: 'POST' }).catch(() => null)
    const body = (await response?.json().catch(() => null)) as { request?: RecoveryRequest; error?: string } | null
    setSending(false)
    if (!response?.ok || !body?.request) {
      toast.error(body?.error ?? 'Nie udało się wysłać zgłoszenia.')
      void mutate()
      return
    }
    await mutate({ request: body.request }, { revalidate: false })
    toast.success('Zgłoszenie wysłane')
  }

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
        <h3 className="text-sm font-bold">Punkty ze starej aplikacji</h3>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground" role="status">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Sprawdzamy…
        </div>
      ) : request?.status === 'pending' ? (
        <div className="mt-3 flex items-start gap-3 rounded-2xl bg-muted/60 p-3.5" role="status">
          <Clock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm leading-relaxed">
            <b>Zgłoszenie w realizacji</b>{' '}
            <span className="text-muted-foreground">od {formatDate(request.created_at)}</span>
          </p>
        </div>
      ) : request?.status === 'done' ? (
        <div className="mt-3 flex items-start gap-3 rounded-2xl bg-emerald-50 p-3.5 text-emerald-900" role="status">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="text-sm leading-relaxed">
            <b>Odzyskano {request.points_awarded} pkt.</b> Punkty ze starej aplikacji są już na Twoim koncie.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pt-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {request?.status === 'rejected'
              ? 'Nie znaleźliśmy punktów dla Twoich danych. Sprawdź numer telefonu i spróbuj ponownie.'
              : 'Masz punkty z poprzedniej aplikacji? Przeniesiemy je na to konto.'}
          </p>
          {!phone && <p className="text-xs font-medium text-destructive">Uzupełnij numer telefonu, aby łatwiej było Cię odnaleźć.</p>}
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending}
            className="flex h-11 items-center justify-center gap-2 self-start rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {sending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <History className="size-4" aria-hidden="true" />}
            Odzyskaj punkty
          </button>
        </div>
      )}
    </div>
  )
}
