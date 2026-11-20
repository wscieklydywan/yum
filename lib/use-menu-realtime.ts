'use client'

import { useEffect } from 'react'
import { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { authorizeRealtime, removeChannelsForTopic } from '@/lib/realtime-mode'

const MENU_TOPIC = 'workshop:menu'

const isMenuKey = (key: unknown) => {
  const value = Array.isArray(key) ? key[0] : key
  return typeof value === 'string' && (value.startsWith('/api/menu') || value.startsWith('/api/workshop/menu'))
}

let subscribers = 0
let teardown: (() => void) | null = null
let refreshTimer: number | undefined

function revalidateMenu() {
  window.clearTimeout(refreshTimer)
  refreshTimer = window.setTimeout(() => void mutate(isMenuKey), 150)
}

function start() {
  const supabase = createClient()
  let channel: ReturnType<typeof supabase.channel> | null = null
  let retryTimer: number | undefined
  let stopped = false
  let everSubscribed = false

  const connect = async () => {
    if (stopped) return
    await authorizeRealtime(supabase)
    await removeChannelsForTopic(supabase, MENU_TOPIC)
    if (stopped || channel) return
    const next = supabase.channel(MENU_TOPIC, { config: { private: true } }).on('broadcast', { event: 'refresh' }, revalidateMenu)
    channel = next.subscribe((status) => {
      // A removed channel still reports CLOSED; it must not tear down its replacement.
      if (channel !== next) return
      // The first subscribe happens right after SWR's initial fetch; only a reconnect can have missed changes.
      if (status === 'SUBSCRIBED') {
        if (everSubscribed) revalidateMenu()
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

  // Returning to the tab is already covered by SWR's revalidateOnFocus.
  void connect()
  window.addEventListener('online', revalidateMenu)

  return () => {
    stopped = true
    window.clearTimeout(retryTimer)
    window.removeEventListener('online', revalidateMenu)
    if (channel) void supabase.removeChannel(channel)
  }
}

/** Staff-only: keeps every menu SWR cache in sync via one shared Realtime channel. Customers rely on focus revalidation + server-side order checks instead. */
export function useMenuRealtime(enabled = true) {
  useEffect(() => {
    if (!enabled) return
    subscribers += 1
    if (subscribers === 1) teardown = start()
    return () => {
      subscribers -= 1
      if (subscribers === 0) {
        teardown?.()
        teardown = null
      }
    }
  }, [enabled])
}
