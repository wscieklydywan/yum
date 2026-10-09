'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PACKAGING, PACKAGING_KINDS } from '@/lib/packaging'
import { MAX_MIN_ORDER, MAX_PACKAGING_PRICE, MAX_ZONES, MAX_ZONE_FEE, MAX_ZONE_KM, formatKm, type DeliveryZone, type PackagingPrices } from '@/lib/order-settings'
import type { RestaurantStatus } from '@/lib/restaurant-status'
import { updateRestaurant, useRestaurantStatus } from '@/lib/use-restaurant-status'

type FreeMode = 'off' | 'threshold' | 'always'
const FREE_MODES: { value: FreeMode; label: string }[] = [
  { value: 'off', label: 'Wyłączona' },
  { value: 'threshold', label: 'Od kwoty' },
  { value: 'always', label: 'Zawsze darmowa' },
]

const inputClass = 'h-9 w-24 rounded-lg border border-[#e5ded6] bg-white px-2 text-[13px] tabular-nums'

export function WorkshopOnlineOrderSettings() {
  const { status, mutate } = useRestaurantStatus()
  if (!status) return <div className="mb-5 rounded-2xl border border-[#e5ded6] bg-white p-4 text-sm text-[#847c74]">Wczytywanie ustawień zamówień…</div>
  const key = JSON.stringify([status.minOrderOnline, status.deliveryZones, status.packagingPrices, status.freeDeliveryFrom])
  return <OnlineOrderForm key={key} status={status} onSaved={(next) => void mutate(next, { revalidate: false })} />
}

function OnlineOrderForm({ status, onSaved }: { status: RestaurantStatus; onSaved: (status: RestaurantStatus) => void }) {
  const [minOrder, setMinOrder] = useState(String(status.minOrderOnline))
  const [zones, setZones] = useState<{ upToKm: string; fee: string }[]>(status.deliveryZones.map((zone) => ({ upToKm: String(zone.upToKm), fee: String(zone.fee) })))
  const [prices, setPrices] = useState<Record<string, string>>(Object.fromEntries(PACKAGING_KINDS.map((kind) => [kind, String(status.packagingPrices[kind])])))
  const [freeMode, setFreeMode] = useState<FreeMode>(status.freeDeliveryFrom === null ? 'off' : status.freeDeliveryFrom === 0 ? 'always' : 'threshold')
  const [freeFrom, setFreeFrom] = useState(String(status.freeDeliveryFrom || 100))
  const [saving, setSaving] = useState(false)

  const toNumber = (value: string) => Number(value.replace(',', '.'))
  const parsedMin = toNumber(minOrder)
  const parsedFree = freeMode === 'off' ? null : freeMode === 'always' ? 0 : toNumber(freeFrom)
  const freeValid = parsedFree === null || (Number.isFinite(parsedFree) && parsedFree >= 0 && parsedFree <= MAX_MIN_ORDER)
  const parsedZones: DeliveryZone[] = zones.map((zone) => ({ upToKm: toNumber(zone.upToKm), fee: toNumber(zone.fee) }))
  const parsedPrices = Object.fromEntries(PACKAGING_KINDS.map((kind) => [kind, toNumber(prices[kind])])) as PackagingPrices

  const zoneErrors = parsedZones.map((zone, index) => {
    if (!Number.isFinite(zone.upToKm) || zone.upToKm <= 0 || zone.upToKm > MAX_ZONE_KM) return `Odległość 0–${MAX_ZONE_KM} km`
    if (index > 0 && zone.upToKm <= parsedZones[index - 1].upToKm) return 'Musi być dalej niż poprzednia strefa'
    if (!Number.isFinite(zone.fee) || zone.fee < 0 || zone.fee > MAX_ZONE_FEE) return `Cena 0–${MAX_ZONE_FEE} zł`
    return null
  })
  const valid =
    Number.isFinite(parsedMin) && parsedMin >= 0 && parsedMin <= MAX_MIN_ORDER &&
    zones.length > 0 && zoneErrors.every((error) => !error) && freeValid &&
    PACKAGING_KINDS.every((kind) => Number.isFinite(parsedPrices[kind]) && parsedPrices[kind] >= 0 && parsedPrices[kind] <= MAX_PACKAGING_PRICE)
  const dirty =
    parsedMin !== status.minOrderOnline ||
    parsedFree !== status.freeDeliveryFrom ||
    JSON.stringify(parsedZones) !== JSON.stringify(status.deliveryZones) ||
    PACKAGING_KINDS.some((kind) => parsedPrices[kind] !== status.packagingPrices[kind])

  const updateZone = (index: number, patch: Partial<{ upToKm: string; fee: string }>) =>
    setZones((current) => current.map((zone, i) => (i === index ? { ...zone, ...patch } : zone)))
  const addZone = () =>
    setZones((current) => {
      const last = current[current.length - 1]
      const lastKm = last ? toNumber(last.upToKm) || 0 : 0
      return [...current, { upToKm: String(Math.min(MAX_ZONE_KM, lastKm + 2)), fee: last?.fee ?? '10' }]
    })

  const save = async () => {
    setSaving(true)
    try {
      const result = await updateRestaurant({ minOrderOnline: parsedMin, deliveryZones: parsedZones, freeDeliveryFrom: parsedFree, packagingPrices: parsedPrices })
      onSaved(result.status)
      toast.success('Ustawienia zamówień zapisane')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się zapisać ustawień.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="online-orders-title" className="mb-5 rounded-2xl border border-[#e5ded6] bg-white p-4 sm:p-5">
      <h2 id="online-orders-title" className="text-[16px] font-bold">Zamówienia online</h2>
      <p className="mt-0.5 max-w-prose text-[12px] text-[#756e67]">Minimalna wartość koszyka, cennik dostawy według odległości i ceny opakowań. Zmiany od razu widzą klienci zamawiający online.</p>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-[#faf7f3] px-3 py-2.5">
        <label htmlFor="min-order" className="text-[13px] font-semibold">Minimalna wartość zamówienia</label>
        <div className="flex items-center gap-2">
          <input id="min-order" inputMode="decimal" value={minOrder} onChange={(event) => setMinOrder(event.target.value)} className={inputClass} />
          <span className="text-[13px] text-[#5f5852]">zł (bez dostawy i opakowań)</span>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-[14px] font-bold">Strefy dostawy</h3>
        <p className="text-[12px] text-[#756e67]">Odległość liczona od lokalu. Poza ostatnią strefą nie dowozimy.</p>
        <ul className="mt-2 flex flex-col divide-y divide-[#f0ebe5]">
          {zones.map((zone, index) => {
            const from = index === 0 ? 0 : toNumber(zones[index - 1].upToKm) || 0
            return (
              <li key={index} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
                <span className="w-16 text-[13px] text-[#5f5852]">od {formatKm(from)} km</span>
                <label className="flex items-center gap-2 text-[13px]">
                  <span>do</span>
                  <input aria-label={`Strefa ${index + 1} – do km`} inputMode="decimal" value={zone.upToKm} onChange={(event) => updateZone(index, { upToKm: event.target.value })} className={`${inputClass} w-20`} />
                  <span>km</span>
                </label>
                <label className="flex items-center gap-2 text-[13px]">
                  <span>cena</span>
                  <input aria-label={`Strefa ${index + 1} – cena`} inputMode="decimal" value={zone.fee} onChange={(event) => updateZone(index, { fee: event.target.value })} className={`${inputClass} w-20`} />
                  <span>zł</span>
                </label>
                <button type="button" disabled={zones.length === 1} onClick={() => setZones((current) => current.filter((_, i) => i !== index))} className="ml-auto grid size-8 place-items-center rounded-lg text-[#8b827a] hover:bg-[#f5f0ea] hover:text-red-600 disabled:opacity-30" aria-label={`Usuń strefę ${index + 1}`}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
                {zoneErrors[index] && <p className="w-full text-[11px] font-semibold text-red-600">{zoneErrors[index]}</p>}
              </li>
            )
          })}
        </ul>
        <Button type="button" variant="outline" size="sm" className="mt-1" disabled={zones.length >= MAX_ZONES} onClick={addZone}>
          <Plus className="size-4" aria-hidden="true" /> Dodaj strefę
        </Button>

        <fieldset className="mt-3 rounded-xl bg-[#faf7f3] px-3 py-2.5">
          <legend className="sr-only">Darmowa dostawa</legend>
          <p className="text-[13px] font-semibold" aria-hidden="true">Darmowa dostawa</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {FREE_MODES.map((mode) => (
              <label key={mode.value} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-colors ${freeMode === mode.value ? 'border-[#c2410c] bg-white text-[#c2410c]' : 'border-[#e5ded6] bg-white/60 text-[#5f5852] hover:bg-white'}`}>
                <input type="radio" name="free-delivery-mode" value={mode.value} checked={freeMode === mode.value} onChange={() => setFreeMode(mode.value)} className="size-3.5 accent-[#c2410c]" />
                {mode.label}
              </label>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {freeMode === 'threshold' && (
              <>
                <span className="text-[13px] text-[#5f5852]">od</span>
                <input aria-label="Darmowa dostawa od – kwota" inputMode="decimal" value={freeFrom} onChange={(event) => setFreeFrom(event.target.value)} className={inputClass} />
                <span className="text-[13px] text-[#5f5852]">zł (wartość dań)</span>
              </>
            )}
            {freeMode === 'off' && <span className="text-[12px] text-[#756e67]">Dostawa zawsze płatna wg stref.</span>}
            {freeMode === 'always' && <span className="text-[12px] text-[#756e67]">Każda dostawa w zasięgu stref jest bezpłatna. Strefy nadal określają, dokąd dowozimy.</span>}
          </div>
          {!freeValid && <p className="mt-1 text-[11px] font-semibold text-red-600">Kwota 0–{MAX_MIN_ORDER} zł</p>}
        </fieldset>
      </div>

      <div className="mt-5">
        <h3 className="text-[14px] font-bold">Ceny opakowań</h3>
        <p className="text-[12px] text-[#756e67]">Doliczane automatycznie do zamówień na wynos i z dostawą.</p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {PACKAGING_KINDS.map((kind) => (
            <li key={kind} className="flex items-center justify-between gap-3 rounded-xl bg-[#faf7f3] px-3 py-2">
              <label htmlFor={`pack-${kind}`} className="text-[13px] font-semibold">{PACKAGING[kind].name}</label>
              <div className="flex items-center gap-2">
                <input id={`pack-${kind}`} inputMode="decimal" value={prices[kind]} onChange={(event) => setPrices((current) => ({ ...current, [kind]: event.target.value }))} className={`${inputClass} w-20`} />
                <span className="text-[13px] text-[#5f5852]">zł</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={() => void save()} disabled={!dirty || !valid || saving}>{saving ? 'Zapisywanie…' : 'Zapisz ustawienia'}</Button>
      </div>
    </section>
  )
}
