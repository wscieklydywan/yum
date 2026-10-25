'use client'

import { useMemo, useRef, useState } from 'react'
import { ChefHat, CircleCheck, Circle, GraduationCap, RotateCcw, Store, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SettingsCard } from '../workshop-settings-layout'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { primaryMethod } from '@/lib/payment-split'
import { activeStatuses, applyOrderAction, hasUnbilledItems, isOrderPaid, statusLabels, type ActiveOrderStatus, type KitchenOrder, type OrderAction, type OrderStatus, type Station } from '../order-data'
import { WorkshopOrderCard, type OrderPermissions } from '../workshop-order-card'
import { WorkshopKitchenBoard } from '../workshop-kitchen-board'
import { WorkshopOrderActions } from '../workshop-order-actions'
import { WorkshopOrderDetails } from '../workshop-order-details'
import { WorkshopSettleDialog } from '../workshop-settle-dialog'
import { WorkshopPaymentDialog } from '../workshop-payment-dialog'
import { WorkshopPrintDialog } from '../workshop-print-dialog'
import { WorkshopProblemDialog, type ProblemTarget } from '../workshop-problem-dialog'
import type { PendingOrder } from '../pending-orders'
import { TRAINING_NOTE, TrainingSandboxContext, type TrainingSandbox } from './training-sandbox'

type TrainingStep = 'add' | 'accept' | 'bar_items' | 'kitchen' | 'settle' | 'hand_off'

const steps: { key: TrainingStep; title: string; hint: string }[] = [
  { key: 'add', title: 'Dodaj zamówienie', hint: 'Kliknij „Dodaj zamówienie”, wybierz typ i produkty z prawdziwego menu (dodaj też napój), potem „Dodaj”. Zamówienie trafia do kolejki „Nowe”.' },
  { key: 'accept', title: 'Akceptuj – idzie na kuchnię', hint: 'Na karcie w „Nowe” kliknij „Akceptuj zamówienie”. Od tej chwili kuchnia widzi swoje pozycje.' },
  { key: 'bar_items', title: 'Zrób pozycje baru', hint: 'W „W realizacji” na karcie jest pole „Twoje pozycje” (np. napoje). Odhacz je, gdy są gotowe.' },
  { key: 'kitchen', title: 'Zobacz kuchnię', hint: 'Przełącz na „Kuchnia” u góry i odhacz dania – tak robi to kucharz. Gdy wszystko gotowe, zamówienie przechodzi do „Gotowe”.' },
  { key: 'settle', title: 'Rozlicz', hint: 'Kliknij „Rozlicz” na karcie, wybierz „Opłać + paragon”, formę płatności i potwierdź. Paragon nie drukuje się naprawdę.' },
  { key: 'hand_off', title: 'Wydaj klientowi', hint: 'W „Gotowe” kliknij „Wydane”. Zamówienie znika z ekranu – to koniec jego drogi.' },
]

const permissions: OrderPermissions = { canManage: true, canHandOff: true, canKitchen: true }
const isActive = (order: KitchenOrder) => (activeStatuses as OrderStatus[]).includes(order.status)
const laneColors: Record<ActiveOrderStatus, string> = { new: 'bg-primary', preparing: 'bg-amber-500', ready: 'bg-emerald-600' }
const BAR_ITEM = /nap[oó]j|pepsi|cola|woda|kawa|lungo|espresso|cappuccino|latte|herbat|lemoniad|shake|sok|piwo|7up|mirinda|fanta|sprite/i
const stationOf = (name: string): Station => BAR_ITEM.test(name) ? 'cashier' : 'kitchen'
const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches

export function WorkshopTraining({ onExit }: { onExit: () => void }) {
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const ordersRef = useRef<KitchenOrder[]>([])
  const counterRef = useRef(1)
  const doneRef = useRef<Set<TrainingStep>>(new Set())
  const [done, setDone] = useState<Set<TrainingStep>>(new Set())
  const [view, setView] = useState<'cashier' | 'kitchen'>('cashier')
  const [activeStatus, setActiveStatus] = useState<ActiveOrderStatus>('new')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false)
  const [settleId, setSettleId] = useState<string | null>(null)
  const acceptAfterSettleRef = useRef<string | null>(null)
  const [handOffTarget, setHandOffTarget] = useState<{ id: string; mode: 'pay' | 'print' } | null>(null)
  const [cancelTarget, setCancelTarget] = useState<KitchenOrder | null>(null)
  const [problemTarget, setProblemTarget] = useState<ProblemTarget | null>(null)
  const [actionsKey, setActionsKey] = useState(0)

  const byDatabaseId = (id: string | null) => (id ? orders.find((order) => order.databaseId === id) ?? null : null)

  function commit(next: KitchenOrder[]) {
    ordersRef.current = next
    setOrders(next)
  }

  function update(databaseId: string, change: (order: KitchenOrder) => KitchenOrder) {
    commit(ordersRef.current.map((order) => order.databaseId === databaseId ? change(order) : order))
  }

  function complete(step: TrainingStep) {
    if (doneRef.current.has(step)) return
    const next = new Set(doneRef.current).add(step)
    doneRef.current = next
    setDone(next)
    const title = steps.find((item) => item.key === step)?.title
    toast.success(`Krok zaliczony: ${title}`, { description: next.size === steps.length ? 'Wszystkie kroki przerobione – świetnie!' : undefined })
  }

  function createOrder(provisional: KitchenOrder) {
    const number = counterRef.current++
    const now = new Date()
    const order: KitchenOrder = {
      ...provisional,
      id: `#S${number}`,
      databaseId: `training-${number}`,
      status: 'new',
      created: now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' }),
      receivedAt: now.toISOString(),
      eta: provisional.type === 'Dostawa' ? '30–40 min' : provisional.type === 'Stacjonarnie' ? 'Na miejscu' : 'Odbiór za 20 min',
      items: provisional.items.map((item) => ({ ...item, station: item.station ?? stationOf(item.name), receipted: 0 })),
    }
    commit([...ordersRef.current, order])
    setActiveStatus('new')
    setSelectedId(order.id)
    complete('add')
    return order
  }

  const sandbox: TrainingSandbox = {
    createOrder,
    recordPayment(databaseId, payment) {
      const method = payment.split ? primaryMethod(payment.split) : payment.method ?? 'cash'
      update(databaseId, (order) => ({ ...order, paidAt: new Date().toISOString(), paymentMethod: method, paymentSplit: payment.split, buyerNip: payment.buyerNip || order.buyerNip }))
      complete('settle')
    },
    undoPayment(databaseId) {
      update(databaseId, (order) => ({ ...order, paidAt: undefined, paymentMethod: undefined, paymentSplit: undefined }))
    },
    issueDocument(databaseId, request) {
      if (request.kind !== 'receipt') return
      update(databaseId, (order) => ({
        ...order,
        receiptPaymentMethod: request.payment,
        buyerNip: request.buyerNip || order.buyerNip,
        items: order.items.map((item) => ({ ...item, receipted: item.quantity })),
        ...(request.paid ? { paidAt: new Date().toISOString(), paymentMethod: request.split ? primaryMethod(request.split) : request.payment, paymentSplit: request.split } : {}),
      }))
      if (request.paid) complete('settle')
    },
  }

  function runAction(order: KitchenOrder, action: OrderAction, index?: number, value?: string) {
    const latest = ordersRef.current.find((item) => item.id === order.id) ?? order
    const next = applyOrderAction(latest, action, index, value)
    commit(isActive(next) ? ordersRef.current.map((item) => item.id === order.id ? next : item) : ordersRef.current.filter((item) => item.id !== order.id))

    if (action === 'accept') {
      setActiveStatus('preparing')
      complete('accept')
    }
    if (action === 'toggle_item' && value === 'true' && index !== undefined) {
      complete((latest.items[index]?.station ?? 'kitchen') === 'cashier' ? 'bar_items' : 'kitchen')
    }
    if (latest.status !== 'ready' && next.status === 'ready') toast.success(`${order.id} gotowe do wydania`)
    if (action === 'hand_off') {
      setMobileDetailsOpen(false)
      complete('hand_off')
    }
    if (action === 'cancel_order') toast.info(`${order.id} anulowane`, { description: 'W pracy zamówienie trafiłoby do Historii, skąd można je przywrócić.' })
    if (action === 'resolve_problem') toast.success('Problem oznaczony jako rozwiązany')
  }

  function requestAction(order: KitchenOrder, action: OrderAction, index?: number, value?: string) {
    const latest = ordersRef.current.find((item) => item.id === order.id) ?? order
    if (action === 'hand_off' && (!isOrderPaid(latest) || hasUnbilledItems(latest))) {
      setMobileDetailsOpen(false)
      setHandOffTarget({ id: latest.databaseId!, mode: isOrderPaid(latest) ? 'print' : 'pay' })
      return
    }
    runAction(latest, action, index, value)
  }

  function handOffLatest(order: KitchenOrder) {
    const latest = ordersRef.current.find((item) => item.databaseId === order.databaseId) ?? order
    runAction(latest, 'hand_off')
  }

  function openSettle(order: KitchenOrder) {
    setMobileDetailsOpen(false)
    setSettleId(order.databaseId ?? null)
  }

  function startPaidOrder(entry: PendingOrder) {
    const order = createOrder(entry.provisional)
    acceptAfterSettleRef.current = order.databaseId!
    setSettleId(order.databaseId!)
  }

  /** Same as the real bar: a „Dodaj i rozlicz” order goes to the kitchen only once it is paid and receipted. */
  function closeSettle() {
    setSettleId(null)
    const databaseId = acceptAfterSettleRef.current
    acceptAfterSettleRef.current = null
    const fresh = databaseId ? ordersRef.current.find((order) => order.databaseId === databaseId) : null
    if (!fresh || fresh.status !== 'new') return
    if (isOrderPaid(fresh) && !hasUnbilledItems(fresh)) {
      runAction(fresh, 'accept')
      return
    }
    toast.info(`${fresh.id} czeka w „Nowe”`, { description: isOrderPaid(fresh) ? 'Opłacone, ale bez paragonu. Wydrukuj paragon przez „Rozlicz” albo kliknij „Akceptuj zamówienie”.' : 'Nie zostało opłacone, więc nie poszło na kuchnię. Rozlicz je albo zaakceptuj ręcznie.' })
  }

  function selectOrder(order: KitchenOrder) {
    setSelectedId(order.id)
    if (!isDesktop()) setMobileDetailsOpen(true)
  }

  function notInTraining() {
    toast.info('Ta funkcja nie jest dostępna w szkoleniu', { description: 'Edycję pozycji i zwroty pokaże Ci osoba szkoląca na prawdziwym zamówieniu.' })
  }

  function reset() {
    commit([])
    counterRef.current = 1
    doneRef.current = new Set()
    setDone(new Set())
    setView('cashier')
    setActiveStatus('new')
    setSelectedId(null)
    setActionsKey((key) => key + 1)
    toast.info('Szkolenie zaczęte od nowa')
  }

  const counts = useMemo(() => activeStatuses.reduce((result, status) => {
    result[status] = orders.filter((order) => order.status === status).length
    return result
  }, { new: 0, preparing: 0, ready: 0 } as Record<ActiveOrderStatus, number>), [orders])

  const nextStep = steps.find((step) => !done.has(step.key))
  const selectedOrder = orders.find((order) => order.id === selectedId) ?? orders[0]
  const handOffOrder = handOffTarget ? byDatabaseId(handOffTarget.id) : null

  const details = (order: KitchenOrder, mobile: boolean) => <WorkshopOrderDetails order={order} permissions={permissions} scrollWhole={!mobile} previewTab={!mobile}
    onClose={mobile ? () => setMobileDetailsOpen(false) : undefined}
    onSettle={() => openSettle(order)}
    onAction={(action) => requestAction(order, action)}
    onCancelOrder={() => { setMobileDetailsOpen(false); setCancelTarget(order) }}
    onEditItem={notInTraining}
    onRefund={notInTraining} />

  return (
    <TrainingSandboxContext.Provider value={sandbox}>
      <div className="flex flex-1 flex-col gap-4">
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500 text-white"><GraduationCap className="size-5" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-amber-900">Tryb szkoleniowy</p>
            <p className="text-xs leading-relaxed text-amber-800">Te same okna co w pracy, ale to symulacja – {TRAINING_NOTE.split('– ')[1]}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="bg-white" onClick={reset}><RotateCcw data-icon="inline-start" />Od nowa</Button>
            <Button size="sm" className="bg-amber-900 text-white hover:bg-amber-950" onClick={onExit}><X data-icon="inline-start" />Zakończ</Button>
          </div>
        </div>

        <div className="grid flex-1 items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">{view === 'kitchen' ? <ChefHat className="size-[17px] text-primary" aria-hidden="true" /> : <Store className="size-[17px] text-primary" aria-hidden="true" />}<p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b827a]">{view === 'kitchen' ? 'Stanowisko kuchni' : 'Stanowisko baru'}</p></div>
                <h1 className="mt-1 text-[21px] font-extrabold tracking-tight sm:text-[24px]">{view === 'kitchen' ? 'Kuchnia' : 'Zamówienia'}</h1>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                <div role="group" aria-label="Widok stanowiska" className="flex rounded-xl border border-[#e5ded6] bg-[#eae5de] p-1">
                  {(['cashier', 'kitchen'] as const).map((option) => <button key={option} type="button" aria-pressed={view === option} onClick={() => setView(option)} className={cn('h-8 rounded-lg px-3 text-xs font-semibold transition-colors', view === option ? 'bg-white text-[#211e1b] shadow-sm' : 'text-[#706961] hover:text-[#211e1b]')}>{option === 'cashier' ? 'Bar' : 'Kuchnia'}</button>)}
                </div>
                {view === 'cashier' && <WorkshopOrderActions key={actionsKey} onPayStart={startPaidOrder} />}
              </div>
            </div>

            {view === 'kitchen'
              ? <WorkshopKitchenBoard orders={orders} onToggle={(order, item) => runAction(order, 'toggle_item', item.index, String(!item.done))} onProblem={(order, item) => setProblemTarget({ orderId: order.id, orderLabel: order.id, item })} />
              : <>
                <nav aria-label="Status zamówień" className="grid grid-cols-3 gap-1 rounded-xl border border-[#e5ded6] bg-[#eae5de] p-1 lg:hidden">
                  {activeStatuses.map((status) => <button key={status} type="button" onClick={() => setActiveStatus(status)} aria-pressed={activeStatus === status} className={cn('flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 transition-colors', activeStatus === status ? 'bg-white text-[#211e1b] shadow-sm' : 'text-[#706961] hover:text-[#211e1b]')}><span className="text-lg font-black leading-none tabular-nums">{counts[status]}</span><span className="truncate text-[10px] font-semibold uppercase tracking-wide">{status === 'preparing' ? 'W realizacji' : statusLabels[status]}</span></button>)}
                </nav>
                <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_350px]">
                  <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-3">
                    {activeStatuses.map((status) => {
                      const laneOrders = orders.filter((order) => order.status === status)
                      return <section key={status} aria-labelledby={`training-lane-${status}`} className={cn('min-w-0', status !== activeStatus && 'hidden lg:block')}>
                        <div className="mb-3 hidden items-center justify-between gap-2 px-0.5 lg:flex"><h2 id={`training-lane-${status}`} className="text-[15px] font-bold tracking-tight">{status === 'preparing' ? 'W realizacji' : statusLabels[status]}</h2><span className={cn('grid min-w-6 place-items-center rounded-full px-2 py-0.5 text-[11px] font-bold text-white', laneColors[status])}>{counts[status]}</span></div>
                        <div className="flex flex-col gap-3">
                          {laneOrders.map((order) => <WorkshopOrderCard key={order.id} order={order} selected={selectedOrder?.id === order.id} permissions={permissions} onSelect={selectOrder} onSettle={openSettle} onAction={requestAction} onCancelOrder={setCancelTarget} />)}
                          {laneOrders.length === 0 && <div className="rounded-2xl border border-dashed border-[#d8d0c7] bg-white/50 px-4 py-8 text-center text-[12px] text-[#847c74]">{status === 'new' ? 'Kliknij „Dodaj zamówienie”, żeby zacząć.' : 'Brak zamówień w tej kolejce.'}</div>}
                        </div>
                      </section>
                    })}
                  </div>
                  <aside aria-label="Szczegóły wybranego zamówienia" className="hidden rounded-2xl xl:block">
                    {selectedOrder ? details(selectedOrder, false) : <div className="grid min-h-60 place-items-center rounded-2xl border border-dashed border-[#d8d0c7] text-[12px] text-[#847c74]">Wybierz zamówienie</div>}
                  </aside>
                </div>
              </>}
          </div>

          <aside aria-label="Kroki szkolenia" className="order-first rounded-2xl border border-[#e5ded6] bg-white p-4 2xl:sticky 2xl:top-0 2xl:order-none">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-bold">Kroki szkolenia</h2>
              <span className="rounded-full bg-[#f3f0ec] px-2.5 py-1 text-[11px] font-bold tabular-nums text-[#716a63]">{done.size}/{steps.length}</span>
            </div>
            <ol className="flex flex-col gap-1">
              {steps.map((step, index) => {
                const isDone = done.has(step.key)
                const isNext = nextStep?.key === step.key
                return <li key={step.key} className={cn('flex gap-2.5 rounded-xl p-2.5', isNext && 'bg-amber-50 ring-1 ring-amber-200', !isNext && !isDone && 'hidden 2xl:flex')}>
                  {isDone ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" /> : <Circle className={cn('mt-0.5 size-4 shrink-0', isNext ? 'text-amber-600' : 'text-[#c9c1b8]')} aria-hidden="true" />}
                  <div className="min-w-0">
                    <p className={cn('text-[13px] font-bold', isDone && 'text-[#8b827a] line-through')}>{index + 1}. {step.title}<span className="sr-only">{isDone ? ' – zrobione' : isNext ? ' – następny krok' : ''}</span></p>
                    {!isDone && <p className="mt-0.5 text-xs leading-relaxed text-[#847c74]">{step.hint}</p>}
                  </div>
                </li>
              })}
            </ol>
            {!nextStep && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800">Gotowe! Możesz dodać kolejne zamówienie, kliknąć „Od nowa” albo zakończyć szkolenie.</p>}
          </aside>
        </div>

        <Dialog open={mobileDetailsOpen && !!selectedOrder} onOpenChange={setMobileDetailsOpen}>
          <DialogContent showCloseButton={false} aria-describedby={undefined} className="workshop-dashboard max-h-[92dvh] gap-0 overflow-hidden p-0 sm:max-w-xl">
            <DialogTitle className="sr-only">Szczegóły zamówienia {selectedOrder?.id}</DialogTitle>
            {selectedOrder && <div className="flex max-h-[calc(90dvh/var(--ui-zoom,1))] min-h-0 flex-col">{details(selectedOrder, true)}</div>}
          </DialogContent>
        </Dialog>

        <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null) }}>
          <DialogContent className="workshop-dashboard sm:max-w-sm">
            <DialogHeader><DialogTitle>Czy na pewno anulować {cancelTarget?.id}?</DialogTitle><DialogDescription>Zamówienie zniknie z baru i kuchni. W razie pomyłki przywrócisz je przyciskiem „Cofnij” albo w zakładce Historia.</DialogDescription></DialogHeader>
            <DialogFooter><Button variant="outline" onClick={() => setCancelTarget(null)}>Wróć</Button><Button variant="destructive" onClick={() => { if (cancelTarget) runAction(cancelTarget, 'cancel_order'); setCancelTarget(null) }}>Tak, anuluj</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <WorkshopProblemDialog target={problemTarget} onClose={() => setProblemTarget(null)} onSubmit={(target, reason) => {
          const order = ordersRef.current.find((item) => item.id === target.orderId)
          if (order) runAction(order, 'report_problem', target.item.index, reason)
          setProblemTarget(null)
        }} />
        <WorkshopSettleDialog order={byDatabaseId(settleId)} onClose={closeSettle} />
        <WorkshopPrintDialog order={handOffTarget?.mode === 'print' ? handOffOrder : null} onClose={() => setHandOffTarget(null)} onHandOff={handOffLatest} />
        <WorkshopPaymentDialog order={handOffTarget?.mode === 'pay' ? handOffOrder : null} onClose={() => setHandOffTarget(null)} onHandOff={handOffLatest} />
      </div>
    </TrainingSandboxContext.Provider>
  )
}

export function WorkshopTrainingSettings({ onStart }: { onStart: () => void }) {
  return (
    <SettingsCard
      icon={GraduationCap}
      iconClassName="bg-amber-100 text-amber-700"
      title="Tryb szkoleniowy"
      titleId="training-settings-title"
      description="Bezpieczna symulacja baru dla nowych pracowników: dodawanie zamówienia, akceptacja na kuchnię i rozliczenie. Nic nie jest zapisywane ani drukowane."
      action={<Button onClick={onStart} className="w-full bg-amber-500 text-white hover:bg-amber-600 sm:w-auto"><GraduationCap data-icon="inline-start" />Uruchom szkolenie</Button>}
    />
  )
}
