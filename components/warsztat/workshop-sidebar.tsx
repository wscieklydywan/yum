'use client'

import { BarChart3, ClipboardList, Coins, Crown, History, Megaphone, Settings2, Undo2, Utensils } from 'lucide-react'
import { Logo } from '@/components/yummy/logo'
import { usePointsRecoveryRequests } from './workshop-points-recovery'
import { MARKETING_VIEW_KEY, marketingSections } from './marketing/marketing-nav'
import { useHistoryView } from '@/lib/use-history-view'
import type { WorkshopSectionKey } from './workshop-demo-tools'
import type { UserRole } from './workshop-access'

const navigation = [
  { id: 'orders', label: 'Zamówienia', icon: ClipboardList },
  { id: 'history', label: 'Historia', icon: History },
  { id: 'menu', label: 'Dania', icon: Utensils },
  { id: 'customers', label: 'Klienci', icon: Coins },
  { id: 'club', label: 'Yummy Club', icon: Crown },
  { id: 'points', label: 'Stare punkty', icon: Undo2 },
  { id: 'marketing', label: 'Marketing', icon: Megaphone },
  { id: 'reports', label: 'Raporty', icon: BarChart3 },
  { id: 'settings', label: 'Ustawienia', icon: Settings2 },
] as const

export function WorkshopSidebar({ orderCount, activeSection, userRole, onNavigate }: { orderCount: number; activeSection: WorkshopSectionKey; userRole: UserRole; onNavigate: (section: WorkshopSectionKey) => void }) {
  const isManager = userRole === 'admin' || userRole === 'szef'
  // Managers reach Yummy Club (tiers, customers, old points) under Marketing; waiters keep the plain lookups.
  const items = navigation.filter(({ id }) => {
    if (id === 'club') return false
    if (id === 'marketing') return isManager
    if (id === 'customers' || id === 'points') return userRole === 'kelner'
    if (id === 'history') return isManager || userRole === 'kelner'
    return true
  })
  const { data: recovery } = usePointsRecoveryRequests(isManager || userRole === 'kelner')
  const pendingRecovery = recovery?.pending.length ?? 0
  const [marketingView, setMarketingView] = useHistoryView<string>(MARKETING_VIEW_KEY, 'overview')
  const showMarketingNav = activeSection === 'marketing' && isManager
  // The kitchen only needs orders and dishes; both live as tabs in the header, so the sidebar gives its space to the tickets.
  if (userRole === 'kuchnia') return null
  return <>
    <aside className={`hidden min-h-screen shrink-0 flex-col overflow-y-auto overscroll-contain bg-[#111110] px-3 py-5 text-white [scrollbar-color:rgba(255,255,255,0.15)_transparent] [scrollbar-width:thin] xl:flex xl:h-dvh xl:min-h-0 ${showMarketingNav ? 'w-[232px]' : 'w-[188px]'}`}>
      <div className="mb-8 px-3"><Logo variant="white" priority className="h-10 w-auto" /></div>
      <nav aria-label="Menu warsztatu" className="flex flex-col gap-1.5">
        {items.map(({ id, label, icon: Icon }) => {
          const active = activeSection === id
          if (id === 'marketing' && showMarketingNav) return <div key={id} className="flex flex-col gap-1.5">
            <button type="button" onClick={() => setMarketingView('overview')} aria-current={marketingView === 'overview' ? 'page' : undefined} className="flex min-h-11 items-center gap-3 rounded-xl bg-[#fbf7f2] px-3 text-left text-[13px] font-medium text-primary shadow-sm"><Icon className="size-[17px] shrink-0" aria-hidden="true" />Panel marketingowy{pendingRecovery > 0 && <span aria-label={`Nowe zgłoszenia: ${pendingRecovery}`} className="ml-auto rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{pendingRecovery}</span>}</button>
            <nav aria-label="Działy marketingu" className="mb-2 ml-3 flex flex-col gap-3 border-l border-white/10 py-1 pl-2">
              {marketingSections.map((section) => <div key={section.id} className="flex flex-col gap-0.5">
                <p className="px-2 pb-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white/35">{section.label}</p>
                {section.items.map(({ id: itemId, label: itemLabel, icon: ItemIcon }) => {
                  const selected = marketingView === itemId
                  return <button key={itemId} type="button" onClick={() => setMarketingView(itemId)} aria-current={selected ? 'page' : undefined} className={`flex min-h-8 items-center gap-2 rounded-lg px-2 text-left text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selected ? 'bg-white/10 font-semibold text-white' : 'text-white/55 hover:bg-white/5 hover:text-white'}`}><ItemIcon className={`size-3.5 shrink-0 ${selected ? 'text-primary' : ''}`} aria-hidden="true" /><span className="truncate">{itemLabel}</span></button>
                })}
              </div>)}
            </nav>
          </div>
          return <button key={id} type="button" onClick={() => onNavigate(id)} aria-current={active ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-[13px] font-medium transition-all duration-200 ${active ? 'bg-[#fbf7f2] text-primary shadow-sm' : 'text-white/60 hover:translate-x-0.5 hover:bg-white/5 hover:text-white'}`}><Icon className="size-[17px] shrink-0" aria-hidden="true" />{label}{id === 'orders' && <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${active ? 'bg-primary text-white' : 'bg-white/10 text-white/80'}`}>{orderCount}</span>}{(id === 'points' || (id === 'marketing' && isManager)) && pendingRecovery > 0 && <span aria-label={`Nowe zgłoszenia: ${pendingRecovery}`} className="ml-auto rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{pendingRecovery}</span>}</button>
        })}
      </nav>
      <div className="mt-auto px-3 pt-8 text-[10px] text-white/45">v1.0</div>
    </aside>
    <nav aria-label="Menu warsztatu na telefonie" className="fixed inset-x-0 bottom-0 z-30 grid border-t border-[#e8e1d9] bg-[#fffdfa]/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-4px_20px_rgba(35,29,24,0.07)] backdrop-blur-xl xl:hidden" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map(({ id, label, icon: Icon }) => {
        const active = activeSection === id
        return <button key={id} type="button" onClick={() => onNavigate(id)} aria-current={active ? 'page' : undefined} className={`relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-semibold transition-all duration-200 ${active ? 'text-primary' : 'text-[#80786f] hover:bg-[#f5f2ee]'}`}><Icon className={`size-[17px] transition-transform ${active ? '-translate-y-0.5' : ''}`} aria-hidden="true" />{label}{id === 'orders' && <span className="absolute right-[calc(50%-19px)] top-0 grid min-w-4 place-items-center rounded-full bg-primary px-1 py-0.5 text-[8px] font-bold leading-none text-white">{orderCount}</span>}{(id === 'points' || (id === 'marketing' && isManager)) && pendingRecovery > 0 && <span aria-label={`Nowe zgłoszenia: ${pendingRecovery}`} className="absolute right-[calc(50%-19px)] top-0 grid min-w-4 place-items-center rounded-full bg-amber-500 px-1 py-0.5 text-[8px] font-bold leading-none text-white">{pendingRecovery}</span>}</button>
      })}
    </nav>
  </>
}
