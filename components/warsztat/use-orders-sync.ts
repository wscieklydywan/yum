'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { freshAccessToken, removeChannelsForTopic } from '@/lib/realtime-mode'
import { activeStatuses, orderProblems, type KitchenOrder } from './order-data'
import { orderColumns, toKitchenOrder, type DatabaseOrder } from './order-rows'

export type OrdersSyncState = {
  /** `down` only after a grace period, so a routine reconnect never flashes a banner. */
  realtime: 'live' | 'down'
  /** True only once the live channel has really been joined and verified (the initial `live` is optimistic). */
  streamConfirmed: boolean
  /** `unreachable` = the database query itself fails, i.e. orders are NOT arriving at all. */
  server: 'ok' | 'unreachable'
  lastSyncAt: number | null
  checking: boolean
  /** Why the live stream is considered down, shown in the yellow banner details. */
  streamIssue: StreamIssue | null
  /** Why the last database query failed, shown in the red banner details. */
  serverIssue: ServerIssue | null
}

export type StreamIssue = 'connecting' | 'heartbeat' | 'stale' | 'channel-error' | 'timed-out' | 'closed' | 'wake'
export type ServerIssue = 'offline' | 'timeout' | 'error'

const POLL_MS = 15_000
const STREAM_DOWN_GRACE_MS = 10_000
// Default Realtime heartbeat is 25s; two missed beats mean the socket is silently dead.
const HEARTBEAT_STALE_MS = 60_000
const QUERY_TIMEOUT_MS = 8_000
const QUICK_RETRY_MS = 3_000
const EMERGENCY_RELOAD_AFTER_MS = 10 * 60_000
const RELOAD_GUARD_KEY = 'workshop-realtime-reload-at'
const RELOAD_GUARD_MS = 30 * 60_000
const IDLE_BEFORE_RELOAD_MS = 2 * 60_000

type Options = {
  userId: string
  role: string
  ordersRef: RefObject<KitchenOrder[]>
  commitOrders: (next: KitchenOrder[]) => void
  onOrderChange: (previous: KitchenOrder | undefined, next: KitchenOrder) => void
}

const isActive = (order: KitchenOrder) => (activeStatuses as string[]).includes(order.status)

export function useOrdersSync({ userId, role, ordersRef, commitOrders, onOrderChange }: Options) {
  const [state, setState] = useState<OrdersSyncState>({ realtime: 'live', streamConfirmed: false, server: 'ok', lastSyncAt: null, checking: false, streamIssue: null, serverIssue: null })
  const commitRef = useRef(commitOrders)
  const onChangeRef = useRef(onOrderChange)
  const checkNowRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    commitRef.current = commitOrders
    onChangeRef.current = onOrderChange
  })

  useEffect(() => {
    const supabase = createClient()
    let active = true
    let channel: ReturnType<typeof supabase.channel> | null = null
    let retryTimer: number | undefined
    let streamDownTimer: number | undefined
    let quickRetryTimer: number | undefined
    let retryAttempt = 0
    let outageStartedAt: number | null = null
    let realtimeDownSince: number | null = Date.now()
    let recovered = false
    let heartbeatFailed = false
    let lastHeartbeatOkAt = 0
    let serverFailures = 0
    let serverDown = false
    let lastNotifiedAt = 0
    let initialLoaded = false
    let syncing: Promise<boolean> | null = null
    // Realtime events that land while a sync query is in flight are newer than its snapshot and must win over it.
    let eventsDuringSync: Map<string, KitchenOrder | null> | null = null
    let lastInteractionAt = Date.now()
    let lastWakeAt = 0

    const update = (patch: Partial<OrdersSyncState>) => { if (active) setState((current) => ({ ...current, ...patch })) }

    const realtimeHealthy = () => channel?.state === 'joined' && !heartbeatFailed && Date.now() - lastHeartbeatOkAt < HEARTBEAT_STALE_MS

    let streamIssue: StreamIssue = 'connecting'
    let streamDownShown = false

    const markStreamDown = (issue: StreamIssue) => {
      recovered = false
      realtimeDownSince ??= Date.now()
      streamIssue = issue
      if (streamDownShown) update({ streamIssue })
      if (streamDownTimer !== undefined) return
      streamDownTimer = window.setTimeout(() => {
        streamDownShown = true
        update({ realtime: 'down', streamIssue })
      }, STREAM_DOWN_GRACE_MS)
    }
    const markStreamUp = () => {
      window.clearTimeout(streamDownTimer)
      streamDownTimer = undefined
      streamDownShown = false
      retryAttempt = 0
      outageStartedAt = null
      realtimeDownSince = null
      recovered = true
      update({ realtime: 'live', streamConfirmed: true, streamIssue: null })
    }

    /** Pulls every active order from the database. Concurrent callers share one request. */
    const sync = (manual = false): Promise<boolean> => {
      syncing ??= (async () => {
        eventsDuringSync = new Map()
        try {
          const { data, error } = await supabase.from('orders').select(orderColumns).in('status', activeStatuses).order('created_at', { ascending: true }).abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
          if (error || !data) throw error ?? new Error('no data')
          if (!active) return false
          // Without a session RLS returns an empty list instead of an error; never wipe a full board on that.
          if (data.length === 0 && ordersRef.current.length > 0) {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) throw new Error('no session')
          }
          const freshById = new Map((data as DatabaseOrder[]).map(toKitchenOrder).map((order) => [order.databaseId, order]))
          for (const [id, order] of eventsDuringSync) {
            if (order && isActive(order)) freshById.set(id, order)
            else freshById.delete(id)
          }
          const fresh = [...freshById.values()]
          // Ring only for what changed versus the screen: orders already shown stay silent, ones missed during the outage ring once.
          // The first load must not ring for every order that was already waiting.
          if (initialLoaded) {
            const previousById = new Map(ordersRef.current.map((order) => [order.databaseId, order]))
            for (const order of fresh) {
              const previous = previousById.get(order.databaseId)
              if (!previous || previous.status !== order.status || orderProblems(previous).length !== orderProblems(order).length) {
                onChangeRef.current(previous, order)
                lastNotifiedAt = Date.now()
              }
            }
          }
          initialLoaded = true
          // Unchanged orders keep their existing objects so their cards skip re-rendering; an identical list is not committed at all.
          const current = ordersRef.current
          const currentById = new Map(current.map((order) => [order.databaseId, order]))
          const merged = fresh.map((order) => {
            const previous = currentById.get(order.databaseId)
            return previous && JSON.stringify(previous) === JSON.stringify(order) ? previous : order
          })
          if (merged.length !== current.length || merged.some((order, index) => order !== current[index])) commitRef.current(merged)
          serverFailures = 0
          serverDown = false
          window.clearTimeout(quickRetryTimer)
          update({ server: 'ok', serverIssue: null, lastSyncAt: Date.now() })
          return true
        } catch (error) {
          if (!active) return false
          serverFailures += 1
          const name = (error as { name?: string } | null)?.name
          const serverIssue: ServerIssue = !navigator.onLine ? 'offline' : name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'error'
          // A slow query while Realtime is delivering events does not mean orders stop arriving, so only a manual check
          // or a confirmed second failure (or no network at all) shows the red banner. Otherwise retry quietly.
          const confirmed = manual || !navigator.onLine || (serverFailures >= 2 && !realtimeHealthy())
          if (confirmed) {
            serverDown = true
            update({ server: 'unreachable', serverIssue })
          } else {
            window.clearTimeout(quickRetryTimer)
            quickRetryTimer = window.setTimeout(() => void sync(), QUICK_RETRY_MS)
          }
          return false
        } finally {
          syncing = null
          eventsDuringSync = null
        }
      })()
      return syncing
    }

    /** An outage only counts as over once the stream is healthy AND the board matches the database. */
    const confirmRecovery = async () => {
      if (await sync() && realtimeHealthy()) markStreamUp()
    }

    // Backoff: 2s, 4s, 8s, then every 15s for the first 5 minutes of an outage, then once a minute.
    const nextRetryDelay = () => {
      outageStartedAt ??= Date.now()
      if (Date.now() - outageStartedAt > 5 * 60_000) return 60_000
      return Math.min(2000 * 2 ** retryAttempt++, 15_000)
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) void supabase.realtime.setAuth(session.access_token)
    })

    supabase.realtime.onHeartbeat((status) => {
      if (!active) return
      if (status === 'ok') {
        lastHeartbeatOkAt = Date.now()
        heartbeatFailed = false
        if (!recovered && channel?.state === 'joined') void confirmRecovery()
      } else if (status === 'timeout' || status === 'error') {
        // realtime-js closes and reopens the socket by itself after a timeout; we only flag the outage and catch up on missed orders.
        heartbeatFailed = true
        markStreamDown('heartbeat')
        void sync()
      }
    })

    const scheduleResubscribe = (issue: StreamIssue, immediate = false) => {
      if (!active) return
      markStreamDown(issue)
      const failed = channel
      channel = null
      if (failed) void supabase.removeChannel(failed)
      window.clearTimeout(retryTimer)
      retryTimer = window.setTimeout(() => void subscribe(), immediate ? 500 : nextRetryDelay())
    }

    const subscribe = async () => {
      // Realtime must carry the user's JWT, otherwise RLS on orders filters out every event.
      // getUser() refreshes an expired token (e.g. after the tablet slept), getSession() alone would hand back a stale one.
      // freshAccessToken shares that check with the menu/status channels that reconnect at the same moment.
      const accessToken = await freshAccessToken(supabase).catch(() => null)
      if (!active) return
      if (accessToken) await supabase.realtime.setAuth(accessToken)
      if (!active || channel) return
      const applyChange = (event: string, row: DatabaseOrder | null, deletedId: string) => {
        const current = ordersRef.current
        if (event === 'DELETE' || !row) {
          eventsDuringSync?.set(deletedId, null)
          commitRef.current(current.filter((order) => order.databaseId !== deletedId))
          return
        }
        const updated = toKitchenOrder(row)
        if (updated.databaseId) eventsDuringSync?.set(updated.databaseId, updated)
        const previous = current.find((order) => order.databaseId === updated.databaseId)
        if (!isActive(updated)) {
          if (previous) commitRef.current(current.filter((order) => order.databaseId !== updated.databaseId))
          return
        }
        onChangeRef.current(previous, updated)
        commitRef.current(previous ? current.map((order) => order.databaseId === updated.databaseId ? updated : order) : [...current, updated])
      }
      // Fixed private topic; drivers get their own topic with only the orders they may see.
      const topic = role === 'kierowca' ? 'workshop:delivery' : 'workshop:orders'
      await removeChannelsForTopic(supabase, topic)
      if (!active || channel) return
      const next = supabase.channel(topic, { config: { private: true } }).on('broadcast', { event: 'order' }, ({ payload }) => {
        const message = payload as { event?: string; id?: string; record?: DatabaseOrder }
        applyChange(message.event ?? '', message.record ?? null, String(message.id ?? message.record?.id ?? ''))
      })
      channel = next.subscribe((status) => {
        // A removed channel still reports CLOSED; it must not tear down its replacement.
        if (!active || channel !== next) return
        if (status === 'SUBSCRIBED') {
          // The join reply proves the socket is alive right now.
          lastHeartbeatOkAt = Date.now()
          heartbeatFailed = false
          void confirmRecovery()
        } else if (status === 'CHANNEL_ERROR') scheduleResubscribe('channel-error')
        else if (status === 'TIMED_OUT') scheduleResubscribe('timed-out')
        else if (status === 'CLOSED') scheduleResubscribe('closed')
      })
    }

    /** Full reload is a last resort: only after a long Realtime outage, with the server confirmed reachable, while nobody is using the screen. */
    const maybeEmergencyReload = async () => {
      if (realtimeDownSince === null || Date.now() - realtimeDownSince < EMERGENCY_RELOAD_AFTER_MS) return
      if (document.visibilityState !== 'visible' || !navigator.onLine) return
      if (Date.now() - lastInteractionAt < IDLE_BEFORE_RELOAD_MS) return
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return
      let lastReloadAt: number
      try {
        lastReloadAt = Number(window.sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0)
      } catch {
        return
      }
      if (Date.now() - lastReloadAt < RELOAD_GUARD_MS) return
      if (!(await sync())) return
      // Let the sound and toast for orders that just came in finish instead of cutting them off with a reload.
      if (Date.now() - lastNotifiedAt < 60_000) return
      const page = await fetch(window.location.pathname, { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(QUERY_TIMEOUT_MS) }).catch(() => null)
      if (!active || !page?.ok || realtimeHealthy()) return
      try {
        window.sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
      } catch {
        return
      }
      window.location.reload()
    }

    const tick = () => {
      if (!active) return
      // Socket looks joined but heartbeats stopped (frozen timers, zombie connection): probe it. A pending heartbeat
      // makes realtime-js declare a timeout and reconnect, which our heartbeat callback then reports.
      if (channel?.state === 'joined' && !heartbeatFailed && Date.now() - lastHeartbeatOkAt >= HEARTBEAT_STALE_MS) {
        markStreamDown('stale')
        void supabase.realtime.sendHeartbeat()
      }
      if (document.visibilityState !== 'visible') return
      // Polling runs only while Realtime is not confirmed healthy, so a healthy board costs no queries.
      // A red banner must clear on its own once the server answers again, even if Realtime never dropped.
      if (!recovered) void (realtimeHealthy() ? confirmRecovery() : sync())
      else if (serverDown) void sync()
      void maybeEmergencyReload()
    }

    const onWake = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastWakeAt < 1000) return
      lastWakeAt = Date.now()
      // A healthy live channel already delivered everything, so waking up costs no query. Catch-up sync runs only when
      // the channel dropped; a stale heartbeat is probed and a failed probe triggers markStreamDown, which syncs.
      if (!supabase.realtime.isConnected() || channel?.state !== 'joined') {
        void sync()
        scheduleResubscribe('wake', true)
      } else if (!realtimeHealthy()) void sync()
      else if (Date.now() - lastHeartbeatOkAt > 30_000) void supabase.realtime.sendHeartbeat()
    }
    const onOffline = () => update({ server: 'unreachable', serverIssue: 'offline' })
    const onInteraction = () => { lastInteractionAt = Date.now() }

    checkNowRef.current = async () => {
      update({ checking: true })
      const ok = await sync(true)
      if (ok && !realtimeHealthy()) scheduleResubscribe(streamIssue, true)
      update({ checking: false })
      if (ok) toast.success('Połączenie z serwerem działa', { description: 'Zamówienia zsynchronizowane z bazą.' })
      else toast.error('Nadal brak połączenia z serwerem', { description: 'Sprawdź, czy sieć Wi-Fi ma dostęp do internetu.' })
    }

    markStreamDown('connecting')
    void sync()
    void subscribe()
    const pollInterval = window.setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('pageshow', onWake)
    window.addEventListener('online', onWake)
    window.addEventListener('offline', onOffline)
    window.addEventListener('pointerdown', onInteraction)
    window.addEventListener('keydown', onInteraction)
    return () => {
      active = false
      window.clearTimeout(retryTimer)
      window.clearTimeout(streamDownTimer)
      window.clearTimeout(quickRetryTimer)
      window.clearInterval(pollInterval)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('pageshow', onWake)
      window.removeEventListener('online', onWake)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('pointerdown', onInteraction)
      window.removeEventListener('keydown', onInteraction)
      supabase.realtime.onHeartbeat(() => {})
      authListener.subscription.unsubscribe()
      if (channel) void supabase.removeChannel(channel)
    }
  }, [userId, role, ordersRef])

  const checkNow = useCallback(() => checkNowRef.current(), [])
  return { syncState: state, checkNow }
}
