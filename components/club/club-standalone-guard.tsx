'use client'

import { useEffect } from 'react'

const CLUB_SCOPE = '/yummy-club'

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * In the installed Yummy Club app, keeps every same-origin navigation inside /yummy-club.
 * Links to the main site (logo, "Zamów teraz" → /#menu) stay in the club; other out-of-scope pages
 * (regulaminy, warsztat) open in a separate browser window so the app itself never leaves the club.
 */
export function ClubStandaloneGuard() {
  useEffect(() => {
    if (!isStandalone()) return

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.hasAttribute('download')) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === CLUB_SCOPE || url.pathname.startsWith(`${CLUB_SCOPE}/`)) return

      event.preventDefault()

      if (url.pathname === '/') {
        const orderMenu = document.getElementById('club-order-title')
        if (url.hash === '#menu' && orderMenu) {
          orderMenu.scrollIntoView({ behavior: 'smooth', block: 'start' })
          return
        }
        if (window.location.pathname !== CLUB_SCOPE) window.location.assign(CLUB_SCOPE)
        else document.getElementById('club-scroll')?.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      window.open(url.href, '_blank', 'noopener')
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  return null
}
