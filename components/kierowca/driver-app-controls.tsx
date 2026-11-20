'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Download, RotateCw } from 'lucide-react'
import { hasForeignInstallPrompt, isInstalledPwa, promptInstall, registerServiceWorker } from '@/lib/pwa'
import { useInstallPrompt } from '@/components/warsztat/workshop-pwa-controls'
import { cn } from '@/lib/utils'

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

const buttonClass = 'flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#706961] hover:bg-[#eae5de] hover:text-[#211e1b] disabled:opacity-60'

export function DriverInstallButton({ className, label = 'Zainstaluj' }: { className?: string; label?: string }) {
  const installPrompt = useInstallPrompt()
  const [platform, setPlatform] = useState<'installed' | 'ios' | 'other' | null>(null)
  const [foreignPrompt, setForeignPrompt] = useState(false)

  useEffect(() => {
    void registerServiceWorker()
    setPlatform(isInstalledPwa() ? 'installed' : isIos() ? 'ios' : 'other')
    setForeignPrompt(hasForeignInstallPrompt())
  }, [installPrompt])

  if (platform === 'installed' || platform === null) return null
  if (platform === 'other' && !installPrompt && !foreignPrompt) return null

  async function install() {
    if (platform === 'ios') {
      toast.info('Zainstaluj na iPhonie', { description: 'W Safari stuknij „Udostępnij”, potem „Do ekranu początkowego”.', duration: 10_000 })
      return
    }
    // The browser still holds the prompt of the app the user came from (e.g. Yummy Club) – reload for the driver one.
    if (!installPrompt) {
      window.location.assign('/kierowca/instaluj')
      return
    }
    const accepted = await promptInstall()
    if (accepted) toast.success('Aplikacja kierowcy zainstalowana', { description: 'Otwieraj ją z ikony „Kierowca” na ekranie telefonu.' })
  }

  return (
    <button type="button" onClick={() => void install()} className={className ?? buttonClass}>
      <Download className="size-4" aria-hidden="true" />
      <span className={className ? undefined : 'hidden sm:inline'}>{label}</span>
      <span className="sr-only sm:hidden">Zainstaluj aplikację</span>
    </button>
  )
}

/** Full page reload: the board comes back from the database, so nothing is lost and a stuck connection is reset. */
export function DriverRefreshButton() {
  const [reloading, setReloading] = useState(false)
  return (
    <button
      type="button"
      disabled={reloading}
      onClick={() => {
        setReloading(true)
        window.location.reload()
      }}
      className={buttonClass}
    >
      <RotateCw className={cn('size-4', reloading && 'animate-spin')} aria-hidden="true" />
      <span className="hidden sm:inline">Odśwież</span>
      <span className="sr-only sm:hidden">Odśwież</span>
    </button>
  )
}
