'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

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
    return () => window.removeEventListener('popstate', onPopState)
  }, [key, initial])

  const navigate = useCallback((next: T) => {
    if (next === current.current) return
    const state: Record<string, unknown> = { ...window.history.state, [key]: next }
    delete state.modal
    for (const nested of clearsRef.current) delete state[nested]
    window.history.pushState(state, '')
    current.current = next
    setView(next)
  }, [key])

  return [view, navigate] as const
}
