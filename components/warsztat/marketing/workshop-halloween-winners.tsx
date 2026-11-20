'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Loader2, Mail, Square, Trophy } from 'lucide-react'
import { prizeLabel } from '@/lib/halloween'
import { fetchJson } from './economics-parts'

type Winner = {
  place: number
  score: number
  prize: string
  stars: number
  code: string | null
  expires_at: string | null
  email_sent_at: string | null
  email_error: string | null
  redeemed: boolean
  name: string
  email: string | null
}

type WinnersData = { winners: Winner[]; ends_at: string | null; finalized_at: string | null; email_configured: boolean }

type Action = 'end_now' | 'finalize' | 'resend'
const actionMessages: Record<Action, string> = {
  end_now: 'Gra zakończona, zwycięzcy zapisani',
  finalize: 'Zwycięzcy zapisani',
  resend: 'Ponowiono wysyłkę maili',
}

const KEY = '/api/workshop/halloween/winners'
const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

export function WorkshopHalloweenWinners() {
  const { data, error, isLoading, mutate } = useSWR<WinnersData>(KEY, fetchJson)
  const [busy, setBusy] = useState<Action | null>(null)

  async function run(action: Action) {
    setBusy(action)
    try {
      const response = await fetch(KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error ?? 'Operacja nie powiodła się.')
      await mutate(result, { revalidate: false })
      toast.success(actionMessages[action])
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Operacja nie powiodła się.')
    } finally {
      setBusy(null)
    }
  }

  if (error) return <p className="rounded-xl bg-red-50 p-3 sm:p-4 text-sm text-red-700">{error.message}</p>
  if (isLoading || !data) return <div className="flex justify-center p-4 sm:p-6"><Loader2 className="size-5 animate-spin text-primary" aria-label="Wczytywanie" /></div>

  const ended = data.ends_at ? new Date(data.ends_at) <= new Date() : false
  const failedEmails = data.winners.some((winner) => !winner.email_sent_at)

  return (
    <section aria-labelledby="hw-winners" className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="hw-winners" className="flex items-center gap-2 text-base font-black text-zinc-900"><Trophy className="size-4 text-primary" aria-hidden="true" />Zwycięzcy</h2>
          <p className="text-sm text-zinc-500">
            {data.finalized_at
              ? `Rozstrzygnięto ${formatDate(data.finalized_at)}. Top 3 dostało kody na jedzenie, miejsca 4–10 Stars.`
              : ended
                ? 'Gra zakończona – zwycięzcy zostaną zapisani automatycznie (lub kliknij przycisk).'
                : `Po końcu gry (${data.ends_at ? formatDate(data.ends_at) : '–'}) top 3 dostanie kod na jedzenie, a miejsca 4–10 po 20 Stars – wszyscy dostaną maila.`}
          </p>
          {!data.email_configured && <p className="mt-1 text-xs font-semibold text-red-700">Brak konfiguracji Resend – maile nie zostaną wysłane.</p>}
        </div>
        <div className="flex gap-2">
          {!ended && !data.finalized_at && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Zakończyć grę teraz? Zwycięzcy zostaną zapisani, a maile wysłane od razu.')) run('end_now')
              }}
              disabled={busy !== null}
              className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-60"
            >
              {busy === 'end_now' ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Square className="size-4" aria-hidden="true" />}
              Zakończ grę teraz
            </button>
          )}
          {ended && !data.finalized_at && (
            <button type="button" onClick={() => run('finalize')} disabled={busy !== null} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">
              {busy === 'finalize' ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trophy className="size-4" aria-hidden="true" />}
              Rozstrzygnij teraz
            </button>
          )}
          {data.finalized_at && failedEmails && (
            <button type="button" onClick={() => run('resend')} disabled={busy !== null} className="flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-900 disabled:opacity-60">
              {busy === 'resend' ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Mail className="size-4" aria-hidden="true" />}
              Wyślij ponownie
            </button>
          )}
        </div>
      </div>

      {data.winners.length > 0 && (
        <ol className="divide-y divide-zinc-100">
          {data.winners.map((winner) => (
            <li key={winner.place} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
              <span className="w-6 font-black text-primary">{winner.place}.</span>
              <span className="min-w-40 flex-1">
                <span className="block font-bold text-zinc-900">{winner.name} · {winner.score} pkt</span>
                <span className="block text-xs text-zinc-500">{winner.email ?? 'brak e-maila'} · {prizeLabel(winner.prize)}</span>
              </span>
              {winner.code && <span className="font-mono font-black tracking-widest text-zinc-900">{winner.code}</span>}
              <span className="flex gap-1.5 text-[11px] font-bold">
                {winner.code && winner.expires_at ? (
                  <span className={winner.redeemed ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700' : 'rounded-full bg-amber-50 px-2 py-0.5 text-amber-700'}>
                    {winner.redeemed ? 'Odebrano' : `Do odbioru do ${formatDate(winner.expires_at)}`}
                  </span>
                ) : (
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">+{winner.stars} Stars dodane</span>
                )}
                <span
                  title={winner.email_error ?? undefined}
                  className={winner.email_sent_at ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700' : 'rounded-full bg-red-50 px-2 py-0.5 text-red-700'}
                >
                  {winner.email_sent_at ? 'Mail wysłany' : 'Mail niewysłany'}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {data.finalized_at && data.winners.length === 0 && <p className="text-sm text-zinc-500">Brak zakwalifikowanych graczy.</p>}
    </section>
  )
}
