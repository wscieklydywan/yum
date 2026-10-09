'use client'

import { useState } from 'react'
import { Disc3, Megaphone, TicketPercent } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkshopWheelPrizes } from '../workshop-wheel-prizes'
import { WorkshopPromoCodes } from './workshop-promo-codes'

const tabs = [
  { id: 'codes', label: 'Kody rabatowe', icon: TicketPercent },
  { id: 'wheel', label: 'Koło fortuny', icon: Disc3 },
] as const

type MarketingTab = (typeof tabs)[number]['id']

export function WorkshopMarketing() {
  const [tab, setTab] = useState<MarketingTab>('codes')
  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="px-3 pt-3 sm:px-5 sm:pt-5">
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b827a]"><Megaphone className="size-3.5 text-primary" aria-hidden="true" />Marketing</p>
        <div role="tablist" aria-label="Narzędzia marketingowe" className="mt-2 inline-flex rounded-xl bg-[#f1ece6] p-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="tab" id={`marketing-tab-${id}`} aria-selected={tab === id} aria-controls={`marketing-panel-${id}`} onClick={() => setTab(id)} className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors', tab === id ? 'bg-white text-primary shadow-sm' : 'text-[#6f6861] hover:text-[#211e1b]')}>
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>
      <div role="tabpanel" id={`marketing-panel-${tab}`} aria-labelledby={`marketing-tab-${tab}`}>
        {tab === 'codes' ? <div className="p-3 sm:p-5"><WorkshopPromoCodes /></div> : <WorkshopWheelPrizes />}
      </div>
    </div>
  )
}
