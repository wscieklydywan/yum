'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { BarChart3, Check, Clock3, Eye, EyeOff, Flame, PackageCheck, Settings2, ShoppingBag, Utensils } from 'lucide-react'

const sampleDishes = [
  { name: 'Classic Burger', category: 'Burgery', price: '32,00 zł', sold: 48, status: true },
  { name: 'Cheese Burger', category: 'Burgery', price: '36,00 zł', sold: 36, status: true },
  { name: 'BBQ Burger', category: 'Burgery', price: '38,00 zł', sold: 29, status: true },
  { name: 'Frytki klasyczne', category: 'Dodatki', price: '14,00 zł', sold: 42, status: true },
  { name: 'Frytki belgijskie', category: 'Dodatki', price: '18,00 zł', sold: 24, status: true },
  { name: 'Lemoniada domowa', category: 'Napoje', price: '13,00 zł', sold: 19, status: false },
]

const bestsellers = [
  { name: 'Classic Burger', quantity: 48, revenue: '1 536 zł' },
  { name: 'Frytki klasyczne', quantity: 42, revenue: '588 zł' },
  { name: 'Cheese Burger', quantity: 36, revenue: '1 296 zł' },
  { name: 'BBQ Burger', quantity: 29, revenue: '1 102 zł' },
]

type WorkshopSectionProps = {
  online: boolean
  connected: boolean
  onOnlineChange: (value: boolean) => void
  onConnectedChange: (value: boolean) => void
}

function SectionHeading({ eyebrow, title, description, icon: Icon }: { eyebrow: string; title: string; description: string; icon: typeof Utensils }) {
  return (
    <div className="mb-5 flex items-start gap-3 sm:mb-7">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary sm:size-11"><Icon className="size-5" aria-hidden="true" /></span>
      <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b827a]">{eyebrow}</p><h1 className="mt-1 text-[22px] font-extrabold tracking-tight sm:text-[26px]">{title}</h1><p className="mt-1 text-[12px] text-[#756e67] sm:text-[13px]">{description}</p></div>
    </div>
  )
}

function Surface({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-[#e9e3dc] bg-[#fffdfa] shadow-[0_4px_18px_rgba(33,25,20,0.04)] ${className}`}>{children}</section>
}

function DemoSwitch({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none ${checked ? 'bg-emerald-600' : 'bg-[#d5cec7]'}`}>
      <span className={`size-4 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

export function WorkshopSection({ online, connected, onOnlineChange, onConnectedChange }: WorkshopSectionProps) {
  const [visibleDishes, setVisibleDishes] = useState(() => sampleDishes.map((dish) => dish.status))
  const [period, setPeriod] = useState<'Dzisiaj' | '7 dni' | '30 dni'>('Dzisiaj')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [autoAccept, setAutoAccept] = useState(false)
  const [pickupEnabled, setPickupEnabled] = useState(true)

  function toggleDish(index: number) {
    const nextVisible = !visibleDishes[index]
    setVisibleDishes((current) => current.map((value, itemIndex) => itemIndex === index ? !value : value))
    toast.success(nextVisible ? 'Danie ponownie widoczne w menu' : 'Danie ukryte w menu', { description: sampleDishes[index].name })
  }

  if (typeof window === 'undefined') return null

  const periodMultiplier = period === 'Dzisiaj' ? 1 : period === '7 dni' ? 6.4 : 23.8
  const ordersCount = Math.round(126 * periodMultiplier)
  const revenue = Math.round(8460 * periodMultiplier)

  return (
    <div key="workshop-section" className="min-h-[55vh] animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
      {window.location.hash === '#dania' ? (
        <>
          <SectionHeading eyebrow="Menu restauracji" title="Dania" description="Przykładowa karta dań. Zmieniaj widoczność pozycji jednym kliknięciem." icon={Utensils} />
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] text-[#756e67]">{visibleDishes.filter(Boolean).length} z {sampleDishes.length} pozycji widocznych</p>
            <span className="rounded-full bg-[#ece7e1] px-3 py-1 text-[10px] font-semibold text-[#716960]">KARTA DEMO</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {sampleDishes.map((dish, index) => (
              <Surface key={dish.name} className="flex items-center gap-3 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f5f1ec] text-primary"><ShoppingBag className="size-5" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-bold">{dish.name}</p><p className="mt-0.5 text-[10px] text-[#817871]">{dish.category} · {dish.sold} zamówień</p><p className="mt-1 text-[12px] font-semibold text-[#3c3530]">{dish.price}</p></div>
                <button type="button" onClick={() => toggleDish(index)} aria-pressed={visibleDishes[index]} aria-label={`${visibleDishes[index] ? 'Ukryj' : 'Pokaż'} danie ${dish.name}`} className={`grid size-9 shrink-0 place-items-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${visibleDishes[index] ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-[#f2efeb] text-[#80786f] hover:bg-[#e9e4de]'}`}>{visibleDishes[index] ? <Eye className="size-4" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}</button>
              </Surface>
            ))}
          </div>
        </>
      ) : window.location.hash === '#raporty' ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionHeading eyebrow="Podsumowanie sprzedaży" title="Raporty" description="Przykładowe wyniki restauracji – wyłącznie dane demonstracyjne." icon={BarChart3} />
            <div className="flex rounded-xl border border-[#e5ded6] bg-[#eae5de] p-1" role="group" aria-label="Okres raportu">
              {(['Dzisiaj', '7 dni', '30 dni'] as const).map((item) => <button type="button" key={item} aria-pressed={period === item} onClick={() => setPeriod(item)} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-all ${period === item ? 'bg-white text-[#211e1b] shadow-sm' : 'text-[#706961] hover:text-[#211e1b]'}`}>{item}</button>)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              { label: 'Sprzedaż brutto', value: `${revenue.toLocaleString('pl-PL')} zł`, icon: ShoppingBag, tone: 'text-primary bg-primary/10' },
              { label: 'Zamówienia', value: ordersCount.toLocaleString('pl-PL'), icon: PackageCheck, tone: 'text-emerald-700 bg-emerald-50' },
              { label: 'Średni rachunek', value: '67,14 zł', icon: BarChart3, tone: 'text-amber-700 bg-amber-50' },
              { label: 'Średni czas', value: '18 min', icon: Clock3, tone: 'text-[#655b83] bg-[#f0edf7]' },
            ].map(({ label, value, icon: Icon, tone }) => <Surface key={label} className="p-3.5 sm:p-4"><span className={`grid size-9 place-items-center rounded-xl ${tone}`}><Icon className="size-4" aria-hidden="true" /></span><p className="mt-3 text-[10px] text-[#817871]">{label}</p><p className="mt-0.5 text-[18px] font-extrabold tracking-tight sm:text-[21px]">{value}</p></Surface>)}
          </div>
          <Surface className="mt-4 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-[#f0ece7] px-4 py-3.5"><Flame className="size-4 text-primary" aria-hidden="true" /><h2 className="text-[13px] font-bold">Najczęściej wybierane</h2></div>
            <div className="divide-y divide-[#f0ece7]">
              {bestsellers.map((dish, index) => <div key={dish.name} className="flex items-center gap-3 px-4 py-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#f3f0ec] text-[10px] font-bold text-[#706961]">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-semibold">{dish.name}</p><p className="text-[10px] text-[#817871]">{dish.quantity} sprzedanych</p></div><span className="text-[11px] font-bold">{dish.revenue}</span></div>)}
            </div>
          </Surface>
          <p className="mt-3 text-center text-[10px] text-[#938b83]">Wartości w raporcie są przykładowe i nie odzwierciedlają rzeczywistej sprzedaży.</p>
        </>
      ) : (
        <>
          <SectionHeading eyebrow="Konfiguracja restauracji" title="Ustawienia" description="Przełączniki działają w tej demonstracji. Zmiany nie są zapisywane." icon={Settings2} />
          <div className="grid gap-4 xl:grid-cols-2">
            <Surface className="divide-y divide-[#f0ece7]">
              <div className="px-4 py-3.5"><h2 className="text-[13px] font-bold">Kuchnia</h2><p className="mt-0.5 text-[11px] text-[#817871]">Dostępność lokalu i połączenie</p></div>
              {[
                { label: 'Przyjmowanie zamówień', description: 'Kuchnia jest widoczna jako dostępna', checked: online, onChange: onOnlineChange },
                { label: 'Połączenie Wi-Fi', description: 'Status sieci w panelu kuchennym', checked: connected, onChange: onConnectedChange },
                { label: 'Automatyczne przyjmowanie', description: 'Nowe zamówienia trafiają prosto do kolejki', checked: autoAccept, onChange: setAutoAccept },
              ].map((setting) => <div key={setting.label} className="flex items-center gap-3 px-4 py-3.5"><div className="min-w-0 flex-1"><p className="text-[12px] font-semibold">{setting.label}</p><p className="mt-0.5 text-[10px] leading-relaxed text-[#817871]">{setting.description}</p></div><DemoSwitch checked={setting.checked} label={setting.label} onChange={setting.onChange} /></div>)}
            </Surface>
            <Surface className="divide-y divide-[#f0ece7]">
              <div className="px-4 py-3.5"><h2 className="text-[13px] font-bold">Preferencje panelu</h2><p className="mt-0.5 text-[11px] text-[#817871]">Powiadomienia i opcje odbioru</p></div>
              {[
                { label: 'Dźwięk nowych zamówień', description: 'Powiadomienie dźwiękowe w panelu', checked: soundEnabled, onChange: setSoundEnabled },
                { label: 'Odbiór osobisty', description: 'Pokazuj klientom możliwość odbioru', checked: pickupEnabled, onChange: setPickupEnabled },
              ].map((setting) => <div key={setting.label} className="flex items-center gap-3 px-4 py-3.5"><div className="min-w-0 flex-1"><p className="text-[12px] font-semibold">{setting.label}</p><p className="mt-0.5 text-[10px] leading-relaxed text-[#817871]">{setting.description}</p></div><DemoSwitch checked={setting.checked} label={setting.label} onChange={setting.onChange} /></div>)}
              <div className="flex items-center gap-3 px-4 py-3.5"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#f2efeb] text-[#625b55]"><Settings2 className="size-4" aria-hidden="true" /></span><div><p className="text-[12px] font-semibold">Wersja panelu</p><p className="mt-0.5 text-[10px] text-[#817871]">Warsztat demo · v1.0</p></div><span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-700"><Check className="size-3" aria-hidden="true" />Gotowe</span></div>
            </Surface>
          </div>
        </>
      )}
    </div>
  )
}

export type WorkshopView = 'orders' | 'dishes' | 'reports' | 'settings'

export const workshopViewHash: Record<WorkshopView, string> = {
  orders: '',
  dishes: '#dania',
  reports: '#raporty',
  settings: '#ustawienia',
}

export const workshopViewLabel: Record<WorkshopView, string> = {
  orders: 'Zamówienia',
  dishes: 'Dania',
  reports: 'Raporty',
  settings: 'Ustawienia',
}

export const workshopViewIcon = { orders: PackageCheck, dishes: Utensils, reports: BarChart3, settings: Settings2 }
