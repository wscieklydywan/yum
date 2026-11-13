'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import Image from 'next/image'
import { Download, EllipsisVertical, MonitorDown, Share, SquarePlus, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getInstallPrompt, getServerInstallPrompt, promptInstall, registerServiceWorker, subscribeToInstallPrompt } from '@/lib/pwa'

export type Platform = 'server' | 'installed' | 'ios' | 'android' | 'desktop'

const DISMISS_KEY = 'yummy-club-install-dismissed'
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000

function detectPlatform(): Platform {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (standalone) return 'installed'
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android|Mobile/i.test(ua)) return 'android'
  return 'desktop'
}

const subscribeNoop = () => () => {}

const dismissListeners = new Set<() => void>()
function subscribeToDismiss(listener: () => void) {
  dismissListeners.add(listener)
  return () => {
    dismissListeners.delete(listener)
  }
}
function isDismissed() {
  try {
    return Date.now() - Number(localStorage.getItem(DISMISS_KEY) ?? 0) < DISMISS_FOR_MS
  } catch {
    return false
  }
}
function dismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {}
  dismissListeners.forEach((listener) => listener())
}

export function useClubInstall() {
  const platform = useSyncExternalStore<Platform>(subscribeNoop, detectPlatform, () => 'server')
  const installPrompt = useSyncExternalStore(subscribeToInstallPrompt, getInstallPrompt, getServerInstallPrompt)
  const [guideOpen, setGuideOpen] = useState(false)

  useEffect(() => {
    registerServiceWorker()
  }, [])

  async function install() {
    if (installPrompt) {
      const accepted = await promptInstall()
      if (accepted) dismiss()
      return
    }
    setGuideOpen(true)
  }

  const guide = <InstallGuide platform={platform} open={guideOpen} onOpenChange={setGuideOpen} />
  return { platform, installPrompt, install, guide }
}

/** `floating` pins the banner just above the member area's fixed bottom nav instead of rendering it inline. */
export function ClubInstallBanner({ floating = false }: { floating?: boolean }) {
  const { platform, installPrompt, install, guide } = useClubInstall()
  const dismissed = useSyncExternalStore(subscribeToDismiss, isDismissed, () => true)

  const canShow =
    !dismissed && platform !== 'server' && platform !== 'installed' && (platform !== 'desktop' || Boolean(installPrompt))
  if (!canShow) return null

  if (floating) {
    return (
      <>
        <div aria-hidden="true" className="h-12" />
        <aside
          aria-label="Zainstaluj aplikację Yummy Club"
          className="fixed inset-x-3 bottom-[calc(3.5rem+0.375rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-sm animate-in fade-in slide-in-from-bottom-2 items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-1 shadow-[0_6px_20px_-8px_rgba(40,22,8,0.3)] duration-300 motion-reduce:animate-none"
        >
          <Image src="/club-icon-192.png" alt="" width={28} height={28} className="size-7 shrink-0 rounded-full" />
          <p className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">Yummy Club na telefonie</p>
          <button
            type="button"
            onClick={install}
            className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Zainstaluj
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Ukryj baner instalacji"
            className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </aside>
        {guide}
      </>
    )
  }

  return (
    <>
      <aside
        aria-label="Zainstaluj aplikację Yummy Club"
        className="mb-4 mt-3 flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5 pr-2 shadow-sm lg:mt-6"
      >
        <Image src="/club-icon-192.png" alt="" width={44} height={44} className="size-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight text-foreground">Zainstaluj aplikację</p>
          <p className="mt-0.5 text-xs leading-tight text-muted-foreground">Yummy Club zawsze pod ręką</p>
        </div>
        <button
          type="button"
          onClick={install}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Download className="hidden size-3.5 sm:block" aria-hidden="true" />
          Zainstaluj
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Ukryj baner instalacji"
          className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </aside>
      {guide}
    </>
  )
}

/** Always-available install entry for the account settings, independent of the dismissible banner. */
export function ClubInstallSetting() {
  const { platform, install, guide } = useClubInstall()
  if (platform === 'server' || platform === 'installed') return null

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
        <h3 className="text-sm font-bold">Aplikacja</h3>
      </div>
      <div className="flex items-center gap-3 py-3">
        <Image src="/club-icon-192.png" alt="" width={44} height={44} className="size-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">Yummy Club na telefonie</p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            Szybki dostęp do Stars, nagród i zamówień z ekranu głównego.
          </p>
        </div>
        <button
          type="button"
          onClick={install}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Download className="size-3.5" aria-hidden="true" />
          Zainstaluj
        </button>
      </div>
      {guide}
    </div>
  )
}

function InstallGuide({ platform, open, onOpenChange }: { platform: Platform; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader className="items-center text-center">
          <Image src="/club-icon-192.png" alt="" width={64} height={64} className="mb-2 size-16 rounded-2xl" />
          <DialogTitle>Zainstaluj Yummy Club</DialogTitle>
          <DialogDescription>Dodaj aplikację do ekranu w dwóch krokach.</DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col gap-3">
          {platform === 'ios' ? (
            <>
              <GuideStep number={1} icon={<Share className="size-4" aria-hidden="true" />}>
                Stuknij <strong>Udostępnij</strong> na pasku przeglądarki
              </GuideStep>
              <GuideStep number={2} icon={<SquarePlus className="size-4" aria-hidden="true" />}>
                Wybierz <strong>Do ekranu początkowego</strong> i potwierdź <strong>Dodaj</strong>
              </GuideStep>
            </>
          ) : platform === 'desktop' ? (
            <>
              <GuideStep number={1} icon={<MonitorDown className="size-4" aria-hidden="true" />}>
                Kliknij ikonę <strong>instalacji</strong> w pasku adresu (Chrome, Edge)
              </GuideStep>
              <GuideStep number={2} icon={<SquarePlus className="size-4" aria-hidden="true" />}>
                Potwierdź <strong>Zainstaluj</strong>
              </GuideStep>
            </>
          ) : (
            <>
              <GuideStep number={1} icon={<EllipsisVertical className="size-4" aria-hidden="true" />}>
                Otwórz <strong>menu przeglądarki</strong> (trzy kropki)
              </GuideStep>
              <GuideStep number={2} icon={<SquarePlus className="size-4" aria-hidden="true" />}>
                Wybierz <strong>Zainstaluj</strong> lub <strong>Dodaj do ekranu głównego</strong>
              </GuideStep>
            </>
          )}
        </ol>
      </DialogContent>
    </Dialog>
  )
}

export function GuideStep({ number, icon, children }: { number: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-muted p-3 text-sm text-foreground">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {number}
      </span>
      <span className="flex-1 text-pretty">{children}</span>
      <span className="text-muted-foreground">{icon}</span>
    </li>
  )
}
