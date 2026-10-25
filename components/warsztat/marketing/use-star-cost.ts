'use client'

import useSWR from 'swr'
import { REWARDS_ADMIN_KEY, spendPerStar, starRealCost, type RewardsAdminData } from '@/lib/loyalty-economics'
import { fetchJson } from './economics-parts'

/** Wycena 1 Star dla lokalu na podstawie katalogu „Wydaj Stars” i kosztu surowca. */
export function useStarCost() {
  const { data, error, isLoading } = useSWR<RewardsAdminData>(REWARDS_ADMIN_KEY, fetchJson)
  return {
    error,
    isLoading,
    foodCostPercent: data?.foodCostPercent ?? 30,
    starCost: data ? starRealCost(data.rewards, data.foodCostPercent) : 0,
    zlPerStar: data ? spendPerStar(data.rate) : 10,
  }
}
