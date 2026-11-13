'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import type { Promotion } from './promotions'

export const PROMOTIONS_KEY = '/api/promotions'

async function fetchPromotions(url: string): Promise<Promotion[]> {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (!response.ok) throw new Error('Nie udało się pobrać promocji')
  return response.json()
}

/** Active promotions plus a clock that ticks every 30 s, so "running now" flips on and off on schedule without a reload. */
export function usePromotions() {
  const { data, isLoading } = useSWR<Promotion[]>(PROMOTIONS_KEY, fetchPromotions, { revalidateOnFocus: true, focusThrottleInterval: 60_000 })
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const interval = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(interval)
  }, [])
  return { promotions: data ?? [], now, isLoading: isLoading || now === null }
}
