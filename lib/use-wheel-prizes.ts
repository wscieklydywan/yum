'use client'

import useSWR from 'swr'
import { DEFAULT_WHEEL_PRIZES, WHEEL_PRIZES_KEY, type WheelPrize } from './wheel'

async function fetchWheelPrizes(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Nie udało się pobrać nagród koła.')
  const data = (await response.json()) as { prizes: WheelPrize[] }
  return data.prizes.length ? data.prizes : DEFAULT_WHEEL_PRIZES
}

export function useWheelPrizes() {
  return useSWR(WHEEL_PRIZES_KEY, fetchWheelPrizes, {
    fallbackData: DEFAULT_WHEEL_PRIZES,
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })
}
