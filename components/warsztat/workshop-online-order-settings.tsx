'use client'

import { useState } from 'react'
import { Bike, ChevronDown, Info, Package, Plus, ShoppingBasket, Trash2 } from 'lucide-react'
import { SettingsCard, SettingsField, settingsInputClass } from './workshop-settings-layout'
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

const inputClass = `${settingsInputClass} w-24`

export function WorkshopOnlineOrderSettings() {
  const { status, mutate } = useRestaurantStatus({ realtime: true })
  if (!status) return <div className="rounded-2xl border border-[#e8e2db] bg-white p-5 text-sm text-[#847c74]">Wczytywanie ustawień zamówień…</div>
  const key = JSON.stringify([status.minOrderOnline, status.deliveryZones, status.packagingPrices, status.freeDeliveryFrom, status.packagingVat, status.deliveryVat])
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
    <>
      <SettingsCard icon={ShoppingBasket} title="Minimalne zamówienie" titleId="min-order-title" description="Najniższa wartość dań w koszyku, od której klient może złożyć zamówienie online. Dostawa i opakowania się nie liczą.">
        <SettingsField htmlFor="min-order" label="Wartość koszyka od">
          <input id="min-order" inputMode="decimal" value={minOrder} onChange={(event) => setMinOrder(event.target.value)} className={inputClass} />
          <span className="text-[13px] text-[#6f6760]">zł</span>
        </SettingsField>
      </SettingsCard>

      <SettingsCard icon={Bike} title="Dostawa" titleId="delivery-title" description="Cena zależy od odległości od lokalu. Poza ostatnią strefą nie dowozimy.">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#a39a91]">Strefy</p>
            <ol className="flex flex-col gap-2">
              {zones.map((zone, index) => {
                const from = index === 0 ? 0 : toNumber(zones[index - 1].upToKm) || 0
                return (
                  <li key={index} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[#efe9e2] bg-[#fbf9f6] px-3 py-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-[12px] font-bold text-[#6f6760] ring-1 ring-[#e8e2db]">{index + 1}</span>
                    <label className="flex items-center gap-2 text-[13px] text-[#4f4842]">
                      <span className="tabular-nums">{formatKm(from)} –</span>
                      <input aria-label={`Strefa ${index + 1} – do km`} inputMode="decimal" value={zone.upToKm} onChange={(event) => updateZone(index, { upToKm: event.target.value })} className={`${inputClass} w-20`} />
                      <span>km</span>
                    </label>
                    <span aria-hidden="true" className="text-[#c9c0b6]">→</span>
                    <label className="flex items-center gap-2 text-[13px] text-[#4f4842]">
                      <input aria-label={`Strefa ${index + 1} – cena`} inputMode="decimal" value={zone.fee} onChange={(event) => updateZone(index, { fee: event.target.value })} className={`${inputClass} w-20`} />
                      <span>zł</span>
                    </label>
                    <button type="button" disabled={zones.length === 1} onClick={() => setZones((current) => current.filter((_, i) => i !== index))} className="ml-auto grid size-9 place-items-center rounded-lg text-[#8b827a] transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30" aria-label={`Usuń strefę ${index + 1}`}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                    {zoneErrors[index] && <p className="w-full text-[11px] font-semibold text-red-600">{zoneErrors[index]}</p>}
                  </li>
                )
              })}
            </ol>
            <Button type="button" variant="outline" size="sm" className="self-start" disabled={zones.length >= MAX_ZONES} onClick={addZone}>
              <Plus className="size-4" aria-hidden="true" /> Dodaj strefę
            </Button>
          </div>

          <fieldset className="flex flex-col gap-2 border-t border-[#f0ebe5] pt-4">
            <legend className="sr-only">Darmowa dostawa</legend>
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#a39a91]" aria-hidden="true">Darmowa dostawa</p>
            <div className="flex w-full flex-wrap gap-1 rounded-xl bg-[#f3efea] p-1 sm:w-auto sm:self-start">
              {FREE_MODES.map((mode) => (
                <label key={mode.value} className={`flex flex-1 cursor-pointer items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary sm:flex-none ${freeMode === mode.value ? 'bg-white text-[#211e1b] shadow-sm' : 'text-[#6f6760] hover:text-[#211e1b]'}`}>
                  <input type="radio" name="free-delivery-mode" value={mode.value} checked={freeMode === mode.value} onChange={() => setFreeMode(mode.value)} className="sr-only" />
                  {mode.label}
                </label>
              ))}
            </div>
            {freeMode === 'threshold' && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] text-[#6f6760]">Gdy wartość dań wynosi co najmniej</span>
                <input aria-label="Darmowa dostawa od – kwota" inputMode="decimal" value={freeFrom} onChange={(event) => setFreeFrom(event.target.value)} className={inputClass} />
                <span className="text-[13px] text-[#6f6760]">zł</span>
              </div>
            )}
            {freeMode === 'off' && <p className="text-[12px] text-[#8b827a]">Dostawa zawsze płatna według stref.</p>}
            {freeMode === 'always' && <p className="text-[12px] text-[#8b827a]">Każda dostawa w zasięgu stref jest bezpłatna. Strefy nadal określają, dokąd dowozimy.</p>}
            {!freeValid && <p className="text-[11px] font-semibold text-red-600">Kwota 0–{MAX_MIN_ORDER} zł</p>}
          </fieldset>
        </div>
      </SettingsCard>

      <SettingsCard icon={Package} title="Opakowania" titleId="packaging-title" description="Doliczane automatycznie do zamówień na wynos i z dostawą.">
        <ul className="grid gap-2 sm:grid-cols-2">
          {PACKAGING_KINDS.map((kind) => (
            <li key={kind} className="flex items-center justify-between gap-3 rounded-xl border border-[#efe9e2] bg-[#fbf9f6] px-3 py-2">
              <label htmlFor={`pack-${kind}`} className="text-[13px] font-semibold text-[#2b2622]">{PACKAGING[kind].name}</label>
              <div className="flex items-center gap-2">
                <input id={`pack-${kind}`} inputMode="decimal" value={prices[kind]} onChange={(event) => setPrices((current) => ({ ...current, [kind]: event.target.value }))} className={`${inputClass} w-20`} />
                <span className="text-[13px] text-[#6f6760]">zł</span>
              </div>
            </li>
          ))}
        </ul>
        <details className="group mt-4 rounded-xl bg-[#fbf9f6] px-3 py-2.5 text-[12px] text-[#5f5852]">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-[#4f4842] [&::-webkit-details-marker]:hidden">
            <Info className="size-4 text-[#a39a91]" aria-hidden="true" />Jak naliczamy VAT na paragonie?
            <ChevronDown className="ml-auto size-4 text-[#a39a91] transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
            <li>Opakowania na burgera, box, wrap i folia – jak jedzenie: B (8%).</li>
            <li>Torba i „Dostawa” – dzielone proporcjonalnie między stawki produktów w zamówieniu (jedzenie 8%, napoje 23%).</li>
            <li>Samo opakowanie sprzedane bez produktu – A (23%).</li>
            <li>Stawki produktów ustawiasz w edycji menu.</li>
          </ul>
        </details>
      </SettingsCard>

      <div className={`sticky bottom-20 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-[0_8px_30px_rgba(33,30,27,0.08)] transition-colors xl:bottom-4 ${dirty ? 'border-[#211e1b] bg-[#211e1b] text-white' : 'border-[#e8e2db] bg-white text-[#8b827a]'}`}>
        <p className="text-[13px] font-medium">{dirty ? (valid ? 'Masz niezapisane zmiany – klienci zobaczą je od razu po zapisaniu.' : 'Popraw zaznaczone pola, aby zapisać.') : 'Wszystkie zmiany zapisane.'}</p>
        <Button onClick={() => void save()} disabled={!dirty || !valid || saving}>{saving ? 'Zapisywanie…' : 'Zapisz zmiany'}</Button>
      </div>
    </>
  )
}
