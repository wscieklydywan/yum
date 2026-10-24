'use client'

import { useEffect } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import { createClient } from '@/lib/supabase/client'

export type CustomerOrderStatus = 'new' | 'preparing' | 'ready' | 'handed_off' | 'cancelled'

export type CustomerOrder = {
  number: number | string
  status: CustomerOrderStatus
  type: string
  items: { name: string; quantity: number; unitPrice: number | null; options?: string }[]
  subtotal: number
  discount: number
  delivery_fee: number
  total: number
  club_savings: number
  loyalty_points: number | null
  payment_method: string | null
  note: string | null
  scheduled_for: string | null
  created_at: string
  ready_at?: string | null
  handed_off_at?: string | null
}

export const CUSTOMER_ORDERS_KEY = '/api/yummy-club/orders'

const ACTIVE_STATUSES: CustomerOrderStatus[] = ['new', 'preparing', 'ready']
const TRACKING_WINDOW_MS = 12 * 60 * 60 * 1000
const FINISHED_VISIBLE_MS = 2 * 60 * 60 * 1000
const DELIVERY_FINISHED_VISIBLE_MS = 15 * 60 * 1000
let subscribers = 0
let teardown: (() => void) | null = null
let refreshTimer: number | undefined

function revalidateOrders() {
  window.clearTimeout(refreshTimer)
  refreshTimer = window.setTimeout(() => void globalMutate(CUSTOMER_ORDERS_KEY), 300)
}

/**
 * Listens on the customer's private Broadcast topic. The DB trigger sends one message only when
 * staff change an order's status, so the orders API is hit exactly once per real change.
 */
function startStatusSignal() {
  const supabase = createClient()
  let channel: ReturnType<typeof supabase.channel> | null = null
  let retryTimer: number | undefined
  let stopped = false
  let everSubscribed = false

  const connect = async () => {
    if (stopped) return
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user.id
    if (!userId || stopped) return
    await supabase.realtime.setAuth(session.access_token)
    channel = supabase
      .channel(`customer-orders:${userId}`, { config: { private: true } })
      .on('broadcast', { event: 'status' }, revalidateOrders)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // After a reconnect we may have missed a signal, so catch up once.
          if (everSubscribed) revalidateOrders()
          everSubscribed = true
        }
        if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !stopped) {
          const failed = channel
          channel = null
          if (failed) void supabase.removeChannel(failed)
          window.clearTimeout(retryTimer)
          retryTimer = window.setTimeout(() => void connect(), 5000)
        }
      })
  }

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED' && session?.access_token) void supabase.realtime.setAuth(session.access_token)
  })

  void connect()
  return () => {
    stopped = true
    window.clearTimeout(retryTimer)
    subscription.unsubscribe()
    if (channel) void supabase.removeChannel(channel)
  }
}

const HIDDEN_DISCONNECT_MS = 30_000

/**
 * Keeps the socket only while the tab is visible, so phones with the page left in the background
 * don't hold one of the project's limited Realtime connections. On return, SWR refetches once.
 */
function startVisibleStatusSignal() {
  let stopSignal: (() => void) | null = document.visibilityState === 'visible' ? startStatusSignal() : null
  let hideTimer: number | undefined

  const onVisibilityChange = () => {
    window.clearTimeout(hideTimer)
    if (document.visibilityState === 'hidden') {
      hideTimer = window.setTimeout(() => {
        stopSignal?.()
        stopSignal = null
      }, HIDDEN_DISCONNECT_MS)
    } else if (!stopSignal) {
      stopSignal = startStatusSignal()
      revalidateOrders()
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.clearTimeout(hideTimer)
    stopSignal?.()
  }
}

export function isActiveOrder(order: CustomerOrder, now = Date.now()) {
  return ACTIVE_STATUSES.includes(order.status) && now - new Date(order.created_at).getTime() < TRACKING_WINDOW_MS
}

/** When a finished order should disappear from live tracking (delivery: 15 min after hand-off). */
export function trackingEndsAt(order: CustomerOrder) {
  if (order.status !== 'handed_off') return null
  if (order.type === 'Dostawa') {
    const handedOff = new Date(order.handed_off_at ?? order.created_at).getTime()
    return handedOff + DELIVERY_FINISHED_VISIBLE_MS
  }
  return new Date(order.created_at).getTime() + FINISHED_VISIBLE_MS
}

/** Active orders plus recently finished ones, so the customer still sees the final step. */
export function isTrackableOrder(order: CustomerOrder, now = Date.now()) {
  if (isActiveOrder(order, now)) return true
  const endsAt = trackingEndsAt(order)
  return endsAt !== null && now < endsAt
}

async function fetchCustomerOrders(url: string): Promise<CustomerOrder[]> {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' })
  if (!response.ok) throw new Error('Nie udało się pobrać zamówień.')
  const result = await response.json() as { orders?: CustomerOrder[] }
  return result.orders ?? []
}

/**
 * One shared SWR cache for history and live tracking. No polling: while an order is in progress the
 * client waits for a push signal from the DB and refetches only then. Idle accounts open no socket.
 */
export function useCustomerOrders() {
  const swr = useSWR(CUSTOMER_ORDERS_KEY, fetchCustomerOrders, {
    revalidateOnFocus: true,
    focusThrottleInterval: 10_000,
    dedupingInterval: 5_000,
    errorRetryCount: 3,
  })

  const hasActiveOrder = (swr.data ?? []).some((order) => isActiveOrder(order))

  useEffect(() => {
    if (!hasActiveOrder) return
    subscribers += 1
    if (subscribers === 1) teardown = startVisibleStatusSignal()
    return () => {
      subscribers -= 1
      if (subscribers === 0) {
        teardown?.()
        teardown = null
      }
    }
  }, [hasActiveOrder])

  return swr
}
