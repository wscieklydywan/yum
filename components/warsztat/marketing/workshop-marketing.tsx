'use client'

import { useState } from 'react'
import { CalendarClock, Disc3, Ghost, Megaphone, Star, TicketPercent, Wallet } from 'lucide-react'
import { WorkshopRewardsEconomics } from './workshop-rewards-economics'
import { WorkshopHalloweenEconomics } from './workshop-halloween-economics'
import { cn } from '@/lib/utils'
import { MarketingOverview } from './marketing-overview'
import { WorkshopWheelPrizes } from '../workshop-wheel-prizes'
import { WorkshopPromoCodes } from './workshop-promo-codes'
import { WorkshopPromotions } from './workshop-promotions'

const tabs = [
  { id: 'overview', label: 'Budżet i ustawienia', icon: Wallet },
  { id: 'promotions', label: 'Promocje', icon: CalendarClock },
  { id: 'codes', label: 'Kody rabatowe', icon: TicketPercent },
  { id: 'wheel', label: 'Koło fortuny', icon: Disc3 },
  { id: 'rewards', label: 'Wydaj Stars', icon: Star },
  { id: 'halloween', label: 'Halloween', icon: Ghost },
] as const

type MarketingTab = (typeof tabs)[number]['id']

export function WorkshopMarketing() {
  const [tab, setTab] = useState<MarketingTab>('promotions')
  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="px-3 pt-3 sm:px-5 sm:pt-5">
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b827a]"><Megaphone className="size-3.5 text-primary" aria-hidden="true" />Marketing</p>
        <div role="tablist" aria-label="Narzędzia marketingowe" className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-[#f1ece6] p-1 sm:inline-flex sm:gap-0">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="tab" id={`marketing-tab-${id}`} aria-selected={tab === id} aria-controls={`marketing-panel-${id}`} onClick={() => setTab(id)} className={cn('flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold transition-colors sm:justify-start sm:px-3 sm:py-1.5', tab === id ? 'bg-white text-primary shadow-sm' : 'text-[#6f6861] hover:text-[#211e1b]')}>
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>
      <div role="tabpanel" id={`marketing-panel-${tab}`} aria-labelledby={`marketing-tab-${tab}`}>
        {tab === 'overview' ? <div className="p-3 sm:p-5"><MarketingOverview /></div> : tab === 'promotions' ? <div className="p-3 sm:p-5"><WorkshopPromotions /></div> : tab === 'codes' ? <div className="p-3 sm:p-5"><WorkshopPromoCodes /></div> : tab === 'rewards' ? <div className="p-3 sm:p-5"><WorkshopRewardsEconomics /></div> : tab === 'halloween' ? <div className="p-3 sm:p-5"><WorkshopHalloweenEconomics /></div> : <WorkshopWheelPrizes />}
      </div>
    </div>
  )
}
