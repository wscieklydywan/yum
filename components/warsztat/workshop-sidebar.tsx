'use client'

import { BarChart3, ClipboardList, Settings2, Utensils } from 'lucide-react'
import { Logo } from '@/components/yummy/logo'
import type { WorkshopSectionKey } from './workshop-demo-tools'

const navigation = [
  { id: 'orders', label: 'Zamówienia', icon: ClipboardList },
  { id: 'menu', label: 'Dania', icon: Utensils },
  { id: 'reports', label: 'Raporty', icon: BarChart3 },
  { id: 'settings', label: 'Ustawienia', icon: Settings2 },
] as const

export function WorkshopSidebar({ orderCount, activeSection, onNavigate }: { orderCount: number; activeSection: WorkshopSectionKey; onNavigate: (section: WorkshopSectionKey) => void }) {
  return <>
    <aside className="hidden min-h-screen w-[188px] shrink-0 flex-col bg-[#111110] px-3 py-5 text-white xl:flex">
      <a href="/" aria-label="Yummy – strona główna" className="mb-8 px-3"><Logo variant="white" priority className="h-10 w-auto" /></a>
      <nav aria-label="Menu warsztatu" className="flex flex-col gap-1.5">
        {navigation.map(({ id, label, icon: Icon }) => {
          const active = activeSection === id
          return <button key={id} type="button" onClick={() => onNavigate(id)} aria-current={active ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-[13px] font-medium transition-all duration-200 ${active ? 'bg-[#fbf7f2] text-primary shadow-sm' : 'text-white/60 hover:translate-x-0.5 hover:bg-white/5 hover:text-white'}`}><Icon className="size-[17px] shrink-0" aria-hidden="true" />{label}{id === 'orders' && <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${active ? 'bg-primary text-white' : 'bg-white/10 text-white/80'}`}>{orderCount}</span>}</button>
        })}
      </nav>
      <div className="mt-auto px-3 pt-8 text-[10px] text-white/45">Dane przykładowe · v1.0</div>
    </aside>
    <nav aria-label="Menu warsztatu na telefonie" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-[#e8e1d9] bg-[#fffdfa]/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-4px_20px_rgba(35,29,24,0.07)] backdrop-blur-xl xl:hidden">
      {navigation.map(({ id, label, icon: Icon }) => {
        const active = activeSection === id
        return <button key={id} type="button" onClick={() => onNavigate(id)} aria-current={active ? 'page' : undefined} className={`relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-semibold transition-all duration-200 ${active ? 'text-primary' : 'text-[#80786f] hover:bg-[#f5f2ee]'}`}><Icon className={`size-[17px] transition-transform ${active ? '-translate-y-0.5' : ''}`} aria-hidden="true" />{label}{id === 'orders' && <span className="absolute right-[calc(50%-19px)] top-0 grid min-w-4 place-items-center rounded-full bg-primary px-1 py-0.5 text-[8px] font-bold leading-none text-white">{orderCount}</span>}</button>
      })}
    </nav>
  </>
}
