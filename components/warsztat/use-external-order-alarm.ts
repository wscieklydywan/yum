'use client'

import { useEffect, useRef } from 'react'
import { playExternalOrderAlarm } from '@/lib/notification-sound'
import type { KitchenOrder } from './order-data'

const REPEAT_MS = 5_000

export const isExternalOrder = (order: Pick<KitchenOrder, 'source'>) => (order.source ?? 'yummy') !== 'own'

/** Keeps ringing while an external order (website, Glovo, Pyszne, kiosk) sits unaccepted in „Nowe”. Own bar orders stay silent. */
export function useExternalOrderAlarm(orders: KitchenOrder[], enabled: boolean) {
  const waiting = enabled && orders.some((order) => order.status === 'new' && isExternalOrder(order))
  const waitingRef = useRef(waiting)
  waitingRef.current = waiting

  useEffect(() => {
    if (!waiting) return
    playExternalOrderAlarm()
    const timer = window.setInterval(() => {
      if (waitingRef.current) playExternalOrderAlarm()
    }, REPEAT_MS)
    return () => window.clearInterval(timer)
  }, [waiting])
}
