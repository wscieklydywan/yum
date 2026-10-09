'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { BarChart3, Bell, Plus, Settings2, Utensils, Volume2 } from 'lucide-react'
import { toast } from 'sonner'
import type { KitchenOrder } from './order-data'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const demoMenu = [
  { name: 'Classic Burger', category: 'Burgery', price: 32, available: true, prep: '8 min', sold: 28 },
  { name: 'Cheese Burger', category: 'Burgery', price: 35, available: true, prep: '9 min', sold: 21 },
  { name: 'BBQ Burger', category: 'Burgery', price: 36, available: true, prep: '10 min', sold: 18 },
  { name: 'Spicy Burger', category: 'Burgery', price: 34, available: false, prep: '9 min', sold: 0 },
  { name: 'Frytki klasyczne', category: 'Dodatki', price: 12, available: true, prep: '5 min', sold: 24 },
  { name: 'Frytki belgijskie', category: 'Dodatki', price: 15, available: true, prep: '6 min', sold: 16 },
  { name: 'Lemoniada', category: 'Napoje', price: 12, available: true, prep: '2 min', sold: 14 },
]

export function DemoOrderDialog({ onAddOrder }: { onAddOrder: (order: KitchenOrder) => void }) {
  const [open, setOpen] = useState(false)
  const [customer, setCustomer] = useState('')
  const [itemName, setItemName] = useState('Classic Burger')
  const [type, setType] = useState<KitchenOrder['type']>('Odbiór osobisty')

  function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (type !== 'Stacjonarnie' && !customer.trim()) return
    const timestamp = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' }).format(new Date())
    const digits = Date.now().toString().slice(-4)
    onAddOrder({
      id: `#${digits}`,
      status: 'new',
      customer: type === 'Stacjonarnie' ? 'Klient stacjonarny' : customer.trim(),
      phone: type === 'Stacjonarnie' ? '' : '+48 500 000 000',
      type,
      created: timestamp,
      receivedAt: new Date().toISOString(),
      eta: type === 'Dostawa' ? '30–40 min' : type === 'Stacjonarnie' ? 'Na miejscu' : 'Odbiór za 20 min',
      ...(type === 'Dostawa' ? { address: 'ul. Przykładowa 1', postcode: '44-200 Rybnik' } : {}),
      items: [{ quantity: 1, name: itemName }],
      note: 'Zamówienie demonstracyjne',
    })
    setCustomer('')
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} className="h-9 shrink-0 gap-1.5 rounded-xl px-3 text-[11px] font-bold sm:h-10 sm:gap-2 sm:px-3.5 sm:text-xs lg:h-11 lg:px-5 lg:text-sm lg:[&_svg]:size-5">
        <Plus data-icon="inline-start" />Dodaj zamówienie
      </Button>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-extrabold">Nowe zamówienie demo</DialogTitle>
          <DialogDescription>Dodaj przykładową pozycję do kolejki „Nowe”. Dane nie są zapisywane po odświeżeniu.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submitOrder} className="flex flex-col gap-4">
          {type !== 'Stacjonarnie' && <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
            Imię klienta
            <input autoFocus required value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="np. Jan Kowalski" className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none transition focus-visible:ring-2 focus-visible:ring-ring" />
          </label>}
          {type === 'Stacjonarnie' && <p className="rounded-lg bg-violet-50 px-3 py-2.5 text-xs leading-relaxed text-violet-800">Klient kupuje na miejscu – nie trzeba podawać imienia ani danych kontaktowych.</p>}
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
            Danie
            <select value={itemName} onChange={(event) => setItemName(event.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none transition focus-visible:ring-2 focus-visible:ring-ring">
              {demoMenu.filter((item) => item.available).map((item) => <option key={item.name} value={item.name}>{item.name} · {item.price} zł</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
            Typ zamówienia
            <select value={type} onChange={(event) => setType(event.target.value as KitchenOrder['type'])} className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none transition focus-visible:ring-2 focus-visible:ring-ring">
              <option value="Odbiór osobisty">Odbiór osobisty</option><option value="Dostawa">Dostawa</option><option value="Stacjonarnie">Na miejscu · klient przy ladzie</option>
            </select>
          </label>
          <DialogFooter className="-mx-0 -mb-0 rounded-xl border-0 bg-transparent p-0 pt-1 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Anuluj</Button>
            <Button type="submit"><Plus data-icon="inline-start" />Dodaj do kolejki</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export type WorkshopSectionKey = 'orders' | 'history' | 'menu' | 'customers' | 'marketing' | 'reports' | 'settings'

export function WorkshopDemoSection({ section, orders }: { section: Exclude<WorkshopSectionKey, 'orders' | 'history' | 'customers' | 'marketing'>; orders: KitchenOrder[] }) {
  const [menuState, setMenuState] = useState(demoMenu)
  const [notifications, setNotifications] = useState(true)
  const [sound, setSound] = useState(true)
  const totalItems = orders.reduce((total, order) => total + order.items.reduce((sum, item) => sum + item.quantity, 0), 0)
  const prepared = orders.filter((order) => order.status === 'ready').length
  const preparing = orders.filter((order) => order.status === 'preparing').length

  if (section === 'menu') return (
    <section key="menu" className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 duration-300">
      <SectionHeading icon={<Utensils aria-hidden="true" />} eyebrow="Katalog kuchni" title="Dania" description="Przykładowe pozycje w menu i ich dostępność." />
      <div className="mb-4 flex flex-wrap gap-2">{['Wszystkie 7', 'Burgery 4', 'Dodatki 2', 'Napoje 1'].map((category, index) => <span key={category} className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${index === 0 ? 'bg-[#211e1b] text-white' : 'bg-white text-[#756e67] ring-1 ring-[#e8e1d9]'}`}>{category}</span>)}</div>
      <div className="overflow-hidden rounded-2xl border border-[#e8e1d9] bg-white">
        <div className="hidden grid-cols-[minmax(0,1fr)_100px_100px_120px] gap-4 border-b border-[#eee9e3] bg-[#faf8f5] px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#898178] sm:grid"><span>Danie</span><span>Czas</span><span>Cena</span><span>Dostępność</span></div>
        {menuState.map((item, index) => <div key={item.name} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[#fcfaf7] sm:grid-cols-[minmax(0,1fr)_100px_100px_120px] ${index ? 'border-t border-[#f0ece7]' : ''}`}>
          <div className="min-w-0"><p className="truncate text-[13px] font-bold text-[#262220]">{item.name}</p><p className="mt-0.5 text-[10px] text-[#898178] sm:hidden">{item.category} · {item.prep} · {item.price} zł</p><p className="mt-0.5 hidden text-[10px] text-[#898178] sm:block">{item.category}</p></div>
          <span className="hidden text-xs text-[#6f6861] sm:block">{item.prep}</span><span className="hidden text-xs font-semibold sm:block">{item.price} zł</span>
          <button type="button" aria-pressed={item.available} onClick={() => setMenuState((current) => current.map((entry) => entry.name === item.name ? { ...entry, available: !entry.available } : entry))} className={`justify-self-end rounded-full px-2.5 py-1.5 text-[10px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:justify-self-start ${item.available ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-[#f1efec] text-[#777068] hover:bg-[#e9e5df]'}`}>{item.available ? 'Dostępne' : 'Niedostępne'}</button>
        </div>)}
      </div>
    </section>
  )

  if (section === 'reports') return (
    <section key="reports" className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 duration-300">
      <SectionHeading icon={<BarChart3 aria-hidden="true" />} eyebrow="Podsumowanie zmiany" title="Raporty" description="Poglądowe statystyki bieżącej zmiany · dane demo." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        { label: 'Zamówienia', value: orders.length, note: 'w tej sesji', tint: 'bg-[#fffdfa]' },
        { label: 'Pozycje w kuchni', value: totalItems, note: 'łącznie', tint: 'bg-[#fffdfa]' },
        { label: 'Gotowe', value: prepared, note: 'czekają na wydanie', tint: 'bg-emerald-50/70' },
        { label: 'W przygotowaniu', value: preparing, note: 'aktywne teraz', tint: 'bg-amber-50/70' },
      ].map((metric) => <article key={metric.label} className={`rounded-2xl border border-[#e8e1d9] p-4 ${metric.tint}`}><p className="text-[10px] font-semibold text-[#817970]">{metric.label}</p><p className="mt-2 text-3xl font-black tracking-tight text-[#211e1b]">{metric.value}</p><p className="mt-1 text-[10px] text-[#817970]">{metric.note}</p></article>)}</div>
      <div className="mt-4 rounded-2xl border border-[#e8e1d9] bg-white p-4 sm:p-5"><div className="flex items-center justify-between gap-2"><div><p className="text-sm font-bold">Ruch w kuchni</p><p className="mt-1 text-[10px] text-[#817970]">Przykładowa liczba zamówień w ostatnich godzinach</p></div><span className="rounded-full bg-[#f3f0ec] px-2.5 py-1 text-[10px] font-semibold text-[#716a63]">Dzisiaj</span></div><div className="mt-6 flex h-36 items-end gap-2 border-b border-[#eee9e3] px-1 sm:gap-4">{[{ time: '12', value: 32 }, { time: '13', value: 58 }, { time: '14', value: 44 }, { time: '15', value: 84 }, { time: '16', value: 56 }, { time: '17', value: 70 }, { time: '18', value: 38 }].map((bar) => <div key={bar.time} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="w-full max-w-12 rounded-t-md bg-gradient-to-t from-primary to-[#f48470] transition-all hover:brightness-105" style={{ height: `${bar.value}%` }} /><span className="pb-2 text-[9px] text-[#817970]">{bar.time}:00</span></div>)}</div></div>
    </section>
  )

  return <SettingsDemo notifications={notifications} sound={sound} onNotificationsChange={() => { setNotifications((value) => !value); toast.success('Zapisano ustawienie powiadomień w demo') }} onSoundChange={() => { setSound((value) => !value); toast.success('Zapisano ustawienie dźwięku w demo') }} />
}

function SectionHeading({ icon, eyebrow, title, description }: { icon: ReactNode; eyebrow: string; title: string; description: string }) {
  return <div className="mb-5 sm:mb-6"><div className="flex items-center gap-2 text-primary">{icon}<p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b827a]">{eyebrow}</p></div><h1 className="mt-1 text-[22px] font-extrabold tracking-tight sm:text-2xl">{title}</h1><p className="mt-1 text-[11px] text-[#817970] sm:text-xs">{description}</p></div>
}

function SettingsDemo({ notifications, sound, onNotificationsChange, onSoundChange }: { notifications: boolean; sound: boolean; onNotificationsChange: () => void; onSoundChange: () => void }) {
  return <section className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 duration-300"><SectionHeading icon={<Settings2 aria-hidden="true" />} eyebrow="Preferencje stanowiska" title="Ustawienia" description="Ustawienia demonstracyjne tej kuchni." />
    <div className="max-w-2xl overflow-hidden rounded-2xl border border-[#e8e1d9] bg-white"><SettingRow icon={<Bell aria-hidden="true" />} title="Powiadomienia o nowych zamówieniach" description="Informuj o zamówieniach dodanych do kolejki." enabled={notifications} onToggle={onNotificationsChange} /><SettingRow icon={<Volume2 aria-hidden="true" />} title="Dźwięk powiadomienia" description="Odtwarzaj dźwięk przy nowym zamówieniu." enabled={sound} onToggle={onSoundChange} /><div className="flex items-center justify-between gap-4 border-t border-[#f0ece7] p-4"><div><p className="text-[12px] font-bold">Stanowisko</p><p className="mt-1 text-[10px] text-[#817970]">Yummy Rybnik · Kuchnia główna</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">Aktywne</span></div><div className="flex items-center justify-between gap-4 border-t border-[#f0ece7] p-4"><div><p className="text-[12px] font-bold">Tryb pracy</p><p className="mt-1 text-[10px] text-[#817970]">Wszystkie ustawienia są lokalne dla demo.</p></div><span className="rounded-full bg-[#f3f0ec] px-2.5 py-1 text-[10px] font-bold text-[#716a63]">Demo</span></div></div>
  </section>
}

function SettingRow({ icon, title, description, enabled, onToggle }: { icon: ReactNode; title: string; description: string; enabled: boolean; onToggle: () => void }) {
  return <div className="flex items-center gap-3 border-b border-[#f0ece7] p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f5f2ee] text-[#625b55]">{icon}</span><div className="min-w-0 flex-1"><p className="text-[12px] font-bold">{title}</p><p className="mt-1 text-[10px] leading-relaxed text-[#817970]">{description}</p></div><button type="button" role="switch" aria-checked={enabled} aria-label={title} onClick={onToggle} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${enabled ? 'bg-emerald-600' : 'bg-[#d6d0c8]'}`}><span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none ${enabled ? 'translate-x-5' : 'translate-x-0'}`} /></button></div>
}

