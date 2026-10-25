/** Roles allowed to run the kiosk screen; managers can open it to test or set it up. */
export const KIOSK_ROLES = ['kiosk', 'admin', 'szef'] as const

/** Seconds of inactivity after which the kiosk returns to the start screen. */
export const KIOSK_IDLE_SECONDS = 90
