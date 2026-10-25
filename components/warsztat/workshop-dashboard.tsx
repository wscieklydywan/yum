'use client'

import { WorkshopItemDialog, type ItemDialogTarget } from './workshop-item-dialog'
import { WorkshopNewOrderDialog } from './workshop-new-order-dialog'
import { WorkshopRefundDialog } from './workshop-refund-dialog'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ClipboardList, Clock, CreditCard, LogOut, MonitorSmartphone, RotateCw, Search, ShoppingBag, Store, Trash2, Users, Utensils } from 'lucide-react'
import { useNativeAndroid } from '@/lib/native-posnet'
import { WorkshopPrintDialog } from './workshop-print-dialog'
import { WorkshopPaymentDialog } from './workshop-payment-dialog'
import { WorkshopReceiptRecoveryDialog } from './workshop-receipt-recovery'
import { WorkshopSettleDialog, type SaveState } from './workshop-settle-dialog'
import { postOrder, readPendingOrders, removePendingOrder, type CreatedOrder, type PendingOrder } from './pending-orders'
import type { DraftRestoreRequest } from './workshop-order-actions'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Logo } from '@/components/yummy/logo'
import { mutate as mutateCache } from 'swr'
import { activeStatuses, applyOrderAction, hasRefundableItems, hasUnbilledItems, isOrderPaid, orderProblems, stationProgress, statusLabels, type ActiveOrderStatus, type IndexedOrderItem, type KitchenOrder, type OrderAction, type OrderStatus } from './order-data'
import { WorkshopOrderActions } from './workshop-order-actions'
import { WorkshopPromotionsButton } from './workshop-promotions-bar'
import { useExternalOrderAlarm } from './use-external-order-alarm'
import { WorkshopCashButton, WorkshopCashReportDialog, useCashReportPending } from './workshop-cash-report'
import { WorkshopCashDrawerButton } from './workshop-cash-drawer'

const TOOLBAR_BUTTON = 'h-9 shrink-0 rounded-xl px-3 text-xs font-bold lg:h-11 lg:px-4 lg:text-sm lg:[&_svg]:size-[18px]'
import { createClient } from '@/lib/supabase/client'
import { playNewOrderSound, unlockNotificationSound } from '@/lib/notification-sound'
import { WorkshopUserManagement } from './workshop-user-management'
import { DAY_CLOSED_MESSAGE, DayControl, OrderingBanner, requireOpenDay } from './workshop-restaurant-controls'
import { useRestaurantStatus } from '@/lib/use-restaurant-status'
import { ConnectionDot, OfflineBanner, StreamDelayBanner } from './workshop-connection-status'
import { WorkshopDayReports } from './workshop-day-reports'
import { WorkshopDocumentation } from './workshop-documentation'
import { WorkshopBarCashReports } from './workshop-cash-reports-list'
import { WorkshopOpeningHours } from './workshop-opening-hours'
import { WorkshopOnlineOrderSettings } from './workshop-online-order-settings'
import { WorkshopPaymentMethods } from './workshop-payment-methods'
import { WorkshopMenuManagement } from './workshop-menu-management'
import { WorkshopMarketing } from './marketing/workshop-marketing'
import { WorkshopCustomers } from './workshop-customers'
import { WorkshopTraining, WorkshopTrainingSettings } from './training/workshop-training'
import { isManagerRole, type UserRole } from './workshop-access'
import { WorkshopOrderCard, type OrderPermissions } from './workshop-order-card'
import { useBarScale } from './use-bar-scale'
import { WorkshopOrderDetails } from './workshop-order-details'
import { useStickyValue } from './use-dialog-session'
import { WorkshopKitchenBoard } from './workshop-kitchen-board'
import { WorkshopProblemDialog, type ProblemTarget } from './workshop-problem-dialog'
import { WorkshopSidebar } from './workshop-sidebar'
import { WorkshopDemoSection, type WorkshopSectionKey } from './workshop-demo-tools'
import { WorkshopPosnetPrinter } from './workshop-posnet-printer'
import { WorkshopPosnetSettings } from './workshop-posnet-settings'
import { WorkshopSettingsPage } from './workshop-settings-layout'
import { WorkshopAndroidPreviewBanner, WorkshopAndroidPreviewToggle, useAdminAndroidPreview } from './workshop-android-preview'

import { orderColumns, toKitchenOrder, type DatabaseOrder } from './order-rows'
import { HISTORY_KEY, WorkshopOrderHistory } from './workshop-order-history'
import { useOrdersSync } from './use-orders-sync'
import { useNow } from './use-now'
import { WorkshopInstallGuard, WorkshopNotificationSettings } from './workshop-pwa-controls'
import { showSystemNotification } from '@/lib/pwa'

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

const undoActions: Partial<Record<OrderAction, OrderAction>> = { cancel_order: 'restore_order' }
const formatZloty = (value: number) => `${value.toFixed(2).replace('.', ',')} zł`
const refreshHistory = () => mutateCache((key) => Array.isArray(key) && key[0] === HISTORY_KEY)

export function WorkshopDashboard({ userRole, userEmail, userId }: { userRole: UserRole; userEmail: string; userId: string }) {
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const ordersRef = useRef<KitchenOrder[]>([])
  const [view, setView] = useState<WorkshopView>(userRole === 'kuchnia' ? 'kitchen' : 'cashier')
  const viewRef = useRef(view)
  const acceptAfterSettleRef = useRef<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [posnetSetupRequested, setPosnetSetupRequested] = useState(false)
  const nativeAndroid = useNativeAndroid()
  const [activeStatus, setActiveStatus] = useState<ActiveOrderStatus>('new')
  const [activeSection, setActiveSection] = useState<WorkshopSectionKey>('orders')
  const [trainingActive, setTrainingActive] = useState(false)
  const [search, setSearch] = useState('')
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false)
  const [settleOrder, setSettleOrder] = useState<KitchenOrder | null>(null)
  const [problemTarget, setProblemTarget] = useState<ProblemTarget | null>(null)
  const [cancelTarget, setCancelTarget] = useState<KitchenOrder | null>(null)
  const cancelShown = useStickyValue(cancelTarget)
  const [handOffTarget, setHandOffTarget] = useState<{ order: KitchenOrder; mode: 'print' | 'pay' } | null>(null)
  const [itemTarget, setItemTarget] = useState<ItemDialogTarget | null>(null)
  const [editSession, setEditSession] = useState<{ id: number; order: KitchenOrder | null }>({ id: 0, order: null })
  const [refundOrder, setRefundOrder] = useState<KitchenOrder | null>(null)
  const [cashReportOpen, setCashReportOpen] = useState(false)
  const [closingDay, setClosingDay] = useState(false)
  const [closeWithFiscal, setCloseWithFiscal] = useState(false)
  const [reloading, setReloading] = useState(false)
  const cashReportPending = useCashReportPending(isManagerRole(userRole) || userRole === 'kelner')
  // After an automatic midnight close the cash report is optional ("kontynuuj mimo to"), so it is not forced open.
  const { status: restaurantStatus } = useRestaurantStatus()
  const cashReportRequired = cashReportPending && !restaurantStatus?.dayAutoClosed
  const dayClosedRef = useRef(false)
  dayClosedRef.current = !!restaurantStatus && !restaurantStatus.dayOpen
  const pendingSettleRef = useRef<string | null>(null)
  const [settleSave, setSettleSave] = useState<{ entry: PendingOrder; state: SaveState } | null>(null)
  const [restoreRequest, setRestoreRequest] = useState<DraftRestoreRequest | null>(null)
  const resumedPendingRef = useRef(false)

  const isManager = isManagerRole(userRole)
  const isKitchenRole = userRole === 'kuchnia'
  const permissions = useMemo<OrderPermissions>(() => ({
    canManage: isManager || userRole === 'kelner',
    canHandOff: isManager || userRole === 'kelner' || userRole === 'kierowca',
    canKitchen: isManager || userRole === 'kuchnia',
  }), [isManager, userRole])

  function upsertOrder(fresh: KitchenOrder) {
    if (ordersRef.current.some((item) => item.databaseId === fresh.databaseId)) commitOrders(ordersRef.current.map((item) => item.databaseId === fresh.databaseId ? fresh : item))
    else if (isActive(fresh)) commitOrders([...ordersRef.current, fresh])
  }

  async function orderFromResult(data: CreatedOrder) {
    if (data.order) {
      const fresh = toKitchenOrder(data.order)
      upsertOrder(fresh)
      return fresh
    }
    return loadFresh(data.orderId)
  }

  /** „Dodaj i rozlicz”: the payment opens on the local copy at once while the order is saved in the background. */
  function startPaidOrder(entry: PendingOrder) {
    acceptAfterSettleRef.current = null
    pendingSettleRef.current = entry.clientRequestId
    setSettleOrder(entry.provisional)
    void savePaidOrder(entry)
  }

  async function savePaidOrder(entry: PendingOrder) {
    setSettleSave({ entry, state: { status: 'saving' } })
    const result = await postOrder(entry.payload)
    const stillShown = pendingSettleRef.current === entry.clientRequestId
    if (!result.ok) {
      if (stillShown) setSettleSave({ entry, state: { status: 'error', error: result.error } })
      else showUnsavedOrder(entry, result.error)
      return
    }
    removePendingOrder(entry.clientRequestId)
    const fresh = await orderFromResult(result.data)
    if (!stillShown) {
      if (fresh) {
        showWaitingInNew(fresh)
        toast.info(`${fresh.id} zapisane – czeka w „Nowe”`, { description: 'Rozliczenie zostało zamknięte przed zapisem. Rozlicz je z listy.', duration: 10000 })
      }
      return
    }
    pendingSettleRef.current = null
    setSettleSave(null)
    if (!fresh) {
      setSettleOrder(null)
      toast.error('Zamówienie zapisane, ale nie udało się go wczytać.', { description: 'Rozlicz je z listy zamówień.' })
      return
    }
    acceptAfterSettleRef.current = result.data.orderId
    const savedTotal = fresh.total ?? 0
    const formTotal = entry.provisional.total ?? 0
    if (Math.abs(savedTotal - formTotal) >= 0.01) {
      toast.warning(`Kwota po zapisie: ${formatZloty(savedTotal)}`, { description: `W formularzu było ${formatZloty(formTotal)} (ceny przeliczone przez serwer).`, duration: 12000 })
    }
    setSettleOrder(fresh)
  }

  function editDraft(entry: PendingOrder) {
    toast.dismiss(entry.clientRequestId)
    setView('cashier')
    setRestoreRequest({ id: Date.now(), draft: entry.draft })
  }

  function discardUnsaved(entry: PendingOrder) {
    removePendingOrder(entry.clientRequestId)
    toast.dismiss(entry.clientRequestId)
    if (pendingSettleRef.current === entry.clientRequestId) {
      pendingSettleRef.current = null
      setSettleSave(null)
      setSettleOrder(null)
    }
    toast.success('Niezapisane zamówienie usunięte')
  }

  function showUnsavedOrder(entry: PendingOrder, error: string) {
    if (error === DAY_CLOSED_MESSAGE) requireOpenDay()
    toast.error('Zamówienie nie zostało zapisane', {
      id: entry.clientRequestId,
      description: <div className="flex flex-col items-start gap-2">
        <span>{`${entry.provisional.customer} · ${formatZloty(entry.provisional.total ?? 0)}. ${error} Dane są bezpieczne na tym urządzeniu.`}</span>
        <button type="button" onClick={() => discardUnsaved(entry)} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-red-300 bg-white px-2.5 text-xs font-semibold text-red-700 hover:bg-red-50">
          <Trash2 className="size-3.5" aria-hidden="true" />Usuń
        </button>
      </div>,
      duration: Infinity,
      action: { label: 'Ponów zapis', onClick: () => void retryInBackground(entry) },
      cancel: { label: 'Popraw', onClick: () => editDraft(entry) },
    })
  }

  /** Saves a backed-up order without the payment dialog; idempotent, so it is safe even if the first attempt went through. */
  async function retryInBackground(entry: PendingOrder) {
    const result = await postOrder(entry.payload)
    if (!result.ok) {
      showUnsavedOrder(entry, result.error)
      return
    }
    removePendingOrder(entry.clientRequestId)
    toast.dismiss(entry.clientRequestId)
    const fresh = await orderFromResult(result.data)
    if (!fresh) return
    if (fresh.status === 'new') showWaitingInNew(fresh)
    toast.success(`Zapisano zamówienie ${fresh.id}`, { description: fresh.status === 'new' && !isOrderPaid(fresh) ? 'Czeka w „Nowe” na rozliczenie.' : undefined })
  }

  async function loadFresh(databaseId: string) {
    const { data } = await createClient().from('orders').select(orderColumns).eq('id', databaseId).maybeSingle()
    if (!data) return null
    const fresh = toKitchenOrder(data as DatabaseOrder)
    commitOrders(ordersRef.current.some((item) => item.databaseId === fresh.databaseId)
      ? ordersRef.current.map((item) => item.databaseId === fresh.databaseId ? fresh : item)
      : [...ordersRef.current, fresh])
    return fresh
  }

  function showWaitingInNew(order: KitchenOrder) {
    setActiveStatus('new')
    setSelectedId(order.id)
  }

  /** An order created with „Dodaj i rozlicz” goes to the kitchen only once it is paid and its receipt has printed. */
  async function closeSettle() {
    setSettleOrder(null)
    if (pendingSettleRef.current) {
      // Still saving: the request finishes in the background and the order lands in „Nowe”. Failed: keep it recoverable.
      pendingSettleRef.current = null
      if (settleSave?.state.status === 'error') showUnsavedOrder(settleSave.entry, settleSave.state.error)
      setSettleSave(null)
      return
    }
    const databaseId = acceptAfterSettleRef.current
    acceptAfterSettleRef.current = null
    if (!databaseId) return
    const fresh = await loadFresh(databaseId)
    if (!fresh || fresh.status !== 'new') return
    const paid = isOrderPaid(fresh)
    const receipted = !hasUnbilledItems(fresh)
    if (paid && receipted) {
      setSelectedId(fresh.id)
      await runAction(fresh, 'accept')
      return
    }
    showWaitingInNew(fresh)
    const description = paid
      ? 'Opłacone, ale bez paragonu. Wydrukuj paragon przez „Rozlicz” albo kliknij „Akceptuj zamówienie”, żeby wysłać je na kuchnię.'
      : 'Nie zostało opłacone, więc nie poszło na kuchnię. Rozlicz je albo zaakceptuj ręcznie.'
    toast.info(`${fresh.id} czeka w „Nowe”`, { description, duration: 10000 })
  }

  /** Printer down while settling a fresh order: back to the order, kitchen waits for a manual accept. */
  async function settlePrintFailed() {
    const databaseId = acceptAfterSettleRef.current
    if (!databaseId) return
    acceptAfterSettleRef.current = null
    setSettleOrder(null)
    const fresh = await loadFresh(databaseId)
    if (!fresh || fresh.status !== 'new') return
    showWaitingInNew(fresh)
    toast.error(`Drukarka nie odpowiada – ${fresh.id} nie poszło na kuchnię`, {
      description: isOrderPaid(fresh)
        ? 'Płatność jest zapisana, paragon czeka na ponowny wydruk w „Rozlicz”. Jeśli wszystko się zgadza, wyślij zamówienie na kuchnię ręcznie.'
        : 'Paragon czeka na ponowny wydruk w „Rozlicz”. Jeśli klient zapłacił, wyślij zamówienie na kuchnię ręcznie.',
      duration: 20000,
      action: { label: 'Na kuchnię', onClick: () => { const latest = ordersRef.current.find((item) => item.databaseId === fresh.databaseId) ?? fresh; if (latest.status === 'new') void runAction(latest, 'accept') } },
    })
  }

  function commitOrders(next: KitchenOrder[]) {
    ordersRef.current = next
    setOrders(next)
  }

  // Item ticks still waiting for the database. A realtime echo of an earlier tick (or a poll) carries a row without the
  // later ticks, so they are re-applied on top until the server confirms them; otherwise fast tapping makes items blink back.
  const pendingTogglesRef = useRef(new Map<string, Map<number, { value: string; token: number }>>())
  const toggleTokenRef = useRef(0)

  function commitServerOrders(next: KitchenOrder[]) {
    const pending = pendingTogglesRef.current
    if (!pending.size) return commitOrders(next)
    commitOrders(next.map((order) => {
      const toggles = order.databaseId ? pending.get(order.databaseId) : undefined
      if (!toggles) return order
      let result = order
      for (const [index, { value }] of toggles) {
        if (String(!!order.items[index]?.done) === value) toggles.delete(index)
        else result = applyOrderAction(result, 'toggle_item', index, value)
      }
      if (!toggles.size) pending.delete(order.databaseId!)
      return result
    }))
  }

  function clearPendingToggle(databaseId: string, index: number, token: number) {
    const toggles = pendingTogglesRef.current.get(databaseId)
    if (toggles?.get(index)?.token !== token) return
    toggles.delete(index)
    if (!toggles.size) pendingTogglesRef.current.delete(databaseId)
  }

  useEffect(() => {
    viewRef.current = view
  }, [view])

  // Orders left in the device backup (crash, closed tab, lost connection) are finished as soon as the panel opens again.
  useEffect(() => {
    if (resumedPendingRef.current || !permissions.canManage) return
    resumedPendingRef.current = true
    for (const entry of readPendingOrders()) void retryInBackground(entry)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Each station only hears about events that need its attention.
  function notifyOrderChange(previous: KitchenOrder | undefined, next: KitchenOrder) {
    if (viewRef.current === 'kitchen') {
      if (!visibleToKitchen(previous) && visibleToKitchen(next) && stationProgress(next, 'kitchen').done === 0) {
        playNewOrderSound()
        toast.success(`Do zrobienia: ${next.id}`, { description: next.type })
        void showSystemNotification(`Do zrobienia: ${next.id}`, next.type, `kitchen-${next.id}`)
      }
      return
    }
    if (!previous && next.status === 'new') {
      // External orders are announced by the repeating alarm below; own bar orders stay silent.
      toast.success(`Nowe zamówienie ${next.id}`, { description: `${next.customer} · ${next.type}` })
      void showSystemNotification(`Nowe zamówienie ${next.id}`, `${next.customer} · ${next.type}`, `new-${next.id}`)
    } else if (previous && previous.status !== 'ready' && next.status === 'ready') {
      playNewOrderSound()
      toast.success(`${next.id} gotowe do wydania`, { description: next.type })
    } else if (orderProblems(next).length > (previous ? orderProblems(previous).length : 0)) {
      playNewOrderSound()
      const problem = orderProblems(next).at(-1)
      toast.error(`${next.id}: ${problem?.problem}`, { description: problem ? `${problem.quantity}× ${problem.name}` : undefined })
    }
  }

  useExternalOrderAlarm(orders, permissions.canManage && view === 'cashier' && !trainingActive)
  useAdminAndroidPreview(userRole === 'admin')
  const { syncState, checkNow } = useOrdersSync({ userId, role: userRole, ordersRef, commitOrders: commitServerOrders, onOrderChange: notifyOrderChange })

  useEffect(() => {
    window.addEventListener('pointerdown', unlockNotificationSound)
    window.addEventListener('keydown', unlockNotificationSound)
    return () => {
      window.removeEventListener('pointerdown', unlockNotificationSound)
      window.removeEventListener('keydown', unlockNotificationSound)
    }
  }, [])

  async function runAction(order: KitchenOrder, action: OrderAction, index?: number, value?: string): Promise<boolean> {
    if (!order.databaseId) return false
    // Orders may arrive while the day is closed, but accepting one assigns it to a business day.
    if (action === 'accept' && dayClosedRef.current) {
      requireOpenDay()
      return false
    }
    const databaseId = order.databaseId
    let toggleToken: number | null = null
    if (action === 'toggle_item' && index !== undefined && value !== undefined) {
      // Build on the newest screen state, so a second fast tap does not undo the first one.
      order = ordersRef.current.find((item) => item.databaseId === databaseId) ?? order
      toggleToken = ++toggleTokenRef.current
      const toggles = pendingTogglesRef.current.get(databaseId) ?? new Map()
      toggles.set(index, { value, token: toggleToken })
      pendingTogglesRef.current.set(databaseId, toggles)
    }
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
      else if (action === 'accept') void fetch('/api/workshop/push/kitchen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: order.databaseId }) }).catch(() => {})
    } catch {
      errorMessage = 'Brak połączenia z serwerem. Zmiana nie została zapisana.'
    }

    if (toggleToken !== null && index !== undefined) {
      const token = toggleToken
      // Saved ticks wait for their echo to confirm them; the timeout only covers an echo that never comes.
      if (errorMessage) clearPendingToggle(databaseId, index, token)
      else window.setTimeout(() => clearPendingToggle(databaseId, index, token), 8000)
    }

    if (errorMessage) {
      if (errorMessage === DAY_CLOSED_MESSAGE) requireOpenDay()
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
    toast.info(`${order.id}: anulowano niewydrukowany paragon.`, { description: 'Możesz edytować lub usunąć zamówienie, a potem wydrukowa�� paragon od nowa.' })
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
    if (action === 'hand_off' && (hasUnbilledItems(order) || !isOrderPaid(order))) {
      setMobileDetailsOpen(false)
      setHandOffTarget({ order, mode: isOrderPaid(order) ? 'print' : 'pay' })
      return
    }
    if (action === 'cancel_item' && index !== undefined && (order.items[index]?.receipted ?? 0) > 0) order = await releaseUnprinted(order)
    void runAction(order, action, index, value)
  }

  /** The dialog holds a snapshot; hand off the freshest row so payment/receipt changes made meanwhile are kept. */
  function handOffLatest(order: KitchenOrder) {
    const latest = ordersRef.current.find((item) => item.databaseId === order.databaseId) ?? order
    return runAction(latest, 'hand_off')
  }

  function openSettle(order: KitchenOrder) {
    setMobileDetailsOpen(false)
    setSettleOrder(order)
  }

  async function signOut() {
    // Local scope: the default 'global' would revoke the session on every other device using this account.
    await createClient().auth.signOut({ scope: 'local' })
    window.location.assign('/warsztat')
  }

  const selectedOrder = orders.find((order) => order.id === selectedId) ?? orders[0]
  const counts = useMemo(() => activeStatuses.reduce((result, status) => {
    result[status] = orders.filter((order) => order.status === status).length
    return result
  }, { new: 0, preparing: 0, ready: 0 } as Record<ActiveOrderStatus, number>), [orders])
  const searchIndex = useMemo(() => orders.map((order) => ({ order, text: `${order.id} ${order.customer} ${order.phone} ${order.items.map((item) => item.name).join(' ')}`.toLocaleLowerCase('pl-PL') })), [orders])
  const matchingOrders = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pl-PL')
    if (!term) return orders
    return searchIndex.filter(({ text }) => text.includes(term)).map(({ order }) => order)
  }, [orders, searchIndex, search])

  function selectOrder(order: KitchenOrder) {
    setSelectedId(order.id)
    setMobileDetailsOpen(window.matchMedia('(max-width: 1279px)').matches)
  }

  // Cards get handlers that never change identity, so a memoized card re-renders only when its own order does.
  const cardHandlersRef = useRef({ openSettle, selectOrder, requestAction, openCancel, openItemEditor })
  useLayoutEffect(() => {
    cardHandlersRef.current = { openSettle, selectOrder, requestAction, openCancel, openItemEditor }
  })
  const cardHandlers = useMemo(() => ({
    onSettle: (order: KitchenOrder) => cardHandlersRef.current.openSettle(order),
    onSelect: (order: KitchenOrder) => cardHandlersRef.current.selectOrder(order),
    onAction: (order: KitchenOrder, action: OrderAction, index?: number, value?: string) => void cardHandlersRef.current.requestAction(order, action, index, value),
    onCancelOrder: (order: KitchenOrder) => void cardHandlersRef.current.openCancel(order),
    onEdit: (order: KitchenOrder) => void cardHandlersRef.current.openItemEditor(order, null),
  }), [])
  const kitchenHandlersRef = useRef({ runAction, setProblemTarget })
  useLayoutEffect(() => {
    kitchenHandlersRef.current = { runAction, setProblemTarget }
  })
  const kitchenHandlers = useMemo(() => ({
    onToggle: (order: KitchenOrder, item: IndexedOrderItem) => void kitchenHandlersRef.current.runAction(order, 'toggle_item', item.index, String(!item.done)),
    onProblem: (order: KitchenOrder, item: IndexedOrderItem) => kitchenHandlersRef.current.setProblemTarget({ orderId: order.id, orderLabel: order.id, item }),
  }), [])

  const barScale = useBarScale()

  function renderCard(order: KitchenOrder) {
    return <WorkshopOrderCard key={order.id} order={order} selected={selectedId === order.id} permissions={permissions} {...cardHandlers} />
  }

  const kitchenOnScreen = isKitchenRole || (activeSection === 'orders' && view === 'kitchen')
  const laneColors: Record<ActiveOrderStatus, string> = { new: 'bg-primary', preparing: 'bg-amber-500', ready: 'bg-emerald-600' }

  return (
    <div className="workshop-dashboard min-h-screen bg-[#f1ede7] text-[#201d1a] xl:flex xl:h-dvh xl:min-h-0 xl:overflow-hidden">
      <WorkshopSidebar orderCount={orders.length} activeSection={activeSection} userRole={userRole} onNavigate={(section) => { setActiveSection(section); setMobileDetailsOpen(false) }} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col xl:h-dvh xl:min-h-0">
        <header className="sticky top-0 z-20 border-b border-[#e4ddd5] bg-[#faf8f5]/95 xl:backdrop-blur-md">
          <div className="mx-auto flex min-h-[60px] w-full max-w-[1800px] items-center justify-between gap-3 px-3 sm:px-5 xl:px-6">
            {isKitchenRole ? <div className="flex min-w-0 items-center gap-3">
              <div className="hidden shrink-0 sm:block"><Logo priority className="h-8 w-auto" /></div>
              <nav aria-label="Menu kuchni" className="flex h-10 items-center rounded-xl border border-[#e5ded6] bg-[#eae5de] p-0.5">
                {([['orders', 'Zamówienia', ClipboardList], ['menu', 'Dania', Utensils]] as const).map(([id, label, Icon]) => {
                  const active = activeSection === id
                  return <button key={id} type="button" aria-current={active ? 'page' : undefined} onClick={() => setActiveSection(id)} className={`flex h-full items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-semibold transition-colors sm:px-4 ${active ? 'bg-white text-[#211e1b] shadow-sm' : 'text-[#706961] hover:text-[#211e1b]'}`}>
                    <Icon className={`size-4 ${active ? 'text-primary' : ''}`} aria-hidden="true" />{label}
                  </button>
                })}
              </nav>
            </div> : <div className="xl:hidden"><Logo priority className="h-8 w-auto" /></div>}
            {!kitchenOnScreen && <label className="hidden h-10 w-full max-w-[440px] items-center gap-2.5 rounded-xl border border-[#e8e3dd] bg-white px-3.5 shadow-sm sm:flex">
              <Search className="size-[17px] shrink-0 text-[#6f6963]" aria-hidden="true" /><span className="sr-only">Szukaj zamówienia</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Szukaj zamówienia…" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#8d8780]" />
            </label>}
            <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
              <ConnectionDot sync={syncState} />
              {isManager && <div role="group" aria-label="Widok stanowiska" className="hidden h-9 items-center rounded-xl border border-[#e5ded6] bg-[#eae5de] p-0.5 sm:flex">
                {(['cashier', 'kitchen'] as const).map((option) => <button key={option} type="button" aria-pressed={view === option && activeSection === 'orders'} onClick={() => { setView(option); setActiveSection('orders') }} className={`h-full rounded-[10px] px-3 text-xs font-semibold transition-colors ${view === option && activeSection === 'orders' ? 'bg-white text-[#211e1b] shadow-sm' : 'text-[#706961] hover:text-[#211e1b]'}`}>{option === 'cashier' ? 'Bar' : 'Kuchnia'}</button>)}
              </div>}
              {permissions.canManage && <WorkshopPromotionsButton />}
              <WorkshopInstallGuard />
              {permissions.canManage && <DayControl activeOrders={orders.length} cashReportPending={cashReportPending} onReport={() => { setClosingDay(false); setCashReportOpen(true) }} onCloseDay={(withFiscal) => { setCloseWithFiscal(withFiscal); setClosingDay(true); setCashReportOpen(true) }} />}
          {permissions.canManage && <WorkshopCashReportDialog open={cashReportOpen || cashReportRequired} required={cashReportRequired} closeDay={closingDay && !cashReportRequired} fiscalPrinted={closingDay && closeWithFiscal} onOpenChange={(open) => { setCashReportOpen(open); if (!open) setClosingDay(false) }} />}
              <div className="hidden max-w-[180px] text-right sm:block"><p className="truncate text-[11px] font-semibold">{userEmail}</p><p className="text-[9px] capitalize text-[#817a73]">{userRole === 'admin' ? 'Administrator' : userRole === 'szef' ? 'Szef' : userRole}</p></div>
              <WorkshopAndroidPreviewToggle isAdmin={userRole === 'admin'} />
              <button type="button" disabled={reloading} aria-busy={reloading} onClick={() => { setReloading(true); requestAnimationFrame(() => requestAnimationFrame(() => window.location.reload())) }} aria-label={reloading ? 'Odświeżanie panelu…' : 'Odśwież panel'} title="Odśwież panel" className="grid size-9 place-items-center rounded-xl border border-[#e8e3dd] bg-white text-[#36312d] transition-colors hover:bg-[#f7f3ef] active:scale-95 disabled:cursor-wait disabled:bg-[#f7f3ef]"><RotateCw className={`size-[17px] ${reloading ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" /></button>
              <button type="button" onClick={() => void signOut()} aria-label="Wyloguj się" className="grid size-9 place-items-center rounded-xl border border-[#e8e3dd] bg-white text-[#36312d] transition-colors hover:bg-[#f7f3ef]"><LogOut className="size-[17px]" aria-hidden="true" /></button>
              <HeaderClock />
            </div>
          </div>
          <WorkshopAndroidPreviewBanner />
          <OfflineBanner sync={syncState} onCheck={() => void checkNow()} />
          <StreamDelayBanner sync={syncState} />
          {activeSection === 'orders' && view === 'cashier' && <div className="px-3 pb-3 sm:hidden"><label className="flex h-9 items-center gap-2 rounded-xl border border-[#e8e3dd] bg-white px-3"><Search className="size-4 shrink-0 text-[#6f6963]" aria-hidden="true" /><span className="sr-only">Szukaj zamówienia</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Szukaj zamówienia…" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[#8d8780]" /></label></div>}
        </header>

        <main className={`mx-auto flex w-full max-w-[1800px] flex-1 flex-col px-3 py-4 sm:px-5 sm:py-5 xl:relative xl:min-h-0 xl:overflow-y-auto xl:px-6 xl:pb-5 ${isKitchenRole ? 'pb-6' : 'pb-24 sm:pb-24'}`}>
          <WorkshopPosnetPrinter onOpenSettings={() => { setPosnetSetupRequested(true); setActiveSection('settings') }} canConfigure={userRole !== 'kuchnia' && userRole !== 'kierowca'} />
          {trainingActive ? <WorkshopTraining onExit={() => setTrainingActive(false)} /> : activeSection === 'orders' ? <div className="bar-scale flex min-h-0 flex-1 flex-col" style={view === 'cashier' && barScale !== 1 ? { zoom: barScale } : undefined}>
            {(view === 'cashier' || isManager) && <div className={`mb-3 flex flex-wrap items-end justify-between gap-3 sm:mb-4 ${view === 'kitchen' ? 'sm:hidden' : ''}`}>
              {view === 'cashier' && <div className="min-w-0">
                <div className="flex items-center gap-2"><Store className="size-[17px] text-primary" aria-hidden="true" /><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b827a]">Stanowisko baru</p></div>
                <h1 className="mt-1 text-[21px] font-extrabold tracking-tight sm:text-[24px]">Zamówienia</h1>
              </div>}
              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                {isManager && <div role="group" aria-label="Widok stanowiska" className="flex rounded-xl sm:hidden border border-[#e5ded6] bg-[#eae5de] p-1">
                  {(['cashier', 'kitchen'] as const).map((option) => <button key={option} type="button" aria-pressed={view === option} onClick={() => setView(option)} className={`h-8 rounded-lg px-3 text-xs font-semibold transition-colors ${view === option ? 'bg-white text-[#211e1b] shadow-sm' : 'text-[#706961] hover:text-[#211e1b]'}`}>{option === 'cashier' ? 'Bar' : 'Kuchnia'}</button>)}
                </div>}
                {view === 'cashier' && permissions.canManage && <>
                  <WorkshopCashButton onOpenReport={() => setCashReportOpen(true)} className={TOOLBAR_BUTTON} />
                  <span aria-hidden="true" className="hidden h-7 w-px bg-[#ddd5cc] sm:block" />
                  <div role="group" aria-label="Szybkie akcje" className="flex items-center gap-2">
                    <WorkshopCashDrawerButton className={TOOLBAR_BUTTON} />
                    <WorkshopOrderActions onPayStart={startPaidOrder} restoreRequest={restoreRequest} />
                  </div>
                </>}
              </div>
            </div>}
            <OrderingBanner canOverride={permissions.canManage} />

            {view === 'kitchen' ? <WorkshopKitchenBoard orders={orders} {...kitchenHandlers} /> : <>
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
                <aside key={selectedOrder?.id ?? 'none'} aria-label="Szczegóły wybranego zamówienia" className="hidden h-full min-h-0 overflow-y-auto overscroll-contain rounded-2xl xl:block">{selectedOrder ? <div className="pb-24"><WorkshopOrderDetails order={selectedOrder} permissions={permissions} scrollWhole previewTab onSettle={() => openSettle(selectedOrder)} onAction={(action) => requestAction(selectedOrder, action)} onCancelOrder={() => void openCancel(selectedOrder)} onEditItem={(index) => void openItemEditor(selectedOrder, index)} onRefund={() => { setMobileDetailsOpen(false); setRefundOrder(selectedOrder) }} /></div> : <div className="grid h-full place-items-center rounded-2xl border border-dashed border-[#d8d0c7] text-[12px] text-[#847c74]">Wybierz zamówienie</div>}</aside>
              </div>
            </>}
            <p className="mt-4 text-center text-[10px] text-[#938b83] xl:hidden">Zamówienia aktualizowane na żywo</p>
          </div> : <div className={`workshop-settings flex flex-1 flex-col ${activeSection === 'history' ? 'xl:min-h-0' : ''}`}>{activeSection === 'history' ? <WorkshopOrderHistory permissions={permissions} canDelete={isManager} onAction={runAction} onRefund={setRefundOrder} onSettle={openSettle} /> : activeSection === 'customers' ? (permissions.canManage ? <WorkshopCustomers userRole={userRole} /> : null) : activeSection === 'marketing' ? (isManager ? <WorkshopMarketing /> : null) : activeSection === 'documentation' ? (isManager ? <WorkshopDocumentation /> : null) : activeSection === 'reports' && isManager ? <WorkshopDayReports /> : activeSection === 'reports' && userRole === 'kelner' ? <WorkshopBarCashReports /> :           activeSection === 'settings' && (userRole === 'kuchnia' || userRole === 'kelner') ? <WorkshopSettingsPage description="Ustawienia tego urządzenia i stanowiska." tabs={[
            ...(userRole === 'kelner' ? [{ id: 'payments', label: 'Płatności', description: 'Wyłącz formę płatności, gdy np. nie działa terminal. Klienci od razu jej nie zobaczą.', icon: CreditCard, content: <WorkshopPaymentMethods /> }] : []),
            { id: 'device', label: 'To urządzenie', description: 'Dotyczy tylko tego tabletu lub komputera.', icon: MonitorSmartphone, content: <><WorkshopNotificationSettings station={userRole === 'kuchnia' ? 'kitchen' : 'cashier'} />{userRole === 'kelner' && nativeAndroid && <div className="overflow-hidden rounded-2xl border border-[#e8e2db] bg-white shadow-[0_1px_2px_rgba(33,30,27,0.04)]"><WorkshopPosnetSettings defaultOpen={posnetSetupRequested} /></div>}{userRole === 'kelner' && <WorkshopTrainingSettings onStart={() => setTrainingActive(true)} />}</> },
          ]} /> : activeSection === 'settings' && isManager ? <WorkshopSettingsPage description="Lokal, zamówienia online, zespół i to urządzenie – w jednym miejscu." initialTab={posnetSetupRequested ? 'device' : undefined} tabs={[
            { id: 'hours', label: 'Godziny', description: 'Kiedy lokal jest otwarty i do kiedy przyjmujemy zamówienia online.', icon: Clock, content: <WorkshopOpeningHours /> },
            { id: 'online', label: 'Zamówienia online', description: 'Minimalny koszyk, strefy dostawy i opakowania. Zmiany od razu widzą klienci.', icon: ShoppingBag, content: <WorkshopOnlineOrderSettings /> },
            { id: 'payments', label: 'Płatności', description: 'Wyłącz formę płatności, gdy np. nie działa terminal. Klienci od razu jej nie zobaczą.', icon: CreditCard, content: <WorkshopPaymentMethods /> },
            { id: 'team', label: 'Zespół', description: 'Konta pracowników i ich role.', icon: Users, content: <WorkshopUserManagement currentUserId={userId} currentUserRole={userRole as 'admin' | 'szef'} /> },
            { id: 'device', label: 'To urządzenie', description: 'Dotyczy tylko tego tabletu lub komputera.', icon: MonitorSmartphone, content: <><WorkshopNotificationSettings station={view} />{nativeAndroid && <div className="overflow-hidden rounded-2xl border border-[#e8e2db] bg-white shadow-[0_1px_2px_rgba(33,30,27,0.04)]"><WorkshopPosnetSettings defaultOpen={posnetSetupRequested} /></div>}<WorkshopTrainingSettings onStart={() => setTrainingActive(true)} /></> },
          ]} /> : activeSection === 'menu' ? <WorkshopMenuManagement canToggle={isManager || userRole === 'kuchnia' || userRole === 'kelner'} canEdit={isManager} /> : <WorkshopDemoSection section={activeSection} orders={orders} />}</div>}
        </main>
      </div>


      <Dialog open={mobileDetailsOpen && !!selectedOrder} onOpenChange={setMobileDetailsOpen}>
        <DialogContent showCloseButton={false} aria-describedby={undefined} className="workshop-dashboard max-h-[92dvh] gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Szczegóły zamówienia {selectedOrder?.id}</DialogTitle>
          {selectedOrder && <div className="flex max-h-[calc(90dvh/var(--ui-zoom,1))] min-h-0 flex-col"><WorkshopOrderDetails order={selectedOrder} permissions={permissions} onSettle={() => openSettle(selectedOrder)} onClose={() => setMobileDetailsOpen(false)} onAction={(action) => requestAction(selectedOrder, action)} onCancelOrder={() => void openCancel(selectedOrder)} onEditItem={(index) => void openItemEditor(selectedOrder, index)} onRefund={() => { setMobileDetailsOpen(false); setRefundOrder(selectedOrder) }} /></div>}
        </DialogContent>
      </Dialog>

      {editSession.order && <WorkshopNewOrderDialog key={`edit-${editSession.id}`} open onOpenChange={(open) => { if (!open) setEditSession((current) => ({ ...current, order: null })) }} editOrder={editSession.order} onCustomItem={() => { const order = editSession.order; setEditSession((current) => ({ ...current, order: null })); if (order) setItemTarget({ order, index: null }) }} />}
      <WorkshopItemDialog target={itemTarget} onClose={() => setItemTarget(null)} onSaved={() => setItemTarget(null)} onRemove={(order, index) => { setItemTarget(null); void runAction(order, 'cancel_item', index, 'true') }} />
      <WorkshopRefundDialog order={refundOrder} onClose={() => setRefundOrder(null)} />

      <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null) }}>
        <DialogContent className="workshop-dashboard sm:max-w-sm">
          {cancelShown && hasRefundableItems(cancelShown) ? <>
            <DialogHeader><DialogTitle>Nie można anulować {cancelShown.id}</DialogTitle><DialogDescription>Paragon do tego zamówienia jest już wydrukowany. Najpierw zrób zwrot w szczegółach zamówienia, potem anuluj.</DialogDescription></DialogHeader>
            <DialogFooter><Button variant="outline" onClick={() => setCancelTarget(null)}>Rozumiem</Button></DialogFooter>
          </> : <>
            <DialogHeader><DialogTitle>Czy na pewno anulować {cancelShown?.id}?</DialogTitle><DialogDescription>Zamówienie zniknie z baru i kuchni. W razie pomyłki przywrócisz je przyciskiem „Cofnij” albo w zakładce Historia.</DialogDescription></DialogHeader>
            <DialogFooter><Button variant="outline" onClick={() => setCancelTarget(null)}>Wróć</Button><Button variant="destructive" onClick={() => { if (cancelTarget) void runAction(cancelTarget, 'cancel_order'); setCancelTarget(null) }}>Tak, anuluj</Button></DialogFooter>
          </>}
        </DialogContent>
      </Dialog>


      <WorkshopProblemDialog target={problemTarget} onClose={() => setProblemTarget(null)} onSubmit={(target, reason) => {
        const order = ordersRef.current.find((item) => item.id === target.orderId)
        if (order) void runAction(order, 'report_problem', target.item.index, reason)
        setProblemTarget(null)
      }} />
      <WorkshopSettleDialog order={settleOrder} onClose={() => void closeSettle()} onPrintFailed={() => void settlePrintFailed()}
        saveState={settleSave?.state ?? null}
        onRetrySave={settleSave ? () => void savePaidOrder(settleSave.entry) : undefined}
        onEditDraft={settleSave ? () => { const { entry } = settleSave; pendingSettleRef.current = null; setSettleSave(null); setSettleOrder(null); editDraft(entry) } : undefined}
          onDiscardDraft={settleSave?.state.status === 'error' ? () => discardUnsaved(settleSave.entry) : undefined} />
      <WorkshopPrintDialog order={handOffTarget?.mode === 'print' ? handOffTarget.order : null} onClose={() => setHandOffTarget(null)} onHandOff={handOffLatest} />
      <WorkshopPaymentDialog order={handOffTarget?.mode === 'pay' ? handOffTarget.order : null} onClose={() => setHandOffTarget(null)} onHandOff={handOffLatest} />
      <WorkshopReceiptRecoveryDialog />
    </div>
  )
}

function HeaderClock() {
  const now = useNow()
  return <div className="hidden min-w-[66px] text-right sm:block"><p className="text-[14px] font-bold leading-tight tabular-nums">{now ? new Date(now).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' }) : '—:—'}</p><p className="mt-0.5 text-[10px] text-[#756e67]">{now ? new Date(now).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', timeZone: 'Europe/Warsaw' }) : 'Warsztat'}</p></div>
}
