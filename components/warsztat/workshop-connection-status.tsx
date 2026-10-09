'use client'

import { useState, useSyncExternalStore } from 'react'
import { Clock3, Info, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useRestaurantStatus } from '@/lib/use-restaurant-status'

function subscribe(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

/** Uses the browser's network events plus the status poll that already runs every 30s — no extra requests. */
function useConnection() {
  const browserOnline = useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
  const { error } = useRestaurantStatus()
  if (!browserOnline) return 'offline' as const
  if (error) return 'server' as const
  return 'online' as const
}

export function ConnectionDot() {
  const connection = useConnection()
  const online = connection === 'online'
  const label = online ? 'Połączono' : connection === 'offline' ? 'Offline' : 'Brak serwera'
  return (
    <div role="status" aria-label={`Połączenie: ${label}`} title={label} className={cn('flex h-9 items-center gap-2 rounded-xl border px-2.5 text-xs font-bold', online ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700')}>
      <span aria-hidden="true" className="relative flex size-2.5">
        {online && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:hidden" />}
        <span className={cn('relative inline-flex size-2.5 rounded-full', online ? 'bg-emerald-500' : 'bg-red-500')} />
      </span>
      <span className="hidden md:inline">{label}</span>
    </div>
  )
}

/** Shown only while the live order stream is down and the board falls back to the 15s reconcile poll. */
export function StreamDelayBanner({ active }: { active: boolean }) {
  const connection = useConnection()
  const [detailsOpen, setDetailsOpen] = useState(false)
  // The offline/server banner already explains a full outage, so this one only covers the stream-only failure.
  if (!active || connection !== 'online') return null
  return (
    <>
      <div role="status" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-100 px-3 py-2 text-center text-[13px] font-bold text-amber-950 lg:text-base">
        <span className="flex items-center gap-2"><Clock3 className="size-4 shrink-0 lg:size-5" aria-hidden="true" />Awaria połączenia na żywo – zamówienia docierają z opóźnieniem do 15 s</span>
        <button type="button" onClick={() => setDetailsOpen(true)} className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white/70 px-2 py-0.5 text-[12px] font-semibold text-amber-950 transition-colors hover:bg-white lg:text-sm">
          <Info className="size-3.5 lg:size-4" aria-hidden="true" />Szczegóły
        </button>
      </div>
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Opóźnienie zamówień</DialogTitle>
            <DialogDescription>Połączenie na żywo z bazą chwilowo nie działa. Aplikacja sama próbuje je przywrócić, a w międzyczasie sprawdza zamówienia co 15 sekund.</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-2 pl-5 text-sm text-[#36312d]">
            <li>Nowe zamówienia online i zmiany z innych stanowisk (przyjęcie na barze, „gotowe” z kuchni, zgłoszone problemy) pojawiają się z opóźnieniem do ok. 15 s.</li>
            <li>Dźwięk i powiadomienie o nowym zamówieniu nadal działają – tylko później.</li>
            <li>Twoje własne kliknięcia zapisują się od razu, bez opóźnienia.</li>
            <li>Kuchnia nadal widzi tylko zamówienia przyjęte przez bar.</li>
            <li>Jeśli komunikat nie znika przez kilka minut, sprawdź WiFi i odśwież stronę.</li>
          </ul>
          <DialogFooter>
            <Button type="button" onClick={() => setDetailsOpen(false)}>Rozumiem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function OfflineBanner() {
  const connection = useConnection()
  if (connection === 'online') return null
  return (
    <div role="alert" className="flex items-center justify-center gap-2 bg-red-600 px-3 py-2 text-center text-[13px] font-bold text-white lg:text-base">
      <WifiOff className="size-4 shrink-0 lg:size-5" aria-hidden="true" />
      {connection === 'offline'
        ? 'Jesteś offline – nowe zamówienia nie dotrą, dopóki internet nie wróci.'
        : 'Brak połączenia z serwerem – ponawiam próbę…'}
    </div>
  )
}
