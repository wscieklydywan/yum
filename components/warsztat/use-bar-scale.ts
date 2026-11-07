'use client'

import { useSyncExternalStore } from 'react'

/*
 * The bar view is tuned on the Galaxy Tab S11 Ultra (14.6", ~1848 CSS px wide). Smaller tablets
 * (11–13") used to get the same pixel sizes in narrower lanes, so cards turned tall and the labels
 * looked oversized. Instead, the whole bar view is zoomed down so it lays out exactly like on the
 * reference tablet, just physically smaller.
 *
 * Reference layout widths (in CSS px of the Ultra):
 * - with the details aside (>=1280px): content area ≈ 1848 - 188 sidebar - 48 padding
 * - without it (1024–1279px): only the three lanes are visible ≈ the Ultra's lanes column
 */
const REFERENCE_CONTENT_WITH_ASIDE = 1600
const REFERENCE_LANES_ONLY = 1216
const SIDEBAR_WIDTH = 188
const MIN_SCALE = 0.75

function computeScale() {
  const width = window.innerWidth
  if (width < 1024) return 1
  const hasAside = width >= 1280
  const content = hasAside ? width - SIDEBAR_WIDTH - 48 : width - 40
  const scale = content / (hasAside ? REFERENCE_CONTENT_WITH_ASIDE : REFERENCE_LANES_ONLY)
  return Math.round(Math.min(1, Math.max(MIN_SCALE, scale)) * 1000) / 1000
}

function subscribe(onChange: () => void) {
  window.addEventListener('resize', onChange)
  window.addEventListener('orientationchange', onChange)
  return () => {
    window.removeEventListener('resize', onChange)
    window.removeEventListener('orientationchange', onChange)
  }
}

export function useBarScale() {
  return useSyncExternalStore(subscribe, computeScale, () => 1)
}
