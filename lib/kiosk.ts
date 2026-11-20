/** Roles allowed to run the kiosk screen; managers can open it to test or set it up. */
export const KIOSK_ROLES = ['kiosk', 'admin', 'szef'] as const

/** Seconds of inactivity after which the kiosk asks "Czy potrzebujesz więcej czasu?". */
export const KIOSK_IDLE_SECONDS = 30

/** Seconds the "more time?" prompt waits before returning to the start screen. */
export const KIOSK_PROMPT_SECONDS = 15

/** Seconds the order confirmation stays on screen. */
export const KIOSK_DONE_SECONDS = 8
