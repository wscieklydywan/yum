'use client'

import { WorkshopItemDialog, type ItemDialogTarget } from './workshop-item-dialog'
import { WorkshopNewOrderDialog } from './workshop-new-order-dialog'
import { WorkshopRefundDialog } from './workshop-refund-dialog'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChefHat, LogOut, Search, Store } from 'lucide-react'
import { WorkshopPrintDialog } from './workshop-print-dialog'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Logo } from '@/components/yummy/logo'
import { mutate as mutateCache } from 'swr'
import { activeStatuses, applyOrderAction, hasRefundableItems, hasUnbilledItems, orderProblems, stationProgress, statusLabels, type ActiveOrderStatus, type KitchenOrder, type OrderAction, type OrderStatus } from './order-data'
import { WorkshopOrderActions } from './workshop-order-actions'
import { WorkshopCashReportButton, WorkshopCashReportDialog } from './workshop-cash-report'
import { createClient } from '@/lib/supabase/client'
import { playNewOrderSound, unlockNotificationSound } from '@/lib/notification-sound'
import { WorkshopUserManagement } from './workshop-user-management'
import { DayControl, OrderingBanner } from './workshop-restaurant-controls'
import { ConnectionDot, OfflineBanner, StreamDelayBanner } from './workshop-connection-status'
import { WorkshopHandOffDialog } from './workshop-hand-off-dialog'
import { WorkshopDayReports } from './workshop-day-reports'
import { WorkshopOpeningHours } from './workshop-opening-hours'
import { WorkshopOnlineOrderSettings } from './workshop-online-order-settings'
import { WorkshopMenuManagement } from './workshop-menu-management'
import { WorkshopMarketing } from './marketing/workshop-marketing'
import { WorkshopCustomers } from './workshop-customers'
import { isManagerRole, type UserRole } from './workshop-access'
import { WorkshopOrderCard, type OrderPermissions } from './workshop-order-card'
import { WorkshopOrderDetails } from './workshop-order-details'
import { WorkshopKitchenBoard } from './workshop-kitchen-board'
import { WorkshopProblemDialog, type ProblemTarget } from './workshop-problem-dialog'
import { WorkshopSidebar } from './workshop-sidebar'
import { WorkshopDemoSection, type WorkshopSectionKey } from './workshop-demo-tools'

import { orderColumns, toKitchenOrder, type DatabaseOrder } from './order-rows'
import { HISTORY_KEY, WorkshopOrderHistory } from './workshop-order-history'

type WorkshopView = 'cashier' | 'kitchen'

const isActive = (order: KitchenOrder) => (activeStatuses as OrderStatus[]).includes(order.status)
const visibleToKitchen = (order: KitchenOrder | undefined) => !!order && (order.status === 'preparing' || order.status === 'ready') && stationProgress(order, 'kitchen').total > 0

const actionMessages: Partial<Record<OrderAction, (id: string) => string>> = {
  accept: (id) => `Zamówienie ${id} przekazane do realizacji`,
  hand_off: (id) => `Zamówienie ${id} wydane`,
  cancel_order: (id) => `Zamówienie ${id} anulowane`,
  report_problem: () => 'Problem zgłoszony na bar',
  restore_order: (id) => `Zamówienie ${id} przywrócone`,
  undo_hand_off: (id) => `Cofnięto wydanie ${id} – wróciło do „Gotowe”`,
}

const undoActions: Partial<Record<OrderAction, OrderAction>> = { cancel_order: 'restore_order', hand_off: 'undo_hand_off' }
const refreshHistory = () => mutateCache((key) => Array.isArray(key) && key[0] === HISTORY_KEY)

export function WorkshopDashboard({ userRole, userEmail, userId }: { userRole: UserRole; userEmail: string; userId: string }) {
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const ordersRef = useRef<KitchenOrder[]>([])
  const [view, setView] = useState<WorkshopView>(userRole === 'kuchnia' ? 'kitchen' : 'cashier')
  const viewRef = useRef(view)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeStatus, setActiveStatus] = useState<ActiveOrderStatus>('new')
  const [activeSection, setActiveSection] = useState<WorkshopSectionKey>('orders')
  const [search, setSearch] = useState('')
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false)
  const [now, setNow] = useState<number | null>(null)
  const [printOrder, setPrintOrder] = useState<KitchenOrder | null>(null)
  const [problemTarget, setProblemTarget] = useState<ProblemTarget | null>(null)
  const [cancelTarget, setCancelTarget] = useState<KitchenOrder | null>(null)
  const [handOffTarget, setHandOffTarget] = useState<KitchenOrder | null>(null)
  const [itemTarget, setItemTarget] = useState<ItemDialogTarget | null>(null)
  const [editSession, setEditSession] = useState<{ id: number; order: KitchenOrder | null }>({ id: 0, order: null })
  const [refundOrder, setRefundOrder] = useState<KitchenOrder | null>(null)
  const [cashReportOpen, setCashReportOpen] = useState(false)
  const [streamDown, setStreamDown] = useState(false)

  const isManager = isManagerRole(userRole)
  const permissions: OrderPermissions = {
    canManage: isManager || userRole === 'kelner',
    canHandOff: isManager || userRole === 'kelner' || userRole === 'kierowca',
    canKitchen: isManager || userRole === 'kuchnia',
  }

  function commitOrders(next: KitchenOrder[]) {
    ordersRef.current = next
    setOrders(next)
  }

  useEffect(() => {
    viewRef.current = view
  }, [view])

  useEffect(() => {
    const supabase = createClient()
    let active = true
    const loadOrders = async () => {
      const { data, error } = await supabase.from('orders').select(orderColumns).in('status', activeStatuses).order('created_at', { ascending: true })
      if (!active) return
      if (error) {
        toast.error('Nie udało się pobrać zamówień z warsztatu.')
        return
      }
      commitOrders((data as DatabaseOrder[]).map(toKitchenOrder))
    }

    // Each station only hears about events that need its attention.
    const notify = (previous: KitchenOrder | undefined, next: KitchenOrder) => {
      if (viewRef.current === 'kitchen') {
        if (!visibleToKitchen(previous) && visibleToKitchen(next) && stationProgress(next, 'kitchen').done === 0) {
          playNewOrderSound()
          toast.success(`Do zrobienia: ${next.id}`, { description: next.type })
        }
        return
      }
      if (!previous && next.status === 'new') {
        playNewOrderSound()
        toast.success(`Nowe zamówienie ${next.id}`, { description: `${next.customer} · ${next.type}` })
      } else if (previous && previous.status !== 'ready' && next.status === 'ready') {
        playNewOrderSound()
        toast.success(`${next.id} gotowe do wydania`, { description: next.type })
      } else if (orderProblems(next).length > (previous ? orderProblems(previous).length : 0)) {
        playNewOrderSound()
        const problem = orderProblems(next).at(-1)
        toast.error(`${next.id}: ${problem?.problem}`, { description: problem ? `${problem.quantity}× ${problem.name}` : undefined })
      }
    }

    let channel: ReturnType<typeof supabase.channel> | null = null
    let retryTimer: number | undefined
    // Grace period so a routine 2s reconnect never flashes the delay banner.
    let streamDownTimer: number | undefined
    const markStreamDown = () => {
      if (streamDownTimer !== undefined) return
      streamDownTimer = window.setTimeout(() => { if (active) setStreamDown(true) }, 10_000)
    }
    const markStreamUp = () => {
      window.clearTimeout(streamDownTimer)
      streamDownTimer = undefined
      retryAttempt = 0
      setStreamDown(false)
    }
    // Backoff: 2s, 4s, 8s, then every 15s for the first 5 minutes of an outage, then once a minute.
    let retryAttempt = 0
    let outageStartedAt: number | null = null
    const nextRetryDelay = () => {
      outageStartedAt ??= Date.now()
      if (Date.now() - outageStartedAt > 5 * 60_000) return 60_000
      return Math.min(2000 * 2 ** retryAttempt++, 15_000)
    }
    markStreamDown()
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) void supabase.realtime.setAuth(session.access_token)
    })
    const scheduleResubscribe = (immediate = false) => {
      if (!active) return
      markStreamDown()
      const failed = channel
      channel = null
      if (failed) void supabase.removeChannel(failed)
      window.clearTimeout(retryTimer)
      retryTimer = window.setTimeout(() => void subscribe(), immediate ? 500 : nextRetryDelay())
    }
    const subscribe = async () => {
      // Realtime must carry the user's JWT, otherwise RLS on orders filters out every event.
      // getUser() refreshes an expired token (e.g. after the tablet slept), getSession() alone would hand back a stale one.
      await supabase.auth.getUser().catch(() => null)
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      if (session?.access_token) await supabase.realtime.setAuth(session.access_token)
      if (!active || channel) return
      // Unique topic per subscription: reusing one topic makes supabase-js hand back an already-closed channel after a reconnect.
      channel = supabase.channel(`workshop-orders-${userId}-${Date.now()}`).on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const current = ordersRef.current
        if (payload.eventType === 'DELETE') {
          const deletedId = String((payload.old as { id?: string }).id ?? '')
          commitOrders(current.filter((order) => order.databaseId !== deletedId))
          return
        }
        const updated = toKitchenOrder(payload.new as DatabaseOrder)
        const previous = current.find((order) => order.databaseId === updated.databaseId)
        if (!isActive(updated)) {
          if (previous) commitOrders(current.filter((order) => order.databaseId !== updated.databaseId))
          return
        }
        notify(previous, updated)
        commitOrders(previous ? current.map((order) => order.databaseId === updated.databaseId ? updated : order) : [...current, updated])
      }).subscribe((status) => {
        if (status === 'SUBSCRIBED') { outageStartedAt = null; markStreamUp(); void loadOrders() }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') scheduleResubscribe()
      })
    }

    // Reconciles with the database so a missed event (dropped socket, sleeping tablet) never leaves an order unseen.
    const reconcile = async () => {
      const { data } = await supabase.from('orders').select(orderColumns).in('status', activeStatuses).order('created_at', { ascending: true })
      if (!active || !data) return
      const fresh = (data as DatabaseOrder[]).map(toKitchenOrder)
      const previousById = new Map(ordersRef.current.map((order) => [order.databaseId, order]))
      for (const order of fresh) {
        const previous = previousById.get(order.databaseId)
        if (!previous || previous.status !== order.status || orderProblems(previous).length !== orderProblems(order).length) notify(previous, order)
      }
      commitOrders(fresh)
    }
    const onWake = () => {
      if (document.visibilityState !== 'visible') return
      void reconcile()
      if (!channel || channel.state !== 'joined') scheduleResubscribe(true)
    }
    const onOnline = () => { void reconcile(); scheduleResubscribe(true) }

    void subscribe()
    setNow(Date.now())
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    // Realtime carries every change and a rejoin reloads the list. Polling only kicks in while the channel is down,
    // so orders keep arriving even if the Realtime service itself is unavailable.
    const reconcileInterval = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || channel?.state === 'joined') return
      void reconcile()
    }, 15_000)
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('online', onOnline)
    window.addEventListener('pointerdown', unlockNotificationSound)
    window.addEventListener('keydown', unlockNotificationSound)
    return () => {
      active = false
      window.clearTimeout(retryTimer)
      window.clearTimeout(streamDownTimer)
      window.clearInterval(reconcileInterval)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('pointerdown', unlockNotificationSound)
      window.removeEventListener('keydown', unlockNotificationSound)
      window.clearInterval(interval)
      authListener.subscription.unsubscribe()
      if (channel) void supabase.removeChannel(channel)
    }
  }, [userId])

  async function runAction(order: KitchenOrder, action: OrderAction, index?: number, value?: string): Promise<boolean> {
    if (!order.databaseId) return false
    const optimistic = applyOrderAction(order, action, index, value)
    commitOrders(isActive(optimistic)
      ? ordersRef.current.map((item) => item.databaseId === order.databaseId ? optimistic : item)
      : ordersRef.current.filter((item) => item.databaseId !== order.databaseId))
    if (action === 'accept') setActiveStatus('preparing')
    if (!isActive(optimistic)) setMobileDetailsOpen(false)

    const supabase = createClient()
    let errorMessage: string | null = null
    try {
      const { error } = await supabase.rpc('workshop_order_action', { p_order_id: order.databaseId, p_action: action, p_index: index ?? null, p_value: value ?? null })
      if (error) errorMessage = error.message || 'Nie udało się zapisać zmiany.'
    } catch {
      errorMessage = 'Brak połączenia z serwerem. Zmiana nie została zapisana.'
    }

    if (errorMessage) {
      // Restore the row as the database has it now, not our pre-click snapshot, so changes made meanwhile by another station survive the rollback.
      let restored: KitchenOrder | null = order
      try {
        const { data } = await supabase.from('orders').select(orderColumns).eq('id', order.databaseId).maybeSingle()
        if (data) restored = toKitchenOrder(data as DatabaseOrder)
        else restored = null
      } catch {
        restored = order
      }
      const others = ordersRef.current.filter((item) => item.databaseId !== order.databaseId)
      commitOrders(restored && isActive(restored)
        ? (ordersRef.current.some((item) => item.databaseId === order.databaseId)
          ? ordersRef.current.map((item) => item.databaseId === order.databaseId ? restored : item)
          : [...others, restored])
        : others)
      if (action === 'accept') setActiveStatus('new')
      toast.error(`${order.id}: ${errorMessage}`, { description: 'Przywrócono poprzedni stan na ekranie.' })
      return false
    }

    if (action === 'restore_order' || action === 'undo_hand_off') {
      const { data } = await supabase.from('orders').select(orderColumns).eq('id', order.databaseId).maybeSingle()
      if (data) {
        const fresh = toKitchenOrder(data as DatabaseOrder)
        const others = ordersRef.current.filter((item) => item.databaseId !== fresh.databaseId)
        if (isActive(fresh)) {
          commitOrders([...others, fresh])
          setSelectedId(fresh.id)
          if (fresh.status !== 'cancelled' && fresh.status !== 'handed_off') setActiveStatus(fresh.status)
        }
      }
    }
    if (!isActive(optimistic) || action === 'restore_order' || action === 'undo_hand_off') void refreshHistory()

    const message = actionMessages[action]?.(order.id)
    const undo = undoActions[action]
    if (message && undo) {
      toast.success(message, { duration: 10000, description: 'Znajdziesz je też w Historii.', action: { label: 'Cofnij', onClick: () => void runAction(optimistic, undo) } })
    } else if (message) toast.success(message)
    return true
  }

  /** Voids receipts that were issued but never printed, so the order can be edited or cancelled without a refund. */
  async function releaseUnprinted(order: KitchenOrder): Promise<KitchenOrder> {
    if (!order.databaseId || !hasRefundableItems(order)) return order
    const response = await fetch(`/api/workshop/orders/${order.databaseId}/release`, { method: 'POST' }).catch(() => null)
    const body = (await response?.json().catch(() => null)) as { voided?: number; items?: KitchenOrder['items']; error?: string } | null
    if (!response?.ok || !body?.items) {
      toast.error(body?.error ?? 'Nie udało się sprawdzić paragonu.')
      return order
    }
    if (!body.voided) return order
    const fresh = { ...order, items: body.items }
    commitOrders(ordersRef.current.map((item) => item.databaseId === order.databaseId ? { ...item, items: body.items! } : item))
    toast.info(`${order.id}: anulowano niewydrukowany paragon.`, { description: 'Możesz edytować lub usunąć zamówienie, a potem wydrukować paragon od nowa.' })
    return fresh
  }

  async function openCancel(order: KitchenOrder) {
    setCancelTarget(await releaseUnprinted(order))
  }

  async function openItemEditor(order: KitchenOrder, _index: number | null) {
    setMobileDetailsOpen(false)
    const fresh = order.items.some((item) => (item.receipted ?? 0) > 0) ? await releaseUnprinted(order) : order
    setEditSession((current) => ({ id: current.id + 1, order: fresh }))
  }

  async function requestAction(order: KitchenOrder, action: OrderAction, index?: number, value?: string) {
    if (action === 'hand_off' && hasUnbilledItems(order)) {
      setHandOffTarget(order)
      return
    }
    if (action === 'cancel_item' && index !== undefined && (order.items[index]?.receipted ?? 0) > 0) order = await releaseUnprinted(order)
    void runAction(order, action, index, value)
  }

  function openPrint(order: KitchenOrder) {
    setMobileDetailsOpen(false)
    setPrintOrder(order)
  }

  async function signOut() {
    await createClient().auth.signOut()
    window.location.assign('/warsztat')
  }

  const selectedOrder = orders.find((order) => order.id === selectedId) ?? orders[0]
  const counts = useMemo(() => activeStatuses.reduce((result, status) => {
    result[status] = orders.filter((order) => order.status === status).length
    return result
  }, { new: 0, preparing: 0, ready: 0 } as Record<ActiveOrderStatus, number>), [orders])
  const matchingOrders = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pl-PL')
    return orders.filter((order) => !term || `${order.id} ${order.customer} ${order.phone} ${order.items.map((item) => item.name).join(' ')}`.toLocaleLowerCase('pl-PL').includes(term))
  }, [orders, search])

  function selectOrder(order: KitchenOrder) {
    setSelectedId(order.id)
    setMobileDetailsOpen(window.matchMedia('(max-width: 1279px)').matches)
  }

  function renderCard(order: KitchenOrder) {
    return <WorkshopOrderCard key={order.id} order={order} selected={selectedId === order.id} now={now} permissions={permissions} onPrint={openPrint} onSelect={selectOrder} onAction={requestAction} onCancelOrder={(order) => void openCancel(order)} />
  }

  const laneColors: Record<ActiveOrderStatus, string> = { new: 'bg-primary', preparing: 'bg-amber-500', ready: 'bg-emerald-600' }

  return (
    <div className="workshop-dashboard min-h-screen bg-[#f1ede7] text-[#201d1a] xl:flex xl:h-dvh xl:min-h-0 xl:overflow-hidden">
      <WorkshopSidebar orderCount={orders.length} activeSection={activeSection} userRole={userRole} onNavigate={(section) => { setActiveSection(section); setMobileDetailsOpen(false) }} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col xl:h-dvh xl:min-h-0">
        <header className="sticky top-0 z-20 border-b border-[#e4ddd5] bg-[#faf8f5]/95 backdrop-blur-md">
          <div className="mx-auto flex min-h-[60px] w-full max-w-[1800px] items-center justify-between gap-3 px-3 sm:px-5 xl:px-6">
            <a href="/" aria-label="Wróć na stronę Yummy" className="xl:hidden"><Logo priority className="h-8 w-auto" /></a>
            <label className="hidden h-10 w-full max-w-[440px] items-center gap-2.5 rounded-xl border border-[#e8e3dd] bg-white px-3.5 shadow-sm sm:flex">
              <Search className="size-[17px] shrink-0 text-[#6f6963]" aria-hidden="true" /><span className="sr-only">Szukaj zamówienia</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Szukaj zamówienia…" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#8d8780]" />
            </label>
            <div className="flex items-center gap-2 sm:gap-2.5">
              <ConnectionDot />
              {permissions.canManage && <DayControl onReport={() => { if (isManager) setActiveSection('reports'); setCashReportOpen(true) }} />}
          {permissions.canManage && <WorkshopCashReportDialog open={cashReportOpen} onOpenChange={setCashReportOpen} />}
              <div className="hidden max-w-[180px] text-right sm:block"><p className="truncate text-[11px] font-semibold">{userEmail}</p><p className="text-[9px] capitalize text-[#817a73]">{userRole === 'admin' ? 'Administrator' : userRole === 'szef' ? 'Szef' : userRole}</p></div>
              <button type="button" onClick={() => void signOut()} aria-label="Wyloguj się" className="grid size-9 place-items-center rounded-xl border border-[#e8e3dd] bg-white text-[#36312d] transition-colors hover:bg-[#f7f3ef]"><LogOut className="size-[17px]" aria-hidden="true" /></button>
              <div className="hidden min-w-[66px] text-right sm:block"><p className="text-[14px] font-bold leading-tight tabular-nums">{now ? new Date(now).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' }) : '—:—'}</p><p className="mt-0.5 text-[10px] text-[#756e67]">{now ? new Date(now).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', timeZone: 'Europe/Warsaw' }) : 'Warsztat'}</p></div>
            </div>
          </div>
          <OfflineBanner />
          <StreamDelayBanner active={streamDown} />
          {activeSection === 'orders' && view === 'cashier' && <div className="px-3 pb-3 sm:hidden"><label className="flex h-9 items-center gap-2 rounded-xl border border-[#e8e3dd] bg-white px-3"><Search className="size-4 shrink-0 text-[#6f6963]" aria-hidden="true" /><span className="sr-only">Szukaj zamówienia</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Szukaj zamówienia…" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[#8d8780]" /></label></div>}
        </header>

        <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col px-3 py-4 pb-24 sm:px-5 sm:py-5 sm:pb-24 xl:relative xl:min-h-0 xl:overflow-y-auto xl:px-6 xl:pb-5">
          {activeSection === 'orders' ? <>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3 sm:mb-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">{view === 'kitchen' ? <ChefHat className="size-[17px] text-primary" aria-hidden="true" /> : <Store className="size-[17px] text-primary" aria-hidden="true" />}<p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b827a]">{view === 'kitchen' ? 'Stanowisko kuchni' : 'Stanowisko baru'}</p></div>
                <h1 className="mt-1 text-[21px] font-extrabold tracking-tight sm:text-[24px]">{view === 'kitchen' ? 'Kuchnia' : 'Zamówienia'}</h1>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                {isManager && <div role="group" aria-label="Widok stanowiska" className="flex rounded-xl border border-[#e5ded6] bg-[#eae5de] p-1">
                  {(['cashier', 'kitchen'] as const).map((option) => <button key={option} type="button" aria-pressed={view === option} onClick={() => setView(option)} className={`h-8 rounded-lg px-3 text-xs font-semibold transition-colors ${view === option ? 'bg-white text-[#211e1b] shadow-sm' : 'text-[#706961] hover:text-[#211e1b]'}`}>{option === 'cashier' ? 'Bar' : 'Kuchnia'}</button>)}
                </div>}
                {view === 'cashier' && permissions.canManage && <WorkshopCashReportButton onOpen={() => setCashReportOpen(true)} />}
                {view === 'cashier' && permissions.canManage && <WorkshopOrderActions />}
              </div>
            </div>
            <OrderingBanner canOverride={permissions.canManage} />

            {view === 'kitchen' ? <WorkshopKitchenBoard orders={orders} now={now} onToggle={(order, item) => void runAction(order, 'toggle_item', item.index, String(!item.done))} onProblem={(order, item) => setProblemTarget({ orderId: order.id, orderLabel: order.id, item })} /> : <>
              <nav aria-label="Status zamówień" className="mb-4 grid grid-cols-3 gap-1 rounded-xl border border-[#e5ded6] bg-[#eae5de] p-1 sm:mb-5 lg:hidden">
                {activeStatuses.map((status) => <button key={status} type="button" onClick={() => setActiveStatus(status)} aria-pressed={activeStatus === status} className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 transition-all duration-200 ${activeStatus === status ? 'bg-white text-[#211e1b] shadow-sm' : 'text-[#706961] hover:text-[#211e1b]'}`}><span className="text-lg font-black leading-none tabular-nums">{counts[status]}</span><span className="truncate text-[10px] font-semibold uppercase tracking-wide">{status === 'preparing' ? 'W realizacji' : statusLabels[status]}</span></button>)}
              </nav>
              <div className="grid min-h-0 flex-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_350px] xl:grid-rows-[minmax(0,1fr)] 2xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-3 xl:-m-1 xl:max-h-[calc(100%+0.5rem)] xl:overflow-y-auto xl:overscroll-contain xl:p-1 xl:pb-16">
                  {activeStatuses.map((status) => {
                    const laneOrders = matchingOrders.filter((order) => order.status === status)
                    return <section key={status} aria-labelledby={`lane-${status}`} className={`${status !== activeStatus ? 'hidden lg:block' : ''} min-w-0`}>
                      <div className="mb-2.5 hidden items-center justify-between gap-2 px-0.5 sm:mb-3 lg:flex"><h2 id={`lane-${status}`} className="text-[15px] font-bold tracking-tight text-[#211e1b]">{status === 'preparing' ? 'W realizacji' : statusLabels[status]}</h2><span className={`grid min-w-6 place-items-center rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${laneColors[status]}`}>{counts[status]}</span></div>
                      <div className="flex flex-col gap-2.5 sm:gap-3">{laneOrders.map(renderCard)}{laneOrders.length === 0 && <div className="rounded-2xl border border-dashed border-[#d8d0c7] bg-white/50 px-4 py-8 text-center text-[12px] text-[#847c74]">{search ? 'Brak pasujących zamówień.' : 'Brak zamówień w tej kolejce.'}</div>}</div>
                    </section>
                  })}
                </div>
                <aside aria-label="Szczegóły wybranego zamówienia" className="hidden h-full min-h-0 overflow-y-auto overscroll-contain rounded-2xl xl:block">{selectedOrder ? <div className="pb-24"><WorkshopOrderDetails order={selectedOrder} now={now} permissions={permissions} scrollWhole onPrint={() => openPrint(selectedOrder)} onAction={(action) => requestAction(selectedOrder, action)} onCancelOrder={() => void openCancel(selectedOrder)} onEditItem={(index) => void openItemEditor(selectedOrder, index)} onRefund={() => { setMobileDetailsOpen(false); setRefundOrder(selectedOrder) }} /></div> : <div className="grid h-full place-items-center rounded-2xl border border-dashed border-[#d8d0c7] text-[12px] text-[#847c74]">Wybierz zamówienie</div>}</aside>
              </div>
            </>}
            <p className="mt-4 text-center text-[10px] text-[#938b83] xl:hidden">Zamówienia aktualizowane na żywo</p>
          </> : <div className={`workshop-settings flex flex-1 flex-col ${activeSection === 'history' ? 'xl:min-h-0' : ''}`}>{activeSection === 'history' ? <WorkshopOrderHistory now={now} permissions={permissions} onAction={runAction} onPrint={openPrint} onRefund={setRefundOrder} /> : activeSection === 'customers' ? (permissions.canManage ? <WorkshopCustomers userRole={userRole} /> : null) : activeSection === 'marketing' ? (isManager ? <WorkshopMarketing /> : null) : activeSection === 'reports' && isManager ? <WorkshopDayReports /> : activeSection === 'settings' && isManager ? <><WorkshopOpeningHours /><WorkshopOnlineOrderSettings /><WorkshopUserManagement currentUserId={userId} currentUserRole={userRole as 'admin' | 'szef'} /></> : activeSection === 'menu' ? <WorkshopMenuManagement canToggle={isManager || userRole === 'kuchnia' || userRole === 'kelner'} canEdit={isManager} /> : <WorkshopDemoSection section={activeSection} orders={orders} />}</div>}
        </main>
      </div>

      <Dialog open={mobileDetailsOpen && !!selectedOrder} onOpenChange={setMobileDetailsOpen}>
        <DialogContent showCloseButton={false} aria-describedby={undefined} className="workshop-dashboard max-h-[92dvh] gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Szczegóły zamówienia {selectedOrder?.id}</DialogTitle>
          {selectedOrder && <div className="flex max-h-[calc(90dvh/var(--ui-zoom,1))] min-h-0 flex-col"><WorkshopOrderDetails order={selectedOrder} now={now} permissions={permissions} onPrint={() => openPrint(selectedOrder)} onClose={() => setMobileDetailsOpen(false)} onAction={(action) => requestAction(selectedOrder, action)} onCancelOrder={() => void openCancel(selectedOrder)} onEditItem={(index) => void openItemEditor(selectedOrder, index)} onRefund={() => { setMobileDetailsOpen(false); setRefundOrder(selectedOrder) }} /></div>}
        </DialogContent>
      </Dialog>

      {editSession.order && <WorkshopNewOrderDialog key={`edit-${editSession.id}`} open onOpenChange={(open) => { if (!open) setEditSession((current) => ({ ...current, order: null })) }} editOrder={editSession.order} onCustomItem={() => { const order = editSession.order; setEditSession((current) => ({ ...current, order: null })); if (order) setItemTarget({ order, index: null }) }} />}
      <WorkshopItemDialog target={itemTarget} onClose={() => setItemTarget(null)} onSaved={() => setItemTarget(null)} onRemove={(order, index) => { setItemTarget(null); void runAction(order, 'cancel_item', index, 'true') }} />
      <WorkshopRefundDialog order={refundOrder} onClose={() => setRefundOrder(null)} />

      <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null) }}>
        <DialogContent className="workshop-dashboard sm:max-w-sm">
          {cancelTarget && hasRefundableItems(cancelTarget) ? <>
            <DialogHeader><DialogTitle>Nie można anulować {cancelTarget.id}</DialogTitle><DialogDescription>Paragon do tego zamówienia jest już wydrukowany. Najpierw zrób zwrot w szczegółach zamówienia, potem anuluj.</DialogDescription></DialogHeader>
            <DialogFooter><Button variant="outline" onClick={() => setCancelTarget(null)}>Rozumiem</Button></DialogFooter>
          </> : <>
            <DialogHeader><DialogTitle>Czy na pewno anulować {cancelTarget?.id}?</DialogTitle><DialogDescription>Zamówienie zniknie z baru i kuchni. W razie pomyłki przywrócisz je przyciskiem „Cofnij” albo w zakładce Historia.</DialogDescription></DialogHeader>
            <DialogFooter><Button variant="outline" onClick={() => setCancelTarget(null)}>Wróć</Button><Button variant="destructive" onClick={() => { if (cancelTarget) void runAction(cancelTarget, 'cancel_order'); setCancelTarget(null) }}>Tak, anuluj</Button></DialogFooter>
          </>}
        </DialogContent>
      </Dialog>

      <WorkshopHandOffDialog order={handOffTarget} onClose={() => setHandOffTarget(null)} onPrint={openPrint} onHandOff={(order) => runAction(order, 'hand_off')} />

      <WorkshopProblemDialog target={problemTarget} onClose={() => setProblemTarget(null)} onSubmit={(target, reason) => {
        const order = ordersRef.current.find((item) => item.id === target.orderId)
        if (order) void runAction(order, 'report_problem', target.item.index, reason)
        setProblemTarget(null)
      }} />
      <WorkshopPrintDialog order={printOrder} onClose={() => setPrintOrder(null)} />
    </div>
  )
}
