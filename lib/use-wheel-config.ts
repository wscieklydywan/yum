'use client'

import useSWR from 'swr'
import { DEFAULT_WHEEL_CONFIG, WHEEL_CONFIG_KEY, type WheelConfig } from './marketing'

async function fetchConfig(url: string): Promise<WheelConfig> {
  const response = await fetch(url)
  if (!response.ok) return DEFAULT_WHEEL_CONFIG
  return response.json()
}

export function useWheelConfig() {
  const { data } = useSWR(WHEEL_CONFIG_KEY, fetchConfig, { fallbackData: DEFAULT_WHEEL_CONFIG, revalidateOnFocus: false, dedupingInterval: 60_000 })
  return data ?? DEFAULT_WHEEL_CONFIG
}
