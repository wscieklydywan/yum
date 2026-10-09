'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { MAX_CLOSE_BEFORE_MINUTES, WEEKDAYS, isValidTime, type DayHours, type RestaurantStatus } from '@/lib/restaurant-status'
import { updateRestaurant, useRestaurantStatus } from '@/lib/use-restaurant-status'

export function WorkshopOpeningHours() {
  const { status, mutate } = useRestaurantStatus()
  if (!status) return <div className="rounded-2xl border border-[#e5ded6] bg-white p-4 text-sm text-[#847c74]">Wczytywanie godzin otwarcia…</div>
  return <OpeningHoursForm key={status.openingHours.map((day) => `${day.open}${day.close}${day.closed}`).join() + status.autoHours + status.closeBeforeMinutes} status={status} onSaved={(next) => void mutate(next, { revalidate: false })} />
}

function OpeningHoursForm({ status, onSaved }: { status: RestaurantStatus; onSaved: (status: RestaurantStatus) => void }) {
  const [hours, setHours] = useState<DayHours[]>(status.openingHours)
  const [autoHours, setAutoHours] = useState(status.autoHours)
  const [closeBefore, setCloseBefore] = useState(status.closeBeforeMinutes ?? 0)
  const [saving, setSaving] = useState(false)
  const valid = hours.every((day) => isValidTime(day.open) && isValidTime(day.close)) && Number.isInteger(closeBefore) && closeBefore >= 0 && closeBefore <= MAX_CLOSE_BEFORE_MINUTES
  const dirty = autoHours !== status.autoHours || closeBefore !== (status.closeBeforeMinutes ?? 0) || JSON.stringify(hours) !== JSON.stringify(status.openingHours)
  const update = (index: number, patch: Partial<DayHours>) => setHours((current) => current.map((day, i) => i === index ? { ...day, ...patch } : day))

  const save = async () => {
    setSaving(true)
    try {
      const result = await updateRestaurant({ openingHours: hours, autoHours, closeBeforeMinutes: closeBefore })
      onSaved(result.status)
      toast.success('Godziny otwarcia zapisane')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się zapisać godzin.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="opening-hours-title" className="mb-5 rounded-2xl border border-[#e5ded6] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="opening-hours-title" className="text-[16px] font-bold">Godziny otwarcia</h2>
          <p className="mt-0.5 max-w-prose text-[12px] text-[#756e67]">Poza tymi godzinami zamówienia online są automatycznie zamykane, nawet jeśli dzień jest otwarty. Zamknięcie po północy (np. 12:00–02:00) jest obsługiwane.</p>
        </div>
        <label className="flex items-center gap-2 text-[13px] font-semibold">
          <input type="checkbox" checked={autoHours} onChange={(event) => setAutoHours(event.target.checked)} className="size-4 accent-primary" />
          Automatycznie zamykaj zamówienia
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-[#faf7f3] px-3 py-2.5">
        <label htmlFor="close-before" className="text-[13px] font-semibold">Wstrzymaj zamówienia online</label>
        <div className="flex items-center gap-2">
          <input id="close-before" type="number" inputMode="numeric" min={0} max={MAX_CLOSE_BEFORE_MINUTES} step={5} value={closeBefore} disabled={!autoHours} onChange={(event) => setCloseBefore(Math.round(Number(event.target.value) || 0))} className="h-9 w-20 rounded-lg border border-[#e5ded6] bg-white px-2 text-[13px] tabular-nums disabled:opacity-40" />
          <span className="text-[13px] text-[#5f5852]">min przed zamknięciem</span>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Szybki wybór">
          {[0, 15, 30, 45].map((value) => (
            <button key={value} type="button" disabled={!autoHours} onClick={() => setCloseBefore(value)} className={`h-8 rounded-lg px-2.5 text-[12px] font-semibold ring-1 disabled:opacity-40 ${closeBefore === value ? 'bg-primary text-primary-foreground ring-primary' : 'bg-white ring-[#e5ded6]'}`}>{value === 0 ? 'Brak' : `${value} min`}</button>
          ))}
        </div>
        <p className="w-full text-[11px] text-[#756e67]">Np. przy zamknięciu o 22:00 i 15 min, ostatnie zamówienie online można złożyć do 21:45. Lokal i warsztat działają dalej normalnie.</p>
      </div>

      <ul className="mt-4 flex flex-col divide-y divide-[#f0ebe5]">
        {WEEKDAYS.map((name, index) => {
          const day = hours[index]
          return <li key={name} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
            <span className="w-28 text-[13px] font-semibold">{name}</span>
            <label className="flex items-center gap-2 text-[12px] text-[#5f5852]">
              <input type="checkbox" checked={!day.closed} onChange={(event) => update(index, { closed: !event.target.checked })} className="size-4 accent-primary" />
              Otwarte
            </label>
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor={`open-${index}`}>{name} – otwarcie</label>
              <input id={`open-${index}`} type="time" value={day.open} disabled={day.closed} onChange={(event) => update(index, { open: event.target.value })} className="h-9 rounded-lg border border-[#e5ded6] bg-white px-2 text-[13px] tabular-nums disabled:opacity-40" />
              <span aria-hidden="true" className="text-[#8b827a]">–</span>
              <label className="sr-only" htmlFor={`close-${index}`}>{name} – zamknięcie</label>
              <input id={`close-${index}`} type="time" value={day.close} disabled={day.closed} onChange={(event) => update(index, { close: event.target.value })} className="h-9 rounded-lg border border-[#e5ded6] bg-white px-2 text-[13px] tabular-nums disabled:opacity-40" />
            </div>
          </li>
        })}
      </ul>

      <div className="mt-3 flex justify-end">
        <Button onClick={() => void save()} disabled={!dirty || !valid || saving}>{saving ? 'Zapisywanie…' : 'Zapisz godziny'}</Button>
      </div>
    </section>
  )
}
