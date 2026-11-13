'use client'

import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Bike, ChefHat, LogOut, PackageCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/yummy/logo'
import { applyOrderAction, activeStatuses, isInDelivery, type KitchenOrder, type OrderAction } from '@/components/warsztat/order-data'
import { useOrdersSync } from '@/components/warsztat/use-orders-sync'
import { ConnectionDot } from '@/components/warsztat/workshop-connection-status'
import { DriverOrderCard } from './driver-order-card'
import { DriverReturnDialog } from './driver-return-dialog'
import { DriverInstallButton, DriverRefreshButton } from './driver-app-controls'

type Props = { userId: string; userEmail: string; role: string }

const isActive = (order: KitchenOrder) => (activeStatuses as string[]).includes(order.status)
const byReady = (a: KitchenOrder, b: KitchenOrder) => (a.readyAt ?? a.receivedAt ?? '').localeCompare(b.readyAt ?? b.receivedAt ?? '')

export function DriverBoard({ userId, userEmail, role }: Props) {
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const ordersRef = useRef<KitchenOrder[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [returning, setReturning] = useState<KitchenOrder | null>(null)

  function commit(next: KitchenOrder[]) {
    ordersRef.current = next
    setOrders(next)
  }

  const { syncState } = useOrdersSync({
    userId,
    role,
    ordersRef,
    commitOrders: commit,
    onOrderChange: (previous, next) => {
      if (next.type === 'Dostawa' && previous?.status !== 'ready' && next.status === 'ready') toast.success(`${next.id} gotowe do wyjazdu`)
    },
  })

  const deliveries = useMemo(() => orders.filter((order) => order.type === 'Dostawa'), [orders])
  const onRoute = deliveries.filter(isInDelivery).sort(byReady)
  const mine = onRoute.filter((order) => order.driverId === userId)
  const others = onRoute.filter((order) => order.driverId !== userId)
  const waiting = deliveries.filter((order) => order.status === 'ready' && !isInDelivery(order)).sort(byReady)
  const cooking = deliveries.filter((order) => order.status === 'new' || order.status === 'preparing')

  async function act(order: KitchenOrder, action: OrderAction, value?: string) {
    if (!order.databaseId || busyId) return
    const snapshot = ordersRef.current
    const optimistic = applyOrderAction(order, action, undefined, value)
    const withDriver = action === 'start_delivery' ? { ...optimistic, driverId: userId } : optimistic
    commit(isActive(withDriver)
      ? snapshot.map((item) => item.databaseId === order.databaseId ? withDriver : item)
      : snapshot.filter((item) => item.databaseId !== order.databaseId))
    setBusyId(order.databaseId)
    try {
      const { error } = await createClient().rpc('workshop_order_action', { p_order_id: order.databaseId, p_action: action, p_index: null, p_value: value ?? null })
      if (error) throw new Error(error.message)
      if (action === 'hand_off') toast.success(`${order.id} dostarczone`)
    } catch (error) {
      commit(snapshot)
      toast.error(error instanceof Error && error.message ? error.message : 'Nie udało się zapisać. Spróbuj ponownie.')
    } finally {
      setBusyId(null)
    }
  }

  async function signOut() {
    await createClient().auth.signOut({ scope: 'local' })
    window.location.assign('/kierowca')
  }

  return (
    <div className="min-h-dvh bg-[#f6f3ef] text-[#211e1b]">
      <header className="sticky top-0 z-10 border-b border-[#e5ded6] bg-[#f6f3ef]/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo className="h-7 w-auto" />
            <span className="rounded-full bg-[#211e1b] px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">Kierowca</span>
            <ConnectionDot sync={syncState} />
          </div>
          <div className="flex items-center gap-1">
          <DriverInstallButton />
          <DriverRefreshButton />
          <button type="button" onClick={signOut} className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#706961] hover:bg-[#eae5de] hover:text-[#211e1b]" aria-label={`Wyloguj ${userEmail}`}>
            <LogOut className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Wyloguj</span>
          </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-5 pb-16">
        <Section icon={Bike} title="Jadę z tym" count={mine.length} tone="route" empty="Nie wieziesz teraz żadnego zamówienia.">
          {mine.map((order) => (
            <DriverOrderCard key={order.databaseId ?? order.id} order={order} busy={busyId === order.databaseId} variant="mine"
              onDelivered={() => act(order, 'hand_off')} onReturn={() => setReturning(order)} />
          ))}
        </Section>

        <Section icon={PackageCheck} title="Gotowe do wyjazdu" count={waiting.length} tone="ready" empty="Nic nie czeka na wyjazd.">
          {waiting.map((order) => (
            <DriverOrderCard key={order.databaseId ?? order.id} order={order} busy={busyId === order.databaseId} variant="waiting"
              onStart={() => act(order, 'start_delivery')} />
          ))}
        </Section>

        {others.length > 0 && (
          <Section icon={Bike} title="W trasie – inni kierowcy" count={others.length} tone="muted">
            {others.map((order) => <DriverOrderCard key={order.databaseId ?? order.id} order={order} variant="other" />)}
          </Section>
        )}

        {cooking.length > 0 && (
          <Section icon={ChefHat} title="Jeszcze na kuchni" count={cooking.length} tone="muted">
            {cooking.map((order) => <DriverOrderCard key={order.databaseId ?? order.id} order={order} variant="cooking" />)}
          </Section>
        )}
      </main>

      <DriverReturnDialog order={returning} onClose={() => setReturning(null)} onConfirm={(reason) => {
        const order = returning
        setReturning(null)
        if (order) void act(order, 'return_delivery', reason)
      }} />
    </div>
  )
}

type SectionProps = { icon: typeof Bike; title: string; count: number; tone: 'route' | 'ready' | 'muted'; empty?: string; children: React.ReactNode }

function Section({ icon: Icon, title, count, tone, empty, children }: SectionProps) {
  const badge = tone === 'route' ? 'bg-sky-600 text-white' : tone === 'ready' ? 'bg-emerald-600 text-white' : 'bg-[#e5ded6] text-[#706961]'
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-[#706961]">
        <Icon className="size-4" aria-hidden="true" />
        {title}
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${badge}`}>{count}</span>
      </h2>
      {count === 0 && empty ? <p className="rounded-2xl border border-dashed border-[#ddd5cc] px-4 py-6 text-center text-sm text-[#706961]">{empty}</p> : children}
    </section>
  )
}
