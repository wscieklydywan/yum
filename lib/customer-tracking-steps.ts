import { Bike, Check, ChefHat, ClipboardCheck, PackageCheck, Store, type LucideIcon } from 'lucide-react'

export type TrackingStatus = 'new' | 'preparing' | 'ready' | 'handed_off' | 'cancelled'

export type TrackingStepDefinition = { label: string; hint: string; icon: LucideIcon }

/** The exact stages a Yummy Club customer sees – shared by the club tracker and the bar's preview. */
export function trackingSteps(type: string): TrackingStepDefinition[] {
  const delivery = type === 'Dostawa'
  return [
    { label: 'Złożone', hint: 'Czekamy, aż bar potwierdzi zamówienie.', icon: ClipboardCheck },
    { label: 'Na kuchni', hint: 'Bar przyjął zamówienie – kuchnia już przygotowuje.', icon: ChefHat },
    {
      label: 'Gotowe',
      hint: delivery ? 'Zamówienie gotowe – czeka na kierowcę.' : 'Gotowe do odbioru w lokalu.',
      icon: delivery ? PackageCheck : Store,
    },
    ...(delivery ? [{ label: 'W trasie', hint: 'Kierowca jest w drodze do Ciebie. Miej telefon pod ręką!', icon: Bike }] : []),
    {
      label: delivery ? 'Dostarczone' : 'Odebrane',
      hint: delivery ? 'Zamówienie dostarczone. Smacznego!' : 'Zamówienie wydane. Smacznego!',
      icon: Check,
    },
  ]
}

export const TRACKING_STEP_INDEX: Record<TrackingStatus, number> = { new: 0, preparing: 1, ready: 2, handed_off: 3, cancelled: -1 }

/** Step index including the delivery-only „W trasie” stage. */
export function trackingStepIndex(order: { status: TrackingStatus; type: string; out_for_delivery_at?: string | null }) {
  const base = TRACKING_STEP_INDEX[order.status]
  if (order.type !== 'Dostawa' || base < 2) return base
  if (order.status === 'handed_off') return 4
  return order.out_for_delivery_at ? 3 : 2
}
