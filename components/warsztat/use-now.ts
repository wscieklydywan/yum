'use client'

import { useSyncExternalStore } from 'react'

// One shared 1-second clock: every timer ticks in the same frame, and only the components that show time re-render.
let current: number | null = null
let interval: number | undefined
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (interval === undefined) {
    current = Date.now()
    interval = window.setInterval(() => {
      current = Date.now()
      for (const notify of listeners) notify()
    }, 1000)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      window.clearInterval(interval)
      interval = undefined
    }
  }
}

const getSnapshot = () => current
const getServerSnapshot = () => null

export function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
