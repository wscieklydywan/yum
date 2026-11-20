'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Clock, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SettingsCard, SettingsField, SettingsSwitch, settingsInputClass } from './workshop-settings-layout'
import { MAX_CLOSE_BEFORE_MINUTES, WEEKDAYS, isValidTime, type DayHours, type RestaurantStatus } from '@/lib/restaurant-status'
import { updateRestaurant, useRestaurantStatus } from '@/lib/use-restaurant-status'

export function WorkshopOpeningHours() {
  const { status, mutate } = useRestaurantStatus({ realtime: true })
  if (!status) return <div className="rounded-2xl border border-[#e8e2db] bg-white p-5 text-sm text-[#847c74]">Wczytywanie godzin otwarcia…</div>
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
    <>
      <SettingsCard
        icon={Timer}
        title="Automatyczne zamykanie zamówień online"
        titleId="auto-hours-title"
        description="Poza godzinami otwarcia sklep online sam przestaje przyjmować zamówienia. Lokal i warsztat działają dalej normalnie."
        action={<SettingsSwitch checked={autoHours} onChange={setAutoHours} labelledBy="auto-hours-title" />}
      >
        <SettingsField htmlFor="close-before" label="Ostatnie zamówienie online" hint={closeBefore > 0 ? `Np. przy zamknięciu o 22:00 ostatnie zamówienie można złożyć do ${lastOrderExample(closeBefore)}.` : 'Zamówienia przyjmowane do samego zamknięcia.'}>
          <div className="flex gap-1 rounded-xl bg-[#f3efea] p-1" role="group" aria-label="Szybki wybór">
            {[0, 15, 30, 45].map((value) => (
              <button key={value} type="button" disabled={!autoHours} aria-pressed={closeBefore === value} onClick={() => setCloseBefore(value)} className={`h-8 rounded-lg px-3 text-[12px] font-semibold transition-colors disabled:opacity-40 ${closeBefore === value ? 'bg-white text-[#211e1b] shadow-sm' : 'text-[#6f6760] hover:text-[#211e1b]'}`}>{value === 0 ? 'Do końca' : `${value} min`}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input id="close-before" type="number" inputMode="numeric" min={0} max={MAX_CLOSE_BEFORE_MINUTES} step={5} value={closeBefore} disabled={!autoHours} onChange={(event) => setCloseBefore(Math.round(Number(event.target.value) || 0))} className={`${settingsInputClass} w-20`} />
            <span className="text-[12px] text-[#6f6760]">min przed</span>
          </div>
        </SettingsField>
      </SettingsCard>

      <SettingsCard
        icon={Clock}
        title="Godziny otwarcia"
        titleId="opening-hours-title"
        description="Zamknięcie po północy (np. 12:00–02:00) jest obsługiwane."
        footer={<>
          {dirty && <span className="mr-auto text-[12px] text-[#8b827a]">Masz niezapisane zmiany</span>}
          <Button onClick={() => void save()} disabled={!dirty || !valid || saving}>{saving ? 'Zapisywanie…' : 'Zapisz godziny'}</Button>
        </>}
      >
        <ul className="flex flex-col divide-y divide-[#f0ebe5]">
          {WEEKDAYS.map((name, index) => {
            const day = hours[index]
            return <li key={name} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5 first:pt-0 last:pb-0">
              <div className="flex w-40 items-center gap-3">
                <SettingsSwitch checked={!day.closed} onChange={(open) => update(index, { closed: !open })} label={`${name} – otwarte`} />
                <span className="text-[13px] font-semibold text-[#2b2622]">{name}</span>
              </div>
              {day.closed ? <span className="rounded-full bg-[#f3efea] px-3 py-1.5 text-[12px] font-semibold text-[#8b827a]">Zamknięte</span> : <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`open-${index}`}>{name} – otwarcie</label>
                <input id={`open-${index}`} type="time" value={day.open} onChange={(event) => update(index, { open: event.target.value })} className={settingsInputClass} />
                <span aria-hidden="true" className="text-[#8b827a]">–</span>
                <label className="sr-only" htmlFor={`close-${index}`}>{name} – zamknięcie</label>
                <input id={`close-${index}`} type="time" value={day.close} onChange={(event) => update(index, { close: event.target.value })} className={settingsInputClass} />
              </div>}
            </li>
          })}
        </ul>
      </SettingsCard>
    </>
  )
}

function lastOrderExample(minutes: number) {
  const total = 22 * 60 - minutes
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
