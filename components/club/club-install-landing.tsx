'use client'

import { useSyncExternalStore } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Check, Compass, Download, ExternalLink, Gift, Share, SquarePlus, Star, Zap } from 'lucide-react'
import { GuideStep, useClubInstall } from './club-install-banner'

type Browser = 'server' | 'in-app' | 'ios-other' | 'normal'

const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|TikTok|Snapchat|wv\)/i

function detectBrowser(): Browser {
  const ua = navigator.userAgent
  if (IN_APP.test(ua)) return 'in-app'
  if (/iPad|iPhone|iPod/.test(ua) && /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return 'ios-other'
  return 'normal'
}

const subscribeNoop = () => () => {}

const perks = [
  { icon: Star, text: 'Stars za każde zamówienie' },
  { icon: Gift, text: 'Nagrody i kupony tylko dla klubowiczów' },
  { icon: Zap, text: 'Szybkie zamówienia prosto z ekranu' },
]

export function ClubInstallLanding() {
  const { platform, installPrompt, install, guide } = useClubInstall()
  const browser = useSyncExternalStore<Browser>(subscribeNoop, detectBrowser, () => 'server')

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center bg-background px-5 pb-10 pt-12 text-center">
      <Image src="/club-icon-512.png" alt="" width={112} height={112} priority className="size-28 rounded-[1.75rem] shadow-[0_12px_32px_-12px_rgba(40,22,8,0.45)]" />
      <h1 className="mt-6 text-balance text-3xl font-black leading-tight tracking-tight text-foreground">Yummy Club na Twoim telefonie</h1>
      <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
        Darmowa aplikacja Yummy Rybnik. Bez sklepu, bez rejestracji karty – instalacja zajmuje kilka sekund.
      </p>

      <ul className="mt-6 flex w-full flex-col gap-2 text-left">
        {perks.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm font-semibold text-foreground">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            {text}
          </li>
        ))}
      </ul>

      <section aria-label="Instalacja" className="mt-8 flex w-full flex-col gap-3">
        <InstallAction platform={platform} browser={browser} hasPrompt={Boolean(installPrompt)} onInstall={install} />
      </section>

      <Link href="/yummy-club" className="mt-6 text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        Kontynuuj w przeglądarce
      </Link>
      {guide}
    </main>
  )
}

const primaryButton =
  'inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

function InstallAction({
  platform,
  browser,
  hasPrompt,
  onInstall,
}: {
  platform: ReturnType<typeof useClubInstall>['platform']
  browser: Browser
  hasPrompt: boolean
  onInstall: () => void
}) {
  if (platform === 'server' || browser === 'server') return <div className="h-14 w-full animate-pulse rounded-full bg-muted" />

  if (platform === 'installed') {
    return (
      <>
        <p className="flex items-center justify-center gap-2 text-sm font-semibold text-foreground">
          <Check className="size-4 text-primary" aria-hidden="true" />
          Aplikacja jest już zainstalowana
        </p>
        <Link href="/yummy-club" className={primaryButton}>Otwórz Yummy Club</Link>
      </>
    )
  }

  if (browser === 'in-app') {
    const target = `${window.location.host}${window.location.pathname}`
    return (
      <>
        <p className="text-pretty text-sm text-muted-foreground">
          Ta przeglądarka (np. Instagram, Facebook) nie pozwala instalować aplikacji. Otwórz stronę w{' '}
          {platform === 'ios' ? 'Safari' : 'Chrome'}.
        </p>
        {platform === 'android' ? (
          <a href={`intent://${target}#Intent;scheme=https;package=com.android.chrome;end`} className={primaryButton}>
            <ExternalLink className="size-5" aria-hidden="true" />
            Otwórz w Chrome
          </a>
        ) : (
          <ol className="flex flex-col gap-2 text-left">
            <GuideStep number={1} icon={<Compass className="size-4" aria-hidden="true" />}>
              Stuknij <strong>⋯</strong> i wybierz <strong>Otwórz w Safari</strong>
            </GuideStep>
          </ol>
        )}
      </>
    )
  }

  if (platform === 'ios') {
    return (
      <ol className="flex flex-col gap-2 text-left">
        {browser === 'ios-other' && (
          <li className="pb-1 text-center text-xs text-muted-foreground">Najpewniej zadziała w <strong>Safari</strong>.</li>
        )}
        <GuideStep number={1} icon={<Share className="size-4" aria-hidden="true" />}>
          Stuknij <strong>Udostępnij</strong> na pasku przeglądarki
        </GuideStep>
        <GuideStep number={2} icon={<SquarePlus className="size-4" aria-hidden="true" />}>
          Wybierz <strong>Do ekranu początkowego</strong>
        </GuideStep>
        <GuideStep number={3} icon={<Check className="size-4" aria-hidden="true" />}>
          Potwierdź <strong>Dodaj</strong> – gotowe!
        </GuideStep>
      </ol>
    )
  }

  return (
    <>
      <button type="button" onClick={onInstall} className={primaryButton}>
        <Download className="size-5" aria-hidden="true" />
        Zainstaluj aplikację
      </button>
      {!hasPrompt && <p className="text-xs text-muted-foreground">Jeśli okno instalacji się nie pojawi, pokażemy Ci, jak dodać aplikację ręcznie.</p>}
    </>
  )
}
