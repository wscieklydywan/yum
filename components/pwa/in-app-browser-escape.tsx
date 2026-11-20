'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, X } from 'lucide-react'

const IN_APP = /FBAN|FBAV|FB_IAB|FBIOS|FB4A|Instagram|Messenger|musical_ly|TikTok|Snapchat|Line\//i
const TRIED_KEY = 'yummy-escape-tried'

type Env = { os: 'android' | 'ios'; app: string } | null

function detect(): Env {
  const ua = navigator.userAgent
  if (!IN_APP.test(ua)) return null
  const app = /Instagram/i.test(ua) ? 'Instagramie' : /Messenger/i.test(ua) ? 'Messengerze' : /TikTok|musical_ly/i.test(ua) ? 'TikToku' : 'Facebooku'
  if (/android/i.test(ua)) return { os: 'android', app }
  if (/iphone|ipad|ipod/i.test(ua)) return { os: 'ios', app }
  return null
}

function androidIntent() {
  const { host, pathname, search, hash, href } = window.location
  return `intent://${host}${pathname}${search}${hash}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`
}

function iosSafari() {
  return `x-safari-${window.location.href}`
}

/**
 * Facebook/Instagram open links in their own WebView, where a PWA can't be installed.
 * Android can be sent to Chrome with an intent link automatically; iOS only allows a tap (Safari URL scheme, iOS 17+).
 */
export function InAppBrowserEscape() {
  const [env, setEnv] = useState<Env>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (window.location.pathname.startsWith('/warsztat')) return
    const found = detect()
    setEnv(found)
    if (found?.os === 'android' && !sessionStorage.getItem(TRIED_KEY)) {
      sessionStorage.setItem(TRIED_KEY, '1')
      window.location.href = androidIntent()
    }
  }, [])

  if (!env || hidden) return null

  const open = () => {
    window.location.href = env.os === 'android' ? androidIntent() : iosSafari()
  }

  return (
    <div role="dialog" aria-labelledby="iab-title" className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-md rounded-2xl bg-zinc-900 p-4 text-white shadow-2xl">
      <button type="button" onClick={() => setHidden(true)} className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white">
        <X className="size-4" aria-hidden="true" />
        <span className="sr-only">Zamknij</span>
      </button>
      <p id="iab-title" className="pr-8 text-sm font-extrabold">Otwórz w przeglądarce, aby zainstalować aplikację</p>
      <p className="mt-1 text-xs leading-relaxed text-white/70">
        {`Strona jest otwarta w ${env.app}. Tutaj nie da się zainstalować aplikacji Yummy ani zapisać logowania na stałe.`}
        {env.os === 'ios' ? ' Jeśli przycisk nie zadziała, dotknij ••• u góry i wybierz „Otwórz w przeglądarce”.' : ' Jeśli przycisk nie zadziała, dotknij ⋮ u góry i wybierz „Otwórz w przeglądarce”.'}
      </p>
      <button type="button" onClick={open} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
        <ExternalLink className="size-4" aria-hidden="true" />
        {env.os === 'ios' ? 'Otwórz w Safari' : 'Otwórz w Chrome'}
      </button>
    </div>
  )
}
