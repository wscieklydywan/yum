'use client'

import { Disc3, Gift, Ticket, type LucideIcon } from 'lucide-react'
import { ClubGroup } from './club-member-sections'

type Action = { key: string; icon: LucideIcon; title: string; subtitle: string; badge?: string; onClick: () => void }

export function ClubQuickActions({
  freeSpinAvailable,
  onSpin,
  onRewards,
  onCoupons,
}: {
  freeSpinAvailable: boolean
  onSpin: () => void
  onRewards: () => void
  onCoupons: () => void
}) {
  const actions: Action[] = [
    { key: 'wheel', icon: Disc3, title: 'Koło fortuny', subtitle: 'Kręć i wygrywaj', badge: freeSpinAvailable ? 'Darmowe' : undefined, onClick: onSpin },
    { key: 'rewards', icon: Gift, title: 'Nagrody', subtitle: 'Wymień Stars', onClick: onRewards },
    { key: 'coupons', icon: Ticket, title: 'Kupony', subtitle: 'Twoje kody', onClick: onCoupons },
  ]

  return (
    <ClubGroup id="club-actions" title="Twoje możliwości">
      <ul className="grid grid-cols-3 divide-x divide-border/70">
        {actions.map(({ key, icon: Icon, title, subtitle, badge, onClick }) => (
          <li key={key} className="px-1">
            <button
              type="button"
              onClick={onClick}
              className="group flex w-full flex-col items-center gap-2 rounded-2xl py-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="relative grid size-14 place-items-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-105 group-active:scale-95">
                <Icon className="size-6" strokeWidth={2.1} aria-hidden="true" />
                {badge ? (
                  <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground shadow-sm">
                    {badge}
                  </span>
                ) : null}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-[13px] font-extrabold leading-tight sm:text-sm">{title}</span>
                <span className="text-[11px] leading-tight text-muted-foreground sm:text-xs">{subtitle}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </ClubGroup>
  )
}
