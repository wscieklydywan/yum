'use client'

import { useEffect, useState } from 'react'
import useSWR, { mutate as mutateGlobal } from 'swr'
import type { Promotion } from './promotions'
import { PROMOTIONS_KEY } from './use-promotions'

export const WORKSHOP_PROMOTIONS_KEY = '/api/workshop/promotions'

export type PromotionCategory = { id: string; label: string }
export type PromotionProduct = { id: string; name: string; category_id: string | null }
export type WorkshopPromotionData = { promotions: Promotion[]; categories: PromotionCategory[]; products: PromotionProduct[] }

async function fetchPromotionData(url: string): Promise<WorkshopPromotionData> {
  const response = await fetch(url, { credentials: 'same-origin' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? 'Nie udało się wczytać promocji.')
  return data
}

export async function sendPromotion(method: 'POST' | 'PATCH' | 'DELETE', body?: unknown, query = ''): Promise<WorkshopPromotionData> {
  const response = await fetch(`${WORKSHOP_PROMOTIONS_KEY}${query}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? 'Operacja nie powiodła się.')
  await Promise.all([mutateGlobal(WORKSHOP_PROMOTIONS_KEY, data, { revalidate: false }), mutateGlobal(PROMOTIONS_KEY)])
  return data
}

export function useWorkshopPromotions() {
  return useSWR<WorkshopPromotionData>(WORKSHOP_PROMOTIONS_KEY, fetchPromotionData)
}

/** Ticks every 30 s so schedule-based status ("trwa teraz") updates without a reload. */
export function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(interval)
  }, [])
  return now
}
