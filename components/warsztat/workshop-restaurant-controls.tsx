'use client'

import { useState } from 'react'
import { ChefHat, Moon, Sun, Wine } from 'lucide-react'
import { toast } from 'sonner'
import { mutate as mutateCache } from 'swr'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { stationLabel, type RestaurantStatus, type Station } from '@/lib/restaurant-status'
import { updateRestaurant, useRestaurantStatus } from '@/lib/use-restaurant-status'
import { REPORTS_KEY } from './workshop-day-reports'

function useRestaurantUpdate() {
  const { status, mutate } = useRestaurantStatus()
  const [pending, setPending] = useState(false)
  const run = async (body: Record<string, unknown>, success?: (next: RestaurantStatus) => string) => {
    setPending(true)
    try {
      const result = await updateRestaurant(body)
      await mutate(result.status, { revalidate: false })
      void mutateCache('/api/menu/catalog')
      void mutateCache(REPORTS_KEY)
      if (success) toast.success(success(result.status))
      return result
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się zapisać zmian.')
      return null
    } finally {
      setPending(false)
    }
  }
  return { status, pending, run }
}

export function StationToggle({ station, compact = false }: { station: Station; compact?: boolean }) {
  const { status, pending, run } = useRestaurantUpdate()
  const field = station === 'kitchen' ? 'kitchenOpen' : 'barOpen'
  const open = status?.[field] ?? true
  const label = stationLabel(station)
  const Icon = station === 'kitchen' ? ChefHat : Wine

  return (
    <button
      type="button"
      role="switch"
      aria-checked={open}
      aria-label={`${label}: ${open ? 'przyjmuje zamówienia' : 'wyłączona'}`}
      disabled={!status || pending}
      onClick={() => void run({ [field]: !open }, (next) => `${label} ${next[field] ? 'włączon' : 'wyłączon'}${station === 'kitchen' ? 'a' : 'y'}`)}
      className={cn(
        'flex h-9 items-center gap-2 rounded-xl border px-2.5 text-xs font-bold transition-colors disabled:opacity-60',
        open ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span className={cn(compact && 'hidden md:inline')}>{label}</span>
      <span aria-hidden="true" className={cn('relative h-4 w-7 rounded-full transition-colors', open ? 'bg-emerald-600' : 'bg-red-400')}>
        <span className={cn('absolute top-0.5 size-3 rounded-full bg-white shadow transition-all', open ? 'left-3.5' : 'left-0.5')} />
      </span>
    </button>
  )
}

export function DayControl({ onReport }: { onReport?: () => void }) {
  const { status, pending, run } = useRestaurantUpdate()
  const [confirm, setConfirm] = useState<'open' | 'close' | null>(null)
  const dayOpen = status?.dayOpen ?? false

  const submit = async () => {
    if (!confirm) return
    const action = confirm
    const result = await run({ day: action }, () => action === 'open' ? 'Dzień otwarty – zamówienia online aktywne' : 'Dzień zamknięty – raport zapisany')
    if (result) {
      setConfirm(null)
      if (action === 'close') onReport?.()
    }
  }

  return <>
    <button
      type="button"
      disabled={!status || pending}
      onClick={() => setConfirm(dayOpen ? 'close' : 'open')}
      className={cn(
        'flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-bold transition-colors disabled:opacity-60',
        dayOpen ? 'border border-[#e8e3dd] bg-white text-[#36312d] hover:bg-[#f7f3ef]' : 'bg-primary text-primary-foreground hover:bg-primary/90',
      )}
    >
      {dayOpen ? <Moon className="size-4" aria-hidden="true" /> : <Sun className="size-4" aria-hidden="true" />}
      <span className="hidden sm:inline">{dayOpen ? 'Zamknij dzień' : 'Otwórz dzień'}</span>
      <span className="sr-only sm:hidden">{dayOpen ? 'Zamknij dzień' : 'Otwórz dzień'}</span>
    </button>

    <Dialog open={!!confirm} onOpenChange={(open) => { if (!open) setConfirm(null) }}>
      <DialogContent className="workshop-dashboard sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{confirm === 'open' ? 'Otworzyć dzień?' : 'Zamknąć dzień?'}</DialogTitle>
          <DialogDescription>
            {confirm === 'open'
              ? 'Kuchnia i bar zostaną włączone, a zamówienia online będą przyjmowane w godzinach otwarcia.'
              : 'Zamówienia online zostaną wstrzymane, a w Raportach zapisze się podsumowanie dnia: obrót, zwroty, anulacje i najpopularniejsze pozycje.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirm(null)}>Anuluj</Button>
          <Button onClick={() => void submit()} disabled={pending}>{pending ? 'Zapisywanie…' : confirm === 'open' ? 'Otwórz dzień' : 'Zamknij dzień'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}

const formatWarsawTime = (iso: string) => new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' })

export function OrderingBanner({ canOverride = false }: { canOverride?: boolean }) {
  const { status, pending, run } = useRestaurantUpdate()
  if (!status) return null

  if (status.overrideActive && status.orderingOverrideUntil) {
    return (
      <div role="status" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[12px] font-semibold text-emerald-800 sm:mb-4 md:text-sm">
        <span>Zamówienia online włączone ręcznie poza godzinami otwarcia. Od {formatWarsawTime(status.orderingOverrideUntil)} obowiązują zwykłe godziny.</span>
        {canOverride && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => void run({ orderingOverride: false }, () => 'Zamówienia online wstrzymane do godzin otwarcia')} className="h-8 border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100 lg:h-9 lg:px-4 lg:text-sm">
            Wyłącz
          </Button>
        )}
      </div>
    )
  }

  if (status.acceptingOrders) return null
  const outsideHours = status.dayOpen && !status.withinHours
  return (
    <div role="status" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] font-semibold text-red-800 sm:mb-4 md:text-sm">
      <span>Zamówienia online wstrzymane.{status.reason ? ` ${status.reason}` : ''}</span>
      {canOverride && outsideHours && (
        <Button size="sm" disabled={pending} onClick={() => void run({ orderingOverride: true }, () => 'Zamówienia online aktywne – wyłączą się same o otwarciu')} className="h-8 bg-emerald-600 text-white hover:bg-emerald-700 lg:h-9 lg:px-4 lg:text-sm">
          {pending ? 'Zapisywanie…' : 'Aktywuj zamówienia'}
        </Button>
      )}
    </div>
  )
}
