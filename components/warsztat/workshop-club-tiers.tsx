'use client'

import { useState, type FormEvent } from 'react'
import useSWR, { mutate as mutateGlobal } from 'swr'
import { Crown, LoaderCircle, Plus, Save, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import { MAX_TIER_PERCENT, MAX_TIER_PERK_LENGTH, MAX_TIER_PERKS, MAX_TIER_THRESHOLD, type ClubTierSettings } from '@/lib/loyalty'
import { PUBLIC_LOYALTY_KEY } from '@/lib/loyalty-public'

type TierKey = 'fan' | 'silver' | 'gold'
type TiersResponse = { settings: ClubTierSettings; counts: Record<TierKey, number> }
type Draft = { silverMin: string; goldMin: string; silverPercent: string; goldPercent: string; perks: Record<TierKey, string[]> }

const TIERS_KEY = '/api/workshop/club-tiers'
const card = 'rounded-xl border border-zinc-200 bg-white p-3 sm:p-4 shadow-sm sm:p-5'
const inputClass = 'h-10 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3 text-[13px] tabular-nums outline-none transition-colors placeholder:text-zinc-500 focus:border-primary'

const tierMeta: Record<TierKey, { name: string; accent: string; chip: string }> = {
  fan: { name: 'Fan', accent: 'text-[#b8682f]', chip: 'bg-[#f6e4d6]' },
  silver: { name: 'Srebrny Fan', accent: 'text-[#5d6672]', chip: 'bg-zinc-100' },
  gold: { name: 'Złoty Fan', accent: 'text-[#c48a12]', chip: 'bg-[#fcefc8]' },
}

async function fetchTiers(url: string): Promise<TiersResponse> {
  const response = await fetch(url)
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? 'Nie udało się pobrać poziomów.')
  return result
}

const toDraft = (settings: ClubTierSettings): Draft => ({
  silverMin: String(settings.silverMin),
  goldMin: String(settings.goldMin),
  silverPercent: String(settings.silverPercent).replace('.', ','),
  goldPercent: String(settings.goldPercent).replace('.', ','),
  perks: { fan: [...settings.perks.fan], silver: [...settings.perks.silver], gold: [...settings.perks.gold] },
})

const parseNumber = (value: string) => Number(value.replace(',', '.').trim())

function PerksEditor({ tier, perks, onChange }: { tier: TierKey; perks: string[]; onChange: (perks: string[]) => void }) {
  const [value, setValue] = useState('')
  const full = perks.length >= MAX_TIER_PERKS

  function add() {
    const text = value.trim().replace(/\s+/g, ' ')
    if (!text || full) return
    onChange([...perks, text])
    setValue('')
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold text-zinc-600">Dodatkowe korzyści (widoczne dla klienta)</p>
      {perks.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {perks.map((perk, index) => (
            <li key={`${perk}-${index}`} className="flex items-center gap-2 rounded-lg bg-zinc-50 px-2.5 py-1.5 text-[12px] text-zinc-700 ring-1 ring-zinc-200">
              <span className="min-w-0 flex-1 break-words">{perk}</span>
              <button type="button" onClick={() => onChange(perks.filter((_, item) => item !== index))} aria-label={`Usuń korzyść: ${perk}`} className="grid size-7 shrink-0 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600">
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-zinc-300 px-2.5 py-2 text-[11px] text-zinc-500">Brak dodatkowych korzyści – klient widzi tylko rabat i podstawowe zasady.</p>
      )}
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`perk-${tier}`}>Nowa korzyść dla poziomu {tierMeta[tier].name}</label>
        <input
          id={`perk-${tier}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.keyCode === 229) return
            event.preventDefault()
            add()
          }}
          maxLength={MAX_TIER_PERK_LENGTH}
          disabled={full}
          placeholder={full ? `Maksymalnie ${MAX_TIER_PERKS} korzyści` : 'np. Darmowy sos do każdego zamówienia'}
          className={inputClass}
        />
        <button type="button" onClick={add} disabled={!value.trim() || full} className="flex h-10 shrink-0 items-center gap-1 rounded-xl px-3 text-[12px] font-bold text-zinc-700 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 disabled:opacity-40">
          <Plus className="size-4" aria-hidden="true" />Dodaj
        </button>
      </div>
    </div>
  )
}

export function WorkshopClubTiers() {
  const { data, error, isLoading, mutate } = useSWR(TIERS_KEY, fetchTiers, { revalidateOnFocus: false })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)

  if (error) return <p className="rounded-xl bg-red-50 px-3 py-3 text-[12px] text-red-700">{error.message}</p>
  if (isLoading || !data) return <div className="flex flex-col gap-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-40 animate-pulse rounded-xl bg-zinc-100" />)}</div>

  const form = draft ?? toDraft(data.settings)
  const dirty = draft !== null
  const silverMin = parseNumber(form.silverMin)
  const goldMin = parseNumber(form.goldMin)
  const update = (patch: Partial<Draft>) => setDraft({ ...form, ...patch })
  const updatePerks = (tier: TierKey, perks: string[]) => setDraft({ ...form, perks: { ...form.perks, [tier]: perks } })

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload = {
      silverMin,
      goldMin,
      silverPercent: parseNumber(form.silverPercent),
      goldPercent: parseNumber(form.goldPercent),
      perks: form.perks,
    }
    if (!Number.isInteger(payload.silverMin) || !Number.isInteger(payload.goldMin) || payload.silverMin < 1) {
      toast.error('Progi muszą być dodatnimi liczbami całkowitymi.')
      return
    }
    if (payload.goldMin <= payload.silverMin) {
      toast.error('Próg Złotego Fana musi być wyższy niż Srebrnego.')
      return
    }
    setBusy(true)
    try {
      const response = await fetch(TIERS_KEY, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setDraft(null)
      await Promise.all([mutate(), mutateGlobal(PUBLIC_LOYALTY_KEY), mutateGlobal((key) => typeof key === 'string' && key.startsWith('/api/workshop/customers?list=1'))])
      toast.success('Poziomy zapisane', { description: 'Nowe progi i rabaty działają od razu – przy każdym kolejnym zamówieniu.' })
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'Nie udało się zapisać poziomów.')
    } finally {
      setBusy(false)
    }
  }

  const ranges: Record<TierKey, string> = {
    fan: Number.isFinite(silverMin) && silverMin > 0 ? `0 – ${(silverMin - 1).toLocaleString('pl-PL')} pkt` : '—',
    silver: Number.isFinite(silverMin) && Number.isFinite(goldMin) && goldMin > silverMin ? `${silverMin.toLocaleString('pl-PL')} – ${(goldMin - 1).toLocaleString('pl-PL')} pkt` : '—',
    gold: Number.isFinite(goldMin) ? `od ${goldMin.toLocaleString('pl-PL')} pkt` : '—',
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="rounded-xl bg-zinc-50 px-3 py-2.5 text-[12px] leading-relaxed text-zinc-600 ring-1 ring-zinc-200">
        Poziom liczy się <b>tylko z punktów za zamówienia</b> (nie z punktów z gier, koła, kodów ani dodanych ręcznie). Punkty odzyskane ze starej aplikacji liczą się jak punkty za zamówienia. Gdy klient osiągnie próg, rabat włącza się sam – online, w kiosku i na barze. Rabat poziomu nie łączy się z kodem rabatowym: klient dostaje korzystniejszy.
      </p>

      {(['fan', 'silver', 'gold'] as const).map((tier) => {
        const meta = tierMeta[tier]
        return (
          <section key={tier} aria-labelledby={`tier-${tier}-title`} className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 id={`tier-${tier}-title`} className="flex items-center gap-2 text-[15px] font-bold">
                <span className={`grid size-8 place-items-center rounded-full ${meta.chip}`}><Crown className={`size-4 fill-current ${meta.accent}`} aria-hidden="true" /></span>
                {meta.name}
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <span className="rounded-full bg-zinc-50 px-2 py-0.5 font-semibold tabular-nums">{ranges[tier]}</span>
                <span className="flex items-center gap-1 tabular-nums"><Users className="size-3.5" aria-hidden="true" />{data.counts[tier].toLocaleString('pl-PL')} klientów</span>
              </div>
            </div>

            {tier === 'fan' ? (
              <p className="mt-2 text-[12px] text-zinc-500">Poziom startowy – każdy nowy klient. Bez rabatu.</p>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-zinc-600">
                  Próg (punkty za zamówienia)
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_TIER_THRESHOLD}
                    step={1}
                    value={tier === 'silver' ? form.silverMin : form.goldMin}
                    onChange={(event) => update(tier === 'silver' ? { silverMin: event.target.value } : { goldMin: event.target.value })}
                    className={inputClass}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-zinc-600">
                  Stały rabat na zamówienie (%)
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]{1,2}([,.][0-9]{1,2})?"
                    value={tier === 'silver' ? form.silverPercent : form.goldPercent}
                    onChange={(event) => update(tier === 'silver' ? { silverPercent: event.target.value } : { goldPercent: event.target.value })}
                    aria-describedby="tier-percent-hint"
                    className={inputClass}
                    required
                  />
                </label>
              </div>
            )}

            <div className="mt-4">
              <PerksEditor tier={tier} perks={form.perks[tier]} onChange={(perks) => updatePerks(tier, perks)} />
            </div>
          </section>
        )
      })}

      <p id="tier-percent-hint" className="text-[11px] text-zinc-500">Rabat od 0 do {MAX_TIER_PERCENT}%. Wpisz 0, jeśli poziom ma dawać tylko dodatkowe korzyści.</p>

      {dirty && (
        <div role="region" aria-label="Niezapisane zmiany poziomów" className="sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-20 flex items-center gap-2 rounded-xl bg-zinc-900 p-2 pl-3 text-white shadow-lg xl:bottom-4">
          <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">Niezapisane zmiany</span>
          <button type="button" onClick={() => setDraft(null)} disabled={busy} className="h-9 shrink-0 rounded-lg px-3 text-[12px] font-bold text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40">Anuluj</button>
          <button type="submit" disabled={busy} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12px] font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-60">
            {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            Zapisz
          </button>
        </div>
      )}
    </form>
  )
}
