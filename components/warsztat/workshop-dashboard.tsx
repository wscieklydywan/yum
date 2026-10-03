'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChefHat, ChevronDown, Printer, Search, Wifi } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/yummy/logo'
import { initialOrders, statusLabels, type KitchenOrder, type OrderStatus } from './order-data'
import { WorkshopOrderCard } from './workshop-order-card'
import { WorkshopOrderDetails } from './workshop-order-details'
import { WorkshopSidebar } from './workshop-sidebar'
import { DemoOrderDialog, WorkshopDemoSection, type WorkshopSectionKey } from './workshop-demo-tools'

const statuses: OrderStatus[] = ['new', 'preparing', 'ready']

export function WorkshopDashboard() {
  const [orders, setOrders] = useState(initialOrders)
  const [selectedId, setSelectedId] = useState<string | null>(initialOrders[0]?.id ?? null)
  const [activeStatus, setActiveStatus] = useState<OrderStatus>('new')
  const [activeSection, setActiveSection] = useState<WorkshopSectionKey>('orders')
  const [search, setSearch] = useState('')
  const [online, setOnline] = useState(true)
  const [connected, setConnected] = useState(true)
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false)

  const selectedOrder = orders.find((order) => order.id === selectedId) ?? orders[0]
  const counts = useMemo(() => statuses.reduce((result, status) => {
    result[status] = orders.filter((order) => order.status === status).length
    return result
  }, { new: 0, preparing: 0, ready: 0 }), [orders])
  const matchingOrders = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pl-PL')
    return orders.filter((order) => !term || `${order.id} ${order.customer} ${order.phone} ${order.items.map((item) => item.name).join(' ')}`.toLocaleLowerCase('pl-PL').includes(term))
  }, [orders, search])

  useEffect(() => {
    if (!mobileDetailsOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileDetailsOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileDetailsOpen])

  function selectOrder(order: KitchenOrder) {
    setSelectedId(order.id)
    setMobileDetailsOpen(true)
  }

  function changeStatus(id: string, status: OrderStatus) {
    const order = orders.find((item) => item.id === id)
    if (!order || order.status === status) return
    setOrders((current) => current.map((item) => item.id === id ? { ...item, status, paused: false, prepMinutes: status === 'preparing' ? item.prepMinutes ?? 0 : item.prepMinutes, readyMinutes: status === 'ready' ? 1 : item.readyMinutes } : item))
    const action = status === 'preparing' ? 'dodano do aktywnych' : status === 'ready' ? 'oznaczono jako gotowe' : 'przeniesiono do nowych'
    toast.success(`Zamówienie ${id} ${action}`, { description: 'Możesz kontynuować pracę w tej kolejce.' })
  }

  function togglePause(id: string) {
    const order = orders.find((item) => item.id === id)
    if (!order) return
    const paused = !order.paused
    setOrders((current) => current.map((item) => item.id === id ? { ...item, paused } : item))
    toast(paused ? `Wstrzymano ${id}` : `Wznowiono ${id}`, { description: 'Status zamówienia został zaktualizowany.' })
  }

  function handOff(id: string) {
    setOrders((current) => current.map((order) => order.id === id ? { ...order, handedOff: true } : order))
    toast.success(`Zamówienie ${id} wydane`, { description: 'Pozostaje na liście. Zamknij je przyciskiem „Zamknij / usuń”.' })
  }

  function deleteOrder(id: string) {
    setOrders((current) => current.filter((order) => order.id !== id))
    if (selectedId === id) setSelectedId(orders.find((order) => order.id !== id)?.id ?? null)
    setMobileDetailsOpen(false)
    toast.success(`Zamówienie ${id} usunięte z listy`)
  }

  function addDemoOrder(order: KitchenOrder) {
    setOrders((current) => [order, ...current])
    setSelectedId(order.id)
    setActiveSection('orders')
    setActiveStatus('new')
    toast.success(`Dodano zamówienie ${order.id}`, { description: 'Nowe zamówienie demo jest gotowe do rozpoczęcia.' })
  }

  function runPrimaryAction(order: KitchenOrder) {
    if (order.status === 'new') changeStatus(order.id, 'preparing')
    else if (order.status === 'preparing') changeStatus(order.id, 'ready')
    else handOff(order.id)
  }

  function renderCard(order: KitchenOrder) {
    return <WorkshopOrderCard key={order.id} order={order} selected={selectedId === order.id} onSelect={selectOrder} onStart={(id) => changeStatus(id, 'preparing')} onTogglePause={togglePause} onMarkReady={(id) => changeStatus(id, 'ready')} onHandOff={handOff} onDelete={deleteOrder} />
  }

  return (
    <div className="workshop-dashboard min-h-screen bg-[#f1ede7] text-[#201d1a] xl:flex">
      <WorkshopSidebar orderCount={orders.length} activeSection={activeSection} onNavigate={(section) => { setActiveSection(section); setMobileDetailsOpen(false) }} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-[#e4ddd5] bg-[#faf8f5]/95 backdrop-blur-md">
          <div className="mx-auto flex min-h-[60px] w-full max-w-[1800px] items-center justify-between gap-3 px-3 sm:px-5 xl:px-6">
            <a href="/" aria-label="Wróć na stronę Yummy" className="xl:hidden"><Logo priority className="h-8 w-auto" /></a>
            <label className="hidden h-10 w-full max-w-[440px] items-center gap-2.5 rounded-xl border border-[#e8e3dd] bg-white px-3.5 shadow-sm sm:flex">
              <Search className="size-[17px] shrink-0 text-[#6f6963]" aria-hidden="true" /><span className="sr-only">Szukaj zamówienia</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Szukaj zamówienia…" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#8d8780]" />
              <kbd className="rounded-md bg-[#f2efeb] px-1.5 py-0.5 text-[10px] text-[#746e68]">⌘ K</kbd>
            </label>
            <div className="flex items-center gap-2 sm:gap-2.5">
              <span className="hidden rounded-full bg-[#fffdfa] px-2.5 py-1 text-[9px] font-medium text-[#746e68] sm:inline-flex">TRYB DEMO</span>
              <button type="button" onClick={() => { setOnline((value) => !value); toast('Zmieniono status dostępności kuchni') }} aria-pressed={online} className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#e8e3dd] bg-white px-2.5 text-[11px] font-semibold transition-colors hover:bg-[#f7f3ef] sm:px-3.5 sm:text-[12px]">
                <span className={`size-2 rounded-full ${online ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]' : 'bg-[#aaa39c]'}`} /><span className="hidden sm:inline">{online ? 'Kuchnia online' : 'Kuchnia offline'}</span><span className="sm:hidden">{online ? 'Online' : 'Offline'}</span><ChevronDown className="size-3.5 text-[#817a73]" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => { setConnected((value) => !value); toast(connected ? 'Wyłączono podgląd Wi-Fi' : 'Połączono z podglądem Wi-Fi') }} aria-label={connected ? 'Rozłącz Wi-Fi' : 'Połącz Wi-Fi'} aria-pressed={connected} className="grid size-9 place-items-center rounded-xl border border-[#e8e3dd] bg-white text-[#36312d] transition-colors hover:bg-[#f7f3ef]"><Wifi className={`size-[17px] ${connected ? '' : 'text-[#a49c94]'}`} aria-hidden="true" /></button>
              <button type="button" onClick={() => window.print()} aria-label="Drukuj panel" className="hidden size-9 place-items-center rounded-xl border border-[#e8e3dd] bg-white text-[#36312d] transition-colors hover:bg-[#f7f3ef] sm:grid"><Printer className="size-[17px]" aria-hidden="true" /></button>
              <div className="hidden min-w-[66px] text-right sm:block"><p className="text-[14px] font-bold leading-tight">15:24</p><p className="mt-0.5 text-[10px] text-[#756e67]">Wt, 27 maj</p></div>
            </div>
          </div>
          {activeSection === 'orders' && <div className="px-3 pb-3 sm:hidden"><label className="flex h-9 items-center gap-2 rounded-xl border border-[#e8e3dd] bg-white px-3"><Search className="size-4 shrink-0 text-[#6f6963]" aria-hidden="true" /><span className="sr-only">Szukaj zamówienia</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Szukaj zamówienia…" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[#8d8780]" /></label></div>}
        </header>

        <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col px-3 py-4 pb-24 sm:px-5 sm:py-5 sm:pb-24 xl:px-6 xl:pb-5">
          {activeSection === 'orders' ? <>
            <div className="mb-3 flex items-end justify-between gap-3 sm:mb-4">
              <div><div className="flex items-center gap-2"><ChefHat className="size-[17px] text-primary" aria-hidden="true" /><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b827a]">Panel kuchni</p></div><h1 className="mt-1 text-[21px] font-extrabold tracking-tight sm:text-[24px]">Zamówienia</h1></div>
              <div className="flex items-center gap-2"><p className="hidden pb-1 text-[10px] text-[#847c74] sm:block"><span className="font-semibold text-[#3e3833]">{orders.length}</span> w demo</p><DemoOrderDialog onAddOrder={addDemoOrder} /></div>
            </div>
            <nav aria-label="Status zamówień" className="mb-4 flex gap-1.5 overflow-x-auto rounded-xl border border-[#e5ded6] bg-[#eae5de] p-1 sm:mb-5 xl:hidden">
              {statuses.map((status) => <button key={status} type="button" onClick={() => setActiveStatus(status)} aria-pressed={activeStatus === status} className={`flex min-h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold transition-all duration-200 ${activeStatus === status ? 'bg-white text-[#211e1b] shadow-sm' : 'text-[#706961] hover:text-[#211e1b]'}`}><span className="truncate">{statusLabels[status]}</span><span className={`grid min-w-[18px] place-items-center rounded-full px-1 py-0.5 text-[9px] font-bold ${activeStatus === status ? status === 'new' ? 'bg-primary text-white' : status === 'preparing' ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white' : 'bg-white/70 text-[#655e57]'}`}>{counts[status]}</span></button>)}
            </nav>
            <div className="grid min-h-0 flex-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_330px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
                {statuses.map((status) => {
                  const laneOrders = matchingOrders.filter((order) => order.status === status)
                  return <section key={status} aria-labelledby={`lane-${status}`} className={`${status !== activeStatus ? 'hidden lg:block' : ''} min-w-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 duration-200`}>
                    <div className="mb-2.5 flex items-center justify-between gap-2 px-0.5 sm:mb-3"><h2 id={`lane-${status}`} className="text-[14px] font-bold tracking-tight text-[#211e1b] sm:text-[15px]">{statusLabels[status]}</h2><span className={`grid min-w-6 place-items-center rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${status === 'new' ? 'bg-primary' : status === 'preparing' ? 'bg-amber-500' : 'bg-emerald-600'}`}>{counts[status]}</span></div>
                    <div className="flex flex-col gap-2.5 sm:gap-3">{laneOrders.map(renderCard)}{laneOrders.length === 0 && <div className="rounded-2xl border border-dashed border-[#d8d0c7] bg-white/50 px-4 py-8 text-center text-[12px] text-[#847c74]">{search ? 'Brak pasujących zamówień.' : 'Brak zamówień w tej kolejce.'}</div>}</div>
                  </section>
                })}
              </div>
              <aside className="sticky top-[76px] hidden h-[calc(100dvh-92px)] min-h-[500px] xl:block">{selectedOrder ? <WorkshopOrderDetails order={selectedOrder} onPrimaryAction={() => runPrimaryAction(selectedOrder)} onDelete={() => deleteOrder(selectedOrder.id)} /> : <div className="grid h-full place-items-center rounded-2xl border border-dashed border-[#d8d0c7] text-[12px] text-[#847c74]">Wybierz zamówienie</div>}</aside>
            </div>
            <p className="mt-4 text-center text-[10px] text-[#938b83] xl:hidden">Widok demonstracyjny · dane przykładowe</p>
          </> : <WorkshopDemoSection section={activeSection} orders={orders} />}
        </main>
      </div>

      {mobileDetailsOpen && selectedOrder && <div className="fixed inset-0 z-40 flex items-end bg-[#171311]/45 p-0 backdrop-blur-[2px] xl:hidden" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileDetailsOpen(false) }}><div role="dialog" aria-modal="true" aria-label={`Szczegóły zamówienia ${selectedOrder.id}`} className="max-h-[92dvh] w-full overflow-hidden rounded-t-[1.5rem] bg-[#fffdfa] shadow-[0_-12px_44px_rgba(20,15,11,0.2)] motion-safe:animate-in motion-safe:slide-in-from-bottom duration-300 sm:mx-auto sm:max-w-xl sm:rounded-[1.5rem]"><div className="mx-auto my-2.5 h-1 w-10 rounded-full bg-[#d9d2ca] sm:hidden" /><WorkshopOrderDetails order={selectedOrder} onClose={() => setMobileDetailsOpen(false)} onPrimaryAction={() => runPrimaryAction(selectedOrder)} onDelete={() => deleteOrder(selectedOrder.id)} /></div></div>}
      <div className="sr-only" aria-live="polite">{online ? 'Kuchnia jest online' : 'Kuchnia jest offline'}</div>
    </div>
  )
}
