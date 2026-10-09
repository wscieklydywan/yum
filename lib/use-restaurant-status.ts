'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { computeStatus, type RestaurantStatus } from './restaurant-status'

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

  const connect = () => {
    if (stopped) return
    channel = supabase
      .channel(`restaurant-status-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_settings' }, revalidateStatus)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') revalidateStatus()
        if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') && !stopped) {
          const failed = channel
          channel = null
          if (failed) void supabase.removeChannel(failed)
          window.clearTimeout(retryTimer)
          retryTimer = window.setTimeout(connect, 3000)
        }
      })
  }

  connect()
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

export function useRestaurantStatus() {
  useEffect(() => {
    subscribers += 1
    if (subscribers === 1) teardown = startRealtime()
    return () => {
      subscribers -= 1
      if (subscribers === 0) {
        teardown?.()
        teardown = null
      }
    }
  }, [])

  const { data, error, isLoading, mutate } = useSWR<RestaurantStatus>(RESTAURANT_STATUS_KEY, fetchStatus, {
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
