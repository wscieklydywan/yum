'use client'

import { useState, type ReactNode } from 'react'
import { ArrowLeft, ChevronRight, Menu } from 'lucide-react'
import { MARKETING_VIEW_KEY, marketingItems as allItems, marketingSections as sections } from './marketing-nav'
import { WorkshopClubTiers } from '../workshop-club-tiers'
import { LoyaltyRateCard } from '../workshop-club-tools'
import { WorkshopCustomers } from '../workshop-customers'
import { WorkshopPointsRecovery } from '../workshop-points-recovery'
import { WorkshopRewardsEconomics } from './workshop-rewards-economics'
import { WorkshopPointsPayment } from './workshop-points-payment'
import type { UserRole } from '../workshop-access'
import { WorkshopAdvent } from './workshop-advent'
import { WorkshopHomeSlides } from './workshop-home-slides'
import { WorkshopHalloweenEconomics } from './workshop-halloween-economics'
import { cn } from '@/lib/utils'
import { useHistoryView } from '@/lib/use-history-view'
import { MarketingOverview } from './marketing-overview'
import { MarketingDashboard } from './marketing-dashboard'
import { MarketingStatsView } from './marketing-stats'
import { WorkshopWheelPrizes } from '../workshop-wheel-prizes'
import { WorkshopPromoCodes } from './workshop-promo-codes'
import { WorkshopPromotions } from './workshop-promotions'
import { WheelSettings } from './wheel-settings'
import { WorkshopInstallQr } from './workshop-install-qr'
import { WorkshopAbout } from './workshop-about'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

function SectionNav({ activeId, onSelect, compact }: { activeId: string; onSelect: (id: string) => void; compact?: boolean }) {
  return (
    <nav aria-label="Działy marketingu" className="flex flex-col gap-4">
      {sections.map((section) => (
        <div key={section.id} className="flex flex-col gap-0.5">
          <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">{section.label}</p>
          {section.items.map(({ id, label, hint, icon: Icon }) => {
            const selected = id === activeId
            return (
              <button
                key={id}
                type="button"
                aria-current={selected ? 'page' : undefined}
                onClick={() => onSelect(id)}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                  selected ? 'bg-primary/10 font-bold text-primary' : 'font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900',
                )}
              >
                <Icon className={cn('size-4 shrink-0', selected ? 'text-primary' : 'text-zinc-400 group-hover:text-zinc-600')} aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{label}</span>
                  {!compact && <span className="truncate text-[11px] font-normal text-zinc-500">{hint}</span>}
                </span>
                {!compact && <ChevronRight className="size-4 shrink-0 text-zinc-300" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

export function WorkshopMarketing({ userRole }: { userRole: UserRole }) {
  const [activeId, setActiveId] = useHistoryView<string>(MARKETING_VIEW_KEY, 'overview')
  const [sheetOpen, setSheetOpen] = useState(false)
  const active = allItems.find((item) => item.id === activeId) ?? allItems[0]
  const isDashboard = active.id === 'overview'

  const open = (id: string) => {
    setActiveId(id)
    setSheetOpen(false)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      document.querySelector('.workshop-dashboard main')?.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] gap-6 px-0 py-1 sm:p-5">
            <section aria-labelledby="marketing-panel-title" className="flex min-w-0 flex-1 flex-col gap-4 lg:gap-5">
        <header className="flex items-start gap-3">
          {!isDashboard && (
            <button type="button" onClick={() => open('overview')} className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 xl:hidden">
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span className="sr-only">Wróć do pulpitu</span>
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">{isDashboard ? 'Marketing' : active.section.label}</p>
            <h2 id="marketing-panel-title" className="text-balance text-2xl font-black leading-tight tracking-tight text-zinc-900 sm:text-3xl">{isDashboard ? 'Pulpit marketingowy' : active.label}</h2>
            <p className="mt-1 text-sm text-zinc-500">{isDashboard ? 'Program lojalnościowy, promocje, gry i zawartość aplikacji w jednym miejscu.' : active.hint}</p>
          </div>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger className="mt-1 flex h-10 shrink-0 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700 shadow-sm hover:bg-zinc-50 xl:hidden">
              <Menu className="size-4" aria-hidden="true" />
              <span>Działy</span>
              <span className="sr-only">marketingu</span>
            </SheetTrigger>
            <SheetContent side="right" className="w-[88%] gap-0 overflow-y-auto bg-white p-0">
              <SheetHeader className="border-b border-zinc-100 p-4">
                <SheetTitle className="text-base font-extrabold">Działy marketingu</SheetTitle>
              </SheetHeader>
              <div className="p-3"><SectionNav activeId={active.id} onSelect={open} /></div>
            </SheetContent>
          </Sheet>
        </header>

        {isDashboard ? (
          <MarketingDashboard onOpen={open} />
        ) : active.id === 'stats' ? (
          <MarketingStatsView onOpen={open} />
        ) : (
          <div className="min-w-0 sm:overflow-hidden sm:rounded-2xl sm:border sm:border-zinc-200/80 sm:bg-white">
            <Panel id={active.id} userRole={userRole} onOpen={open} />
          </div>
        )}
      </section>
    </div>
  )
}

function Panel({ id, userRole, onOpen }: { id: string; userRole: UserRole; onOpen: (id: string) => void }) {
  const padded = (node: ReactNode) => <div className="sm:p-5">{node}</div>
  const onOpenBudget = () => onOpen('overview-budget')
  switch (id) {
    case 'club-tiers': return padded(<WorkshopClubTiers />)
    case 'club-rate': return padded(<LoyaltyRateCard />)
    case 'club-rewards': return padded(<WorkshopRewardsEconomics />)
    case 'club-points-payment': return padded(<WorkshopPointsPayment />)
    case 'club-customers': return padded(<WorkshopCustomers userRole={userRole} embedded />)
    case 'club-recovery': return padded(<WorkshopPointsRecovery />)
    case 'promotions': return padded(<WorkshopPromotions />)
    case 'codes': return padded(<WorkshopPromoCodes />)
    case 'halloween': return padded(<WorkshopHalloweenEconomics />)
    case 'advent': return padded(<WorkshopAdvent />)
    case 'home-slides': return padded(<WorkshopHomeSlides />)
    case 'about': return padded(<WorkshopAbout />)
    case 'install-qr': return padded(<WorkshopInstallQr />)
    case 'wheel':
      return (
        <>
          <div className="sm:px-5 sm:pt-5"><WheelSettings onOpenBudget={onOpenBudget} /></div>
          <WorkshopWheelPrizes />
        </>
      )
    default: return padded(<MarketingOverview onOpen={onOpen} />)
  }
}
