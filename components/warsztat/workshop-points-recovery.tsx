'use client'

import { useEffect, useState, type FormEvent } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import { Check, History, LoaderCircle, Mail, Phone, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { authorizeRealtime, removeChannelsForTopic } from '@/lib/realtime-mode'
import { formatPhone } from '@/lib/phone'
import { cn } from '@/lib/utils'

type RecoveryRequest = {
  id: string
  email: string
  phone: string | null
  full_name: string | null
  status: 'pending' | 'done' | 'rejected'
  points_awarded: number | null
  staff_note: string | null
  handled_at: string | null
  created_at: string
}
type RecoveryData = { pending: RecoveryRequest[]; handled: RecoveryRequest[] }

const RECOVERY_KEY = '/api/workshop/points-recovery'
const POINTS_TOPIC = 'workshop:points'

async function fetchRequests(url: string): Promise<RecoveryData> {
  const response = await fetch(url, { credentials: 'same-origin' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? 'Nie udało się wczytać zgłoszeń.')
  return data
}

let subscribers = 0
let teardown: (() => void) | null = null

const revalidateRequests = () => void globalMutate(RECOVERY_KEY)

// One shared private Broadcast channel; the DB trigger sends a bare "refresh" signal only when a request changes.
function startRealtime() {
  const supabase = createClient()
  let channel: ReturnType<typeof supabase.channel> | null = null
  let retryTimer: number | undefined
  let stopped = false
  let everSubscribed = false

  const connect = async () => {
    if (stopped) return
    await authorizeRealtime(supabase)
    await removeChannelsForTopic(supabase, POINTS_TOPIC)
    if (stopped || channel) return
    const next = supabase.channel(POINTS_TOPIC, { config: { private: true } }).on('broadcast', { event: 'refresh' }, revalidateRequests)
    channel = next.subscribe((status) => {
      if (channel !== next) return
      // Only a reconnect can have missed a signal; the first subscribe follows SWR's initial fetch.
      if (status === 'SUBSCRIBED') {
        if (everSubscribed) revalidateRequests()
        everSubscribed = true
      }
      if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') && !stopped) {
        const failed = channel
        channel = null
        if (failed) void supabase.removeChannel(failed)
        window.clearTimeout(retryTimer)
        retryTimer = window.setTimeout(() => void connect(), 3000)
      }
    })
  }

  void connect()
  window.addEventListener('online', revalidateRequests)
  return () => {
    stopped = true
    window.clearTimeout(retryTimer)
    window.removeEventListener('online', revalidateRequests)
    if (channel) void supabase.removeChannel(channel)
  }
}

export function usePointsRecoveryRequests(enabled = true) {
  useEffect(() => {
    if (!enabled) return
    subscribers += 1
    if (subscribers === 1) teardown = startRealtime()
    return () => {
      subscribers -= 1
      if (subscribers === 0) {
        teardown?.()
        teardown = null
      }
    }
  }, [enabled])
  return useSWR(enabled ? RECOVERY_KEY : null, fetchRequests)
}

const formatDateTime = (value: string) => new Date(value).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function PendingRow({ request, onDone }: { request: RecoveryRequest; onDone: () => Promise<unknown> }) {
  const [points, setPoints] = useState('')
  const [busy, setBusy] = useState<'award' | 'reject' | null>(null)

  async function send(action: 'award' | 'reject') {
    const amount = Number(points)
    if (action === 'award' && (!Number.isInteger(amount) || amount < 1)) return toast.error('Wpisz liczbę punktów ze starego systemu.')
    setBusy(action)
    const response = await fetch(RECOVERY_KEY, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: request.id, action, points: amount }),
    }).catch(() => null)
    const data = (await response?.json().catch(() => null)) as { error?: string } | null
    setBusy(null)
    if (!response?.ok) {
      toast.error(data?.error ?? 'Operacja nie powiodła się.')
      if (response?.status === 409) void onDone()
      return
    }
    toast.success(action === 'award' ? `Przyznano ${amount} pkt` : 'Zgłoszenie zamknięte')
    await onDone()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void send('award')
  }

  const inputId = `recovery-points-${request.id}`
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3 sm:p-4 shadow-[0_1px_2px_rgba(33,30,27,0.04)]">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">{request.full_name || 'Bez imienia'}</p>
        <p className="text-[11px] text-zinc-500">Zgłoszono {formatDateTime(request.created_at)}</p>
      </div>
      <dl className="flex flex-col gap-1.5 text-[13px]">
        <div className="flex items-center gap-2"><dt><Phone className="size-3.5 text-zinc-500" aria-label="Telefon" /></dt><dd className="font-semibold tabular-nums">{request.phone ? formatPhone(request.phone) : 'brak'}</dd></div>
        <div className="flex min-w-0 items-center gap-2"><dt><Mail className="size-3.5 text-zinc-500" aria-label="E-mail" /></dt><dd className="min-w-0 truncate font-semibold">{request.email}</dd></div>
      </dl>
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <label htmlFor={inputId} className="sr-only">Punkty ze starego systemu</label>
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={1}
          max={100000}
          value={points}
          onChange={(event) => setPoints(event.target.value)}
          placeholder="Punkty"
          className="h-9 w-28 rounded-xl border border-zinc-200 bg-white px-3 text-sm tabular-nums outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20"
        />
        <Button type="submit" disabled={busy !== null} className="h-9 gap-1.5 rounded-xl px-3 text-xs font-bold">
          {busy === 'award' ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Check data-icon="inline-start" />}
          Przyznaj
        </Button>
        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void send('reject')} className="h-9 gap-1.5 rounded-xl border-zinc-200 px-3 text-xs font-bold">
          {busy === 'reject' ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <X data-icon="inline-start" />}
          Brak punktów
        </Button>
      </form>
    </li>
  )
}

export function WorkshopPointsRecovery() {
  const { data, error, isLoading, mutate } = usePointsRecoveryRequests()
  const pending = data?.pending ?? []
  const handled = data?.handled ?? []

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">Yummy Club</p>
        <h1 className="mt-1 text-[21px] font-extrabold tracking-tight sm:text-[24px]">Punkty ze starej aplikacji</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">Sprawdź klienta w starym systemie po telefonie lub e-mailu i wpisz, ile miał punktów.</p>
      </div>
      {isLoading ? (
        <p className="flex items-center gap-2 py-6 text-sm text-zinc-500" role="status"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Wczytywanie…</p>
      ) : error ? (
        <p role="alert" className="py-6 text-sm font-medium text-destructive">{error.message}</p>
      ) : <>
        <section aria-labelledby="recovery-pending" className="flex flex-col gap-2.5">
          <h2 id="recovery-pending" className="flex items-center gap-2 text-[15px] font-bold"><History className="size-[17px] text-primary" aria-hidden="true" />Do sprawdzenia ({pending.length})</h2>
          {pending.length === 0
            ? <p className="rounded-xl border border-dashed border-zinc-200 p-3.5 sm:p-5 text-center text-sm text-zinc-500">Brak nowych zgłoszeń.</p>
            : <ul className="grid gap-2.5 sm:grid-cols-2">{pending.map((request) => <PendingRow key={request.id} request={request} onDone={() => mutate()} />)}</ul>}
        </section>
        {handled.length > 0 && <section aria-labelledby="recovery-handled" className="flex flex-col gap-2">
          <h2 id="recovery-handled" className="text-[15px] font-bold">Ostatnio obsłużone</h2>
          <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
            {handled.map((request) => <li key={request.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
              <span className="min-w-0 truncate">{request.full_name || request.email}{request.phone && <span className="text-zinc-500"> · {formatPhone(request.phone)}</span>}</span>
              <span className={cn('shrink-0 font-bold tabular-nums', request.status === 'done' ? 'text-emerald-700' : 'text-zinc-500')}>{request.status === 'done' ? `+${request.points_awarded} pkt` : 'Brak punktów'}</span>
            </li>)}
          </ul>
        </section>}
      </>}
    </div>
  )
}
