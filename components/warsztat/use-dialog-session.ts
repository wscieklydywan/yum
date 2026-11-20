import { useState } from 'react'

/** Keeps showing the last non-null value while a dialog plays its close animation, so the content doesn't vanish or change mid-fade. */
export function useStickyValue<T>(value: T | null): T | null {
  const [last, setLast] = useState(value)
  if (value !== null && value !== last) setLast(value)
  return value ?? last
}

/**
 * Like useStickyValue, plus a `session` number that changes each time the dialog opens.
 * Use it as a `key` so form state starts fresh on open instead of being reset on close (which flashes during the fade-out).
 */
export function useDialogSession<T>(value: T | null) {
  const current = useStickyValue(value)
  const open = value !== null
  const [state, setState] = useState({ open, session: 0 })
  if (state.open !== open) setState({ open, session: open ? state.session + 1 : state.session })
  return { current, open, session: state.session }
}
