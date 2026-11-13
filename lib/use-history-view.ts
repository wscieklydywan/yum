'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const SYNC_EVENT = 'history-view-sync'

function readState<T extends string>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  return (window.history.state?.[key] as T | undefined) ?? fallback
}

/**
 * View state stored in browser history: every change adds an entry, so the phone back button / back gesture
 * returns to the previous view instead of leaving the page. `clears` lists keys of nested views that should start
 * fresh when this view changes (e.g. marketing sub-page when switching the workshop section).
 */
export function useHistoryView<T extends string>(key: string, initial: T, clears: string[] = []) {
  const [view, setView] = useState<T>(() => readState(key, initial))
  const current = useRef(view)
  const clearsRef = useRef(clears)
  clearsRef.current = clears

  useEffect(() => {
    const onPopState = () => {
      const next = readState(key, initial)
      current.current = next
      setView(next)
    }
    window.addEventListener('popstate', onPopState)
    window.addEventListener(SYNC_EVENT, onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener(SYNC_EVENT, onPopState)
    }
  }, [key, initial])

  const navigate = useCallback((next: T) => {
    if (next === current.current) return
    const state: Record<string, unknown> = { ...window.history.state, [key]: next }
    delete state.modal
    for (const nested of clearsRef.current) delete state[nested]
    window.history.pushState(state, '')
    current.current = next
    setView(next)
    // Other hooks bound to the same (or a cleared) key — e.g. the sidebar's marketing list — re-read history state.
    window.dispatchEvent(new Event(SYNC_EVENT))
  }, [key])

  return [view, navigate] as const
}
