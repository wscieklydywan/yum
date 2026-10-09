'use client'

import { useEffect } from 'react'
import { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'

const MENU_TABLES = ['menu_products', 'menu_categories', 'menu_product_variants', 'menu_modifier_options', 'menu_modifier_groups'] as const

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

  const connect = () => {
    if (stopped) return
    let next = supabase.channel(`menu-live-${Math.random().toString(36).slice(2)}`)
    for (const table of MENU_TABLES) next = next.on('postgres_changes', { event: '*', schema: 'public', table }, revalidateMenu)
    channel = next.subscribe((status) => {
      if (status === 'SUBSCRIBED') revalidateMenu()
      if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') && !stopped) {
        const failed = channel
        channel = null
        if (failed) void supabase.removeChannel(failed)
        window.clearTimeout(retryTimer)
        retryTimer = window.setTimeout(connect, 3000)
      }
    })
  }

  const onWake = () => { if (document.visibilityState === 'visible') revalidateMenu() }
  connect()
  document.addEventListener('visibilitychange', onWake)
  window.addEventListener('online', revalidateMenu)

  return () => {
    stopped = true
    window.clearTimeout(retryTimer)
    document.removeEventListener('visibilitychange', onWake)
    window.removeEventListener('online', revalidateMenu)
    if (channel) void supabase.removeChannel(channel)
  }
}

/** Keeps every menu SWR cache in sync with the database (dish availability, prices, variants) via one shared Realtime channel. */
export function useMenuRealtime() {
  useEffect(() => {
    subscribers += 1
    if (subscribers === 1) teardown = start()
    return () => {
      subscribers -= 1
      if (subscribers === 0) {
        teardown?.()
        teardown = null
      }
    }
  }, [])
}
