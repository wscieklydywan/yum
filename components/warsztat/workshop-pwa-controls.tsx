'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { BellRing } from 'lucide-react'
import { SettingsCard, SettingsSwitch } from './workshop-settings-layout'
import {
  getInstallPrompt,
  getServerInstallPrompt,
  isPushDisabled,
  registerServiceWorker,
  subscribeToInstallPrompt,
  subscribeToPush,
  subscribeToPushPreference,
  unsubscribeFromPush,
  type PushStation,
} from '@/lib/pwa'

type Permission = NotificationPermission | 'unsupported'

const stationLabel: Record<PushStation, string> = { kitchen: 'kuchni', cashier: 'baru' }

/** Captures (and silences) the browser's automatic install banner. Render on every /warsztat screen. */
export function useInstallPrompt() {
  return useSyncExternalStore(subscribeToInstallPrompt, getInstallPrompt, getServerInstallPrompt)
}

export function WorkshopInstallGuard() {
  useInstallPrompt()
  return null
}

function usePushToggle(station: PushStation) {
  const [permission, setPermission] = useState<Permission>('default')
  const [busy, setBusy] = useState(false)
  const disabled = useSyncExternalStore(subscribeToPushPreference, isPushDisabled, () => false)

  useEffect(() => {
    void registerServiceWorker()
    const supported = 'Notification' in window && 'PushManager' in window
    setPermission(supported ? Notification.permission : 'unsupported')
  }, [])

  // Only refreshes an existing grant (no prompt) and never revives a device that was switched off.
  useEffect(() => {
    if (permission === 'granted' && !disabled) void subscribeToPush(station)
  }, [permission, station, disabled])

  const enabled = permission === 'granted' && !disabled

  async function enable() {
    if (permission === 'unsupported') return
    if (permission === 'denied') {
      toast.error('Powiadomienia są zablokowane', { description: 'Odblokuj je w ustawieniach strony (ikona kłódki obok adresu).' })
      return
    }
    const result = permission === 'granted' ? permission : await Notification.requestPermission()
    setPermission(result)
    if (result !== 'granted') return
    const ok = await subscribeToPush(station)
    if (ok) toast.success(`Powiadomienia ${stationLabel[station]} włączone`, { description: 'Przyjdą tylko, gdy panel nie jest na ekranie (zminimalizowany, ekran zablokowany, inna aplikacja).' })
    else toast.error('Nie udało się włączyć powiadomień', { description: 'Sprawdź połączenie i spróbuj ponownie.' })
  }

  async function disable() {
    const ok = await unsubscribeFromPush()
    if (ok) toast.success('Powiadomienia wyłączone na tym urządzeniu', { description: 'Dźwięk i komunikaty w panelu działają dalej.' })
    else toast.error('Powiadomienia wyłączone tylko lokalnie', { description: 'Nie udało się usunąć subskrypcji z serwera — spróbuj ponownie przy połączeniu.' })
  }

  async function toggle() {
    if (busy) return
    setBusy(true)
    try {
      await (enabled ? disable() : enable())
    } finally {
      setBusy(false)
    }
  }

  return { permission, enabled, busy, toggle }
}

export function WorkshopNotificationSettings({ station }: { station: PushStation }) {
  const { permission, enabled, busy, toggle } = usePushToggle(station)
  const unsupported = permission === 'unsupported'
  const description = unsupported
    ? 'Ta przeglądarka nie obsługuje powiadomień push.'
    : permission === 'denied'
      ? 'Powiadomienia są zablokowane w przeglądarce. Odblokuj je w ustawieniach strony, aby móc je włączyć.'
      : 'Zapasowy alert, gdy panel nie jest na ekranie (zminimalizowany, ekran zablokowany). Przy otwartym panelu wystarczy dźwięk w aplikacji.'

  return (
    <SettingsCard
      icon={BellRing}
      title="Powiadomienia push"
      titleId="push-settings-title"
      description={description}
      action={<SettingsSwitch checked={enabled} onChange={() => void toggle()} disabled={busy || unsupported} labelledBy="push-settings-title" />}
    />
  )
}
