'use client'

import { useEffect } from 'react'

let handled = false

/**
 * When the home page document is reloaded through the browser's Back button (e.g. after signing in
 * to Yummy Club, which does a full page load), the browser restores a stale scroll offset that lands
 * mid-page (often on FAQ) because the page height changes as sections load. Start at the top instead.
 */
export function BackNavigationScrollReset() {
  useEffect(() => {
    if (handled) return
    handled = true

    const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
    if (entry?.type !== 'back_forward' || window.location.hash) return

    history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)

    const settle = () => {
      window.scrollTo(0, 0)
      history.scrollRestoration = 'auto'
    }
    if (document.readyState === 'complete') {
      const id = window.setTimeout(settle, 150)
      return () => window.clearTimeout(id)
    }
    window.addEventListener('load', settle, { once: true })
    return () => window.removeEventListener('load', settle)
  }, [])

  return null
}
