'use client'

import { useEffect, useState } from 'react'

/** GTA VI contest draw: 19 November 2026, 15:00 Polish time (CET). */
export const VICE_RESULTS_AT = Date.parse('2026-11-19T15:00:00+01:00')

/** Milliseconds left, or null before the first client render so server and client markup match. */
export type Remaining = number | null

export function useViceCountdown(): Remaining {
  const [remaining, setRemaining] = useState<Remaining>(null)

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, VICE_RESULTS_AT - Date.now()))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  return remaining
}

export function splitRemaining(ms: number) {
  const total = Math.floor(ms / 1000)
  return { hours: Math.floor(total / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 }
}

export function formatRemaining(ms: number) {
  const { hours, minutes, seconds } = splitRemaining(ms)
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}
