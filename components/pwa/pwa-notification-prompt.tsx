'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Bell, X } from 'lucide-react'
import { toast } from 'sonner'
import { isInstalledPwa, isPushSupported, subscribeCustomerPush, type CustomerPushApp } from '@/lib/pwa'

const DISMISS_KEY = 'yummy-pwa-notifications-dismissed'
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000
const CLUB_SCOPE = '/yummy-club'

function recentlyDismissed() {
  try {
    return Date.now() - Number(localStorage.getItem(DISMISS_KEY) ?? 0) < DISMISS_FOR_MS
  } catch {
    return false
  }
}

function rememberDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {}
}

/**
 * Asks for notification permission only inside the installed Yummy Club app (never in a browser tab,
 * the main site or the staff panel). Browsers require a user gesture, so we show a soft prompt first.
 */
export function PwaNotificationPrompt() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const isClubApp = pathname === CLUB_SCOPE || Boolean(pathname?.startsWith(`${CLUB_SCOPE}/`))
  const app: CustomerPushApp = 'club'

  useEffect(() => {
    if (!isClubApp || !isInstalledPwa() || !isPushSupported()) return
    if (Notification.permission === 'granted') {
      void subscribeCustomerPush(app)
      return
    }
    if (Notification.permission !== 'default' || recentlyDismissed()) return
    const timer = window.setTimeout(() => setOpen(true), 1500)
    return () => window.clearTimeout(timer)
  }, [isClubApp, app])

  if (!open || !isClubApp) return null

  function close() {
    rememberDismiss()
    setOpen(false)
  }

  async function enable() {
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        close()
        return
      }
      const ok = await subscribeCustomerPush(app)
      setOpen(false)
      if (ok) toast.success('Powiadomienia włączone', { description: 'Damy znać o nagrodach i promocjach w Yummy Club.' })
      else toast.error('Nie udało się włączyć powiadomień', { description: 'Spróbuj ponownie później.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-labelledby="pwa-notify-title"
      aria-describedby="pwa-notify-text"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[60] mx-auto max-w-md rounded-3xl bg-[#191513] p-4 text-white shadow-2xl ring-1 ring-white/10 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <Bell className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p id="pwa-notify-title" className="text-base font-extrabold leading-tight">Włączyć powiadomienia?</p>
          <p id="pwa-notify-text" className="mt-1 text-sm leading-relaxed text-white/70">
            Damy znać o nowych nagrodach, kuponach, bonusowych Stars i promocjach Yummy Club. Możesz to wyłączyć w każdej chwili.
          </p>
        </div>
        <button type="button" onClick={close} aria-label="Zamknij" className="-m-1 rounded-full p-1 text-white/60 hover:text-white">
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={close} className="h-11 flex-1 rounded-2xl bg-white/10 text-sm font-bold hover:bg-white/15">
          Nie teraz
        </button>
        <button
          type="button"
          onClick={() => void enable()}
          disabled={busy}
          className="h-11 flex-1 rounded-2xl bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? 'Włączanie…' : 'Włącz'}
        </button>
      </div>
    </div>
  )
}
