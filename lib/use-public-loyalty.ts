'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { buildTiers } from './loyalty'
import { FALLBACK_LOYALTY, PUBLIC_LOYALTY_KEY, type PublicLoyalty } from './loyalty-public'

async function fetchLoyalty(url: string): Promise<PublicLoyalty> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Nie udało się wczytać nagród')
  return response.json()
}

/** Earn rate and rewards as configured in Warsztat. `undefined` while the first request is in flight. */
export function usePublicLoyalty() {
  const { data, error } = useSWR(PUBLIC_LOYALTY_KEY, fetchLoyalty, { revalidateOnFocus: true, dedupingInterval: 30_000 })
  return data ?? (error ? FALLBACK_LOYALTY : undefined)
}

/** Tier thresholds, discounts and perks as saved in Warsztat → Yummy Club. */
export function useClubTiers() {
  const settings = usePublicLoyalty()?.tiers
  return useMemo(() => buildTiers(settings ?? FALLBACK_LOYALTY.tiers), [settings])
}
