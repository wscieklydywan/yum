'use client'

import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  document.addEventListener('fullscreenchange', onChange)
  return () => document.removeEventListener('fullscreenchange', onChange)
}

// iPhone Safari has no element fullscreen API, so the toggle is hidden there.
export function useFullscreenSupported() {
  return useSyncExternalStore(subscribe, () => Boolean(document.fullscreenEnabled), () => false)
}

export function useIsFullscreen() {
  return useSyncExternalStore(subscribe, () => document.fullscreenElement !== null, () => false)
}

/** Must be called synchronously inside a click/tap handler; browsers reject it otherwise. */
export function enterFullscreen() {
  if (!document.fullscreenEnabled || document.fullscreenElement) return
  document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined)
}

export function exitFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
}

export function isTouchDevice() {
  return window.matchMedia('(pointer: coarse)').matches
}
