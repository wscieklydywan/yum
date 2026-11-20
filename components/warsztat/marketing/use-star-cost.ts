'use client'

import useSWR from 'swr'
import { STAR_VALUE_KEY, type StarValue } from '@/lib/loyalty-economics'
import { fetchJson } from './economics-parts'

/** Wycena 1 Star – jedno źródło dla całego panelu, współdzielone przez SWR (jedno zapytanie na minutę). */
export function useStarCost() {
  const { data, error, isLoading } = useSWR<StarValue>(STAR_VALUE_KEY, fetchJson, { dedupingInterval: 60_000, revalidateOnFocus: false })
  return {
    error,
    isLoading,
    data,
    foodCostPercent: data?.foodCostPercent ?? 30,
    starCost: data?.realCost ?? 0,
    zlPerStar: data?.spendPerStar ?? 10,
  }
}
