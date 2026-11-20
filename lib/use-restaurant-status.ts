'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { computeStatus, type RestaurantStatus } from './restaurant-status'
import { authorizeRealtime, removeChannelsForTopic } from './realtime-mode'

const SETTINGS_TOPIC = 'workshop:settings'

export const RESTAURANT_STATUS_KEY = '/api/restaurant/status'

async function fetchStatus(url: string): Promise<RestaurantStatus> {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (!response.ok) throw new Error('Nie udało się sprawdzić statusu lokalu')
  return response.json()
}

let subscribers = 0
let teardown: (() => void) | null = null
let refreshTimer: number | undefined

function revalidateStatus() {
  window.clearTimeout(refreshTimer)
  refreshTimer = window.setTimeout(() => void globalMutate(RESTAURANT_STATUS_KEY), 150)
}

function startRealtime() {
  const supabase = createClient()
  let channel: ReturnType<typeof supabase.channel> | null = null
  let retryTimer: number | undefined
  let stopped = false
  let everSubscribed = false

  const connect = async () => {
    if (stopped) return
    await authorizeRealtime(supabase)
    await removeChannelsForTopic(supabase, SETTINGS_TOPIC)
    if (stopped || channel) return
    const next = supabase.channel(SETTINGS_TOPIC, { config: { private: true } }).on('broadcast', { event: 'refresh' }, revalidateStatus)
    channel = next.subscribe((status) => {
        // A removed channel still reports CLOSED; it must not tear down its replacement.
        if (channel !== next) return
        if (status === 'SUBSCRIBED') {
          if (everSubscribed) revalidateStatus()
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
  window.addEventListener('online', revalidateStatus)
  return () => {
    stopped = true
    window.clearTimeout(retryTimer)
    window.removeEventListener('online', revalidateStatus)
    if (channel) void supabase.removeChannel(channel)
  }
}

/** One minute tick so opening/closing by the clock is reflected without asking the server. */
function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

/**
 * `enabled: false` skips the fetch for always-mounted UI (e.g. the closed cart).
 * `realtime: true` is for staff screens only; customers get focus revalidation and the server rejects orders when closed.
 */
export function useRestaurantStatus({ enabled = true, realtime = false }: { enabled?: boolean; realtime?: boolean } = {}) {
  useEffect(() => {
    if (!enabled || !realtime) return
    subscribers += 1
    if (subscribers === 1) teardown = startRealtime()
    return () => {
      subscribers -= 1
      if (subscribers === 0) {
        teardown?.()
        teardown = null
      }
    }
  }, [enabled, realtime])

  const { data, error, isLoading, mutate } = useSWR<RestaurantStatus>(enabled ? RESTAURANT_STATUS_KEY : null, fetchStatus, {
    revalidateOnFocus: true,
  })
  const now = useMinuteClock()
  const status = useMemo(() => (data ? computeStatus(data, new Date(now)) : undefined), [data, now])
  return { status, error, isLoading, mutate }
}

export async function updateRestaurant(body: Record<string, unknown>) {
  const response = await fetch('/api/workshop/restaurant', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => ({})) as { status?: RestaurantStatus; reportId?: string | null; error?: string }
  if (!response.ok || !result.status) throw new Error(result.error ?? 'Nie udało się zapisać zmian.')
  return { status: result.status, reportId: result.reportId ?? null }
}
