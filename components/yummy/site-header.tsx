'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Camera,
  Crown,
  Gift,
  MapPin,
  Menu,
  Music2,
  ShoppingBag,
  X,
} from 'lucide-react'
import { Logo } from './logo'
import { useCart } from '@/components/cart/cart-context'
import { cn } from '@/lib/utils'

const links = [
  { href: '#menu', label: 'Menu' },
  { href: '#promocje', label: 'Promocje' },
  { href: '/yummy-club', label: 'Yummy Club' },
  { href: '#zamawianie', label: 'Jak zamawiać' },
]

const menuLinks = [
  { href: '#menu', label: 'Menu', description: 'Burgery, zestawy, frytki i więcej' },
  { href: '#promocje', label: 'Promocje', description: 'Aktualne oferty i rabaty', marker: true },
  { href: '/yummy-club', label: 'Yummy Club', description: 'Zbieraj punkty, odbieraj nagrody', badge: 'Nowość' },
  { href: '#club', label: 'Losowanie nagród', description: 'Każdy dzień to nowa szansa', marker: true },
  { href: '#top', label: 'O nas', description: 'Ludzie, jakość, dobra energia' },
  { href: '#zamawianie', label: 'Kontakt', description: 'Napisz do nas' },
]

export function SiteHeader() {
  const { count, setOpen } = useCart()
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const firstLinkRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (!mobileOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    firstLinkRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileOpen(false)
        return
      }

      if (event.key !== 'Tab') return
      const focusable = document.querySelectorAll<HTMLElement>(
        '#mobile-menu-panel a[href], #mobile-menu-panel button:not([disabled])',
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      menuButtonRef.current?.focus()
    }
  }, [mobileOpen])

  function closeMenu() {
    setMobileOpen(false)
  }

  return (
    <header className={cn('sticky top-0 z-40 border-b border-border/60 bg-background/85', !mobileOpen && 'backdrop-blur-md')}>
      <div className="relative mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:h-16 sm:justify-start sm:gap-4 sm:px-6 lg:px-8">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu-panel"
          className="grid size-9 shrink-0 place-items-center rounded-full ring-1 ring-border transition-colors hover:bg-muted md:hidden"
        >
          {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          <span className="sr-only">{mobileOpen ? 'Zamknij menu' : 'Otwórz menu'}</span>
        </button>

        <a href="#top" aria-label="Yummy – strona główna" className="absolute left-1/2 -translate-x-1/2 shrink-0 sm:static sm:translate-x-0">
          <Logo priority className="h-9 sm:h-11" />
        </a>

        <nav aria-label="Główna nawigacja" className="ml-6 hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <span className="inline-flex h-8 items-center gap-1 rounded-full bg-card px-2 text-[11px] font-medium shadow-sm ring-1 ring-border sm:h-auto sm:gap-1.5 sm:px-3 sm:py-2 sm:text-sm">
            <MapPin className="size-3.5 text-primary sm:size-4" aria-hidden="true" />
            Rybnik
          </span>

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`Koszyk, ${count} produktów`}
            className="relative grid size-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:flex sm:h-10 sm:w-auto sm:items-center sm:gap-2 sm:px-4 sm:text-sm sm:font-semibold"
          >
            <ShoppingBag className="size-3.5 sm:size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Koszyk</span>
            <span
              className={cn(
                'absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary-foreground px-1 text-[10px] font-bold leading-4 text-primary sm:static sm:min-w-5 sm:px-1.5 sm:text-xs',
                count === 0 && 'opacity-70',
              )}
            >
              {count}
              <span className="sr-only"> produktów w koszyku</span>
            </span>
          </button>
        </div>
      </div>

      <div
        id="mobile-menu-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Nawigacja Yummy"
        aria-hidden={!mobileOpen}
        inert={!mobileOpen}
        className={cn(
          'fixed inset-0 z-50 isolate flex min-h-[100dvh] flex-col overflow-y-auto bg-[#090908] px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] text-white transition-[transform,visibility] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] md:hidden sm:px-8',
          mobileOpen ? 'visible translate-y-0' : 'invisible -translate-y-full',
          'motion-reduce:transition-none',
        )}
      >
        <Image
          src="/images/menu-background.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="pointer-events-none absolute inset-0 z-0 object-cover object-center opacity-35"
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-black/45 via-black/75 to-black/65" />

        <div className="relative z-10 mx-auto flex w-full max-w-xl items-center justify-between">
          <a href="#top" aria-label="Yummy – strona główna" onClick={closeMenu}>
            <Logo priority className="h-11 w-auto sm:h-16 [@media(max-height:600px)]:h-10" />
          </a>
          <button
            type="button"
            onClick={closeMenu}
            aria-label="Zamknij menu"
            className="grid size-10 place-items-center rounded-full text-white transition-transform duration-200 hover:rotate-90 hover:bg-white/10 sm:size-12"
          >
            <X className="size-7" aria-hidden="true" />
          </button>
          <span className="pointer-events-none absolute right-11 top-12 max-w-24 text-right font-script text-sm italic leading-tight text-white/65 sm:right-14 sm:top-14 sm:text-base">
            Good Burgers<br />Better Days
            <span className="mt-1 ml-auto block h-0.5 w-10 rotate-[-12deg] rounded-full bg-primary" />
          </span>
        </div>

        <nav aria-label="Nawigacja mobilna" className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-3 sm:py-5 [@media(max-height:600px)]:py-0">
          <ol className="flex flex-col">
            {menuLinks.map((link, index) => (
              <li key={link.label}>
                <a
                  ref={index === 0 ? firstLinkRef : undefined}
                  href={link.href}
                  onClick={closeMenu}
                  style={{ transitionDelay: mobileOpen ? `${80 + index * 45}ms` : '0ms' }}
                  className={cn(
                    'group grid min-h-[52px] grid-cols-[1.5rem_minmax(0,1fr)_1.25rem] items-center gap-x-2 py-1.5 transition-[opacity,transform,color] duration-300 ease-out sm:min-h-[72px] sm:grid-cols-[2.5rem_minmax(0,1fr)_2rem] sm:gap-x-4 [@media(max-height:600px)]:min-h-[44px] [@media(max-height:600px)]:py-1',
                    mobileOpen ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
                  )}
                >
                  <span className="row-span-2 self-start pt-1 text-xs font-medium tabular-nums text-white/65 sm:text-base">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[18px] font-extrabold leading-tight tracking-tight transition-colors group-hover:text-primary sm:text-2xl [@media(max-height:600px)]:text-base">
                      {link.label}
                    </span>
                    {link.marker && <span className="size-2.5 shrink-0 rounded-full bg-primary" aria-label="Nowość" />}
                    {link.badge && <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-white sm:text-[10px]">{link.badge}</span>}
                  </span>
                  <span className="col-start-2 row-start-2 mt-0.5 text-xs leading-snug text-white/65 sm:text-base [@media(max-height:600px)]:text-[11px]">{link.description}</span>
                  <ArrowRight className="col-start-3 row-span-2 size-4 text-white transition-transform duration-200 group-hover:translate-x-1 sm:size-6" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="relative z-10 mx-auto w-full max-w-xl border-t border-white/35 pt-3 sm:pt-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <a
              href="/yummy-club"
              onClick={closeMenu}
              style={{ transitionDelay: mobileOpen ? '380ms' : '0ms' }}
              className={cn(
                'group relative flex min-h-[94px] flex-col overflow-hidden rounded-xl border border-primary/80 bg-black/35 p-2.5 transition-[opacity,transform,border-color] duration-300 hover:border-primary sm:min-h-[140px] sm:rounded-2xl sm:p-4 [@media(max-height:600px)]:min-h-[82px] [@media(max-height:600px)]:p-2',
                mobileOpen ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
              )}
            >
              <Crown className="relative z-10 size-5 text-primary sm:size-6" aria-hidden="true" />
              <Crown className="pointer-events-none absolute -right-2 top-2 size-20 rotate-12 text-primary/10" aria-hidden="true" />
              <div className="relative z-10 mt-auto flex items-end justify-between gap-1.5 pt-2">
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-extrabold leading-tight sm:text-base">Yummy Club</span>
                  <span className="mt-1 block line-clamp-2 text-[10px] leading-snug text-white/65 sm:text-sm">Ekskluzywne rabaty i nagrody</span>
                </span>
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-white transition-transform group-hover:translate-x-0.5 sm:size-9">
                  <ArrowRight className="size-3.5 sm:size-4" aria-hidden="true" />
                </span>
              </div>
            </a>
            <a
              href="#club"
              onClick={closeMenu}
              style={{ transitionDelay: mobileOpen ? '430ms' : '0ms' }}
              className={cn(
                'group relative flex min-h-[94px] flex-col overflow-hidden rounded-xl border border-white/20 bg-black/35 p-2.5 transition-[opacity,transform,border-color] duration-300 hover:border-primary/70 sm:min-h-[140px] sm:rounded-2xl sm:p-4 [@media(max-height:600px)]:min-h-[82px] [@media(max-height:600px)]:p-2',
                mobileOpen ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
              )}
            >
              <Gift className="relative z-10 size-5 text-primary sm:size-6" aria-hidden="true" />
              <Gift className="pointer-events-none absolute -right-2 top-2 size-20 -rotate-12 text-primary/10" aria-hidden="true" />
              <div className="relative z-10 mt-auto flex items-end justify-between gap-1.5 pt-2">
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-extrabold leading-tight sm:text-base">Losowanie nagród</span>
                  <span className="mt-1 block line-clamp-2 text-[10px] leading-snug text-white/65 sm:text-sm">Sprawdź, co dziś możesz wygrać</span>
                </span>
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-white transition-transform group-hover:translate-x-0.5 sm:size-9">
                  <ArrowRight className="size-3.5 sm:size-4" aria-hidden="true" />
                </span>
              </div>
            </a>
          </div>

          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center border-t border-white/25 pt-2.5 sm:mt-5 sm:pt-4 [@media(max-height:600px)]:mt-2 [@media(max-height:600px)]:pt-2">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/90 sm:gap-2 sm:px-3 sm:py-1.5 sm:text-base">
              <MapPin className="size-3.5 text-primary sm:size-4" aria-hidden="true" />
              Rybnik
            </span>
            <div role="img" aria-label="Media społecznościowe" className="grid grid-cols-3 items-center text-white/90">
              <span className="grid size-8 place-items-center sm:size-9"><Camera className="size-4 sm:size-5" aria-hidden="true" /></span>
              <span className="grid size-8 place-items-center text-sm font-bold leading-none sm:size-9 sm:text-base" aria-hidden="true">f</span>
              <span className="grid size-8 place-items-center sm:size-9"><Music2 className="size-4 sm:size-5" aria-hidden="true" /></span>
            </div>
            <span aria-hidden="true" />
          </div>
        </div>
      </div>
    </header>
  )
}
