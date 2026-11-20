'use client'

import { useEffect, useEffectEvent } from 'react'

const HISTORY_KEY = 'modal'

type Entry = { close: () => void; poppedByBack: boolean; disposed: boolean }

const stack: Entry[] = []
let pendingBacks = 0
let backTimer: ReturnType<typeof setTimeout> | null = null
let ignoredPops = 0
let listening = false

function onPopState() {
  if (ignoredPops > 0) {
    ignoredPops--
    return
  }
  const entry = stack.pop()
  if (!entry) return
  entry.poppedByBack = true
  entry.close()
  // The modal may refuse to close (e.g. a game in progress). Put its history entry back so the next back press
  // still lands on the modal instead of leaving the page.
  setTimeout(() => {
    if (entry.disposed) return
    entry.poppedByBack = false
    claimHistoryEntry()
    stack.push(entry)
  }, 0)
}

function claimHistoryEntry() {
  // A modal that closed in the same tick (e.g. confirm -> voucher) hands its entry over instead of
  // racing an async history.back() against a new pushState.
  if (pendingBacks > 0) {
    pendingBacks--
    if (pendingBacks === 0 && backTimer) {
      clearTimeout(backTimer)
      backTimer = null
    }
    return
  }
  window.history.pushState({ ...window.history.state, [HISTORY_KEY]: true }, '')
}

function releaseHistoryEntry() {
  pendingBacks++
  backTimer ??= setTimeout(() => {
    backTimer = null
    const count = pendingBacks
    pendingBacks = 0
    if (count > 0 && window.history.state?.[HISTORY_KEY]) {
      ignoredPops++
      window.history.go(-count)
    }
  }, 0)
}

/**
 * Opening the modal adds one history entry, so the phone back button / back gesture closes the modal instead of
 * leaving the page. Closing it from the UI removes that entry again, so history stays as it was before opening.
 * Works for any number of stacked modals: back always closes the top one.
 */
export function useBackButtonClose(open: boolean, onOpenChange: (open: boolean) => void) {
  const close = useEffectEvent(() => onOpenChange(false))

  useEffect(() => {
    if (!open) return
    if (!listening) {
      window.addEventListener('popstate', onPopState)
      listening = true
    }
    const entry: Entry = { close, poppedByBack: false, disposed: false }
    claimHistoryEntry()
    stack.push(entry)

    return () => {
      entry.disposed = true
      const index = stack.indexOf(entry)
      if (index !== -1) stack.splice(index, 1)
      if (!entry.poppedByBack) releaseHistoryEntry()
    }
  }, [open])
}
