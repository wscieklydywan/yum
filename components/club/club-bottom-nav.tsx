'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { ArrowUpRight, ChevronRight, Gamepad2, House, Star, Ticket, UserRound, UtensilsCrossed } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ClubTab = 'home' | 'menu' | 'coupons' | 'game' | 'profile'

const items: { id: ClubTab; label: string; icon: typeof UtensilsCrossed }[] = [
  { id: 'home', label: 'Start', icon: House },
  { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
  { id: 'coupons', label: 'Kupony', icon: Ticket },
  { id: 'game', label: 'Gry', icon: Gamepad2 },
  { id: 'profile', label: 'Profil', icon: UserRound },
]

const desktopLabels: Record<ClubTab, string> = {
  home: 'Twój klub',
  menu: 'Zamów jedzenie',
  coupons: 'Nagrody i kupony',
  game: 'Gry i wydarzenia',
  profile: 'Mój profil',
}

export function ClubDesktopNav({ activeTab, onNavigate, displayName, points }: {
  activeTab: ClubTab
  onNavigate: (tab: ClubTab) => void
  displayName: string
  points: number
}) {
  return (
    <aside className="sticky top-6 hidden min-w-0 self-start rounded-3xl border border-border/70 bg-card p-3 lg:flex lg:flex-col lg:gap-6">
      <nav aria-label="Nawigacja Yummy Club">
        <p className="mb-4 px-3 pt-3 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Twoja strefa smaku</p>
        <ul className="flex flex-col gap-1.5">
          {items.map(({ id, icon: Icon }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onNavigate(id)}
                aria-current={activeTab === id ? 'page' : undefined}
                className={cn('flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', activeTab === id ? 'bg-primary/8 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
              >
                <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                {desktopLabels[id]}
                {activeTab === id && <ChevronRight className="ml-auto size-3.5 shrink-0" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex flex-col gap-4 border-t border-border/70 pt-6">
        <button type="button" onClick={() => onNavigate('profile')} className="flex min-w-0 items-center gap-3 rounded-2xl bg-background p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-sm font-bold ring-1 ring-border">{displayName.charAt(0).toLocaleUpperCase('pl-PL')}</span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-sm font-bold">{displayName}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><Star className="size-3 text-primary" aria-hidden="true" />{points.toLocaleString('pl-PL')} Stars</span>
          </span>
        </button>
        <Link href="/#top" className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-muted-foreground hover:text-primary">Strona restauracji<ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>
      </div>
    </aside>
  )
}

// Portaled to <body>: inside #club-scroll (`isolate`) a fixed bar could be covered by tab content
// or dropped during tab swaps / dialog scroll-lock on mobile browsers.
// Bottom padding uses the full safe-area inset: with viewport-fit=cover Chrome on Android draws under
// the gesture bar, so anything less lets the system handle overlap the labels.
export function ClubBottomNav({ activeTab, onNavigate }: { activeTab: ClubTab; onNavigate: (tab: ClubTab) => void }) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  useEffect(() => setPortalTarget(document.body), [])
  if (!portalTarget) return null

  const activeIndex = Math.max(0, items.findIndex((item) => item.id === activeTab))

  // Solid background + own compositor layer (no backdrop-filter): blur over the scrolling #club-scroll made
  // some mobile browsers skip painting the bar and dropped the pill animation well below 30fps.
  return createPortal(
    <nav
      aria-label="Nawigacja Yummy Club"
      className="club-bottom-nav fixed inset-x-0 bottom-0 z-[45] transform-gpu rounded-t-[1.5rem] border-t border-border/70 bg-card px-2 pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-0.5 shadow-[0_-8px_24px_-14px_rgba(38,24,12,0.25)] lg:hidden"
    >
      <ul className="relative mx-auto grid w-full max-w-md grid-cols-5">
        <li
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-1.5 flex h-7 w-1/5 justify-center will-change-transform motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{ transform: `translate3d(${activeIndex * 100}%,0,0)` }}
        >
          <span className="h-full w-14 rounded-full bg-primary/[0.08] shadow-none" />
        </li>
        {items.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id
          return (
            <li key={id} className="flex">
              <button
                type="button"
                onClick={() => onNavigate(id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group flex h-12 w-full flex-col items-center justify-center gap-0.5 rounded-2xl text-[10.5px] tracking-wide transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                  active ? 'font-bold text-primary' : 'font-semibold text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="relative grid h-7 w-14 place-items-center motion-safe:transition-transform motion-safe:group-active:scale-90">
                  <Icon className={cn('relative size-[18px] transition-colors duration-200', active && 'text-primary')} strokeWidth={active ? 2.3 : 1.9} aria-hidden="true" />
                </span>
                <span className="leading-none">{label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>,
    portalTarget,
  )
}
