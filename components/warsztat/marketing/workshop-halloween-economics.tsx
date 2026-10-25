'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Ghost, Loader2 } from 'lucide-react'
import { formatMoney } from '@/lib/marketing'
import { HALLOWEEN_ADMIN_KEY, eventDays, type HalloweenAdminData, type HalloweenSettings } from '@/lib/loyalty-economics'
import { inputClass, labelClass } from '../menu-editor/form-styles'
import { EconomicsNote, fetchJson, Metric } from './economics-parts'
import { useStarCost } from './use-star-cost'

type Draft = { starts: string; ends: string; daily_games: string; points_per_star: string; max_stars_per_game: string; daily_star_cap: string }

const pad = (value: number) => String(value).padStart(2, '0')
const toLocalInput = (iso: string) => {
  const date = new Date(iso)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
const int = (value: string) => Math.max(0, Math.round(Number(value) || 0))

function toDraft(settings: HalloweenSettings): Draft {
  return {
    starts: toLocalInput(settings.starts_at),
    ends: toLocalInput(settings.ends_at),
    daily_games: String(settings.daily_games),
    points_per_star: String(settings.points_per_star),
    max_stars_per_game: String(settings.max_stars_per_game),
    daily_star_cap: String(settings.daily_star_cap),
  }
}

const FIELDS: { key: keyof Draft; label: string; hint: string }[] = [
  { key: 'daily_games', label: 'Gry dziennie', hint: 'Na klienta, 1–50' },
  { key: 'points_per_star', label: 'Wynik za 1 Star', hint: 'Ile punktów w grze = 1 Star' },
  { key: 'max_stars_per_game', label: 'Maks. Stars za grę', hint: '0 = gra bez nagród' },
  { key: 'daily_star_cap', label: 'Dzienny limit Stars', hint: 'Na klienta, łącznie ze wszystkich gier' },
]

export function WorkshopHalloweenEconomics() {
  const { data, error, isLoading, mutate } = useSWR<HalloweenAdminData>(HALLOWEEN_ADMIN_KEY, fetchJson)
  const star = useStarCost()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data && !draft) setDraft(toDraft(data.settings))
  }, [data, draft])

  const live = useMemo(() => {
    if (!draft) return null
    const days = eventDays(draft.starts, draft.ends)
    const perDayStars = Math.min(int(draft.daily_star_cap), int(draft.daily_games) * int(draft.max_stars_per_game))
    const perDayCost = perDayStars * star.starCost
    return {
      days,
      perDayStars,
      perDayCost,
      perEventStars: perDayStars * days,
      perEventCost: perDayCost * days,
      equivalentSpend: perDayStars * days * star.zlPerStar,
    }
  }, [draft, star.starCost, star.zlPerStar])

  if (error) return <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error.message}</p>
  if (isLoading || star.isLoading || !data || !draft || !live) return <div className="flex justify-center p-10"><Loader2 className="size-6 animate-spin text-primary" aria-label="Wczytywanie" /></div>

  const spentTotal = data.stats.stars * star.starCost
  const spentToday = data.stats.today_stars * star.starCost
  const avgPerPlayer = data.stats.players ? spentTotal / data.stats.players : 0
  // Darmowe Stars porównujemy z kwotą, jaką klient musiałby wydać, żeby je zarobić.
  const perDayCostShare = star.zlPerStar > 0 && live.perDayStars > 0 ? (live.perDayCost / (live.perDayStars * star.zlPerStar)) * 100 : 0

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!draft) return
    setSaving(true)
    try {
      const response = await fetch(HALLOWEEN_ADMIN_KEY, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          starts_at: new Date(draft.starts).toISOString(),
          ends_at: new Date(draft.ends).toISOString(),
          daily_games: int(draft.daily_games),
          points_per_star: int(draft.points_per_star),
          max_stars_per_game: int(draft.max_stars_per_game),
          daily_star_cap: int(draft.daily_star_cap),
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error ?? 'Nie udało się zapisać.')
      await mutate(result, { revalidate: false })
      setDraft(toDraft(result.settings))
      toast.success('Zapisano ustawienia gry')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Nie udało się zapisać.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <section aria-labelledby="hw-summary" className="flex flex-col gap-3">
        <div>
          <h2 id="hw-summary" className="flex items-center gap-2 text-base font-black text-[#262220]"><Ghost className="size-4 text-primary" aria-hidden="true" />Opłacalność gry Halloween</h2>
          <p className="text-sm text-[#7a726a]">Stars z gry są darmowe – klient nic nie kupuje. Liczby zmieniają się na bieżąco.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Wydane dotąd" value={formatMoney(spentTotal)} hint={`${data.stats.stars} Stars · ${data.stats.games} gier`} />
          <Metric label="Dzisiaj" value={formatMoney(spentToday)} hint={`${data.stats.today_stars} Stars · ${data.stats.today_games} gier`} />
          <Metric label="Na gracza" value={formatMoney(avgPerPlayer)} hint={`${data.stats.players} graczy${data.stats.flagged ? ` · ${data.stats.flagged} podejrzanych gier` : ''}`} />
          <Metric label="Maks. na klienta" value={formatMoney(live.perEventCost)} hint={`${live.perEventStars} Stars przez ${live.days} dni`} />
        </div>
        <EconomicsNote>
          <p>
            1 Star kosztuje lokal maks. <strong className="tabular-nums">{formatMoney(star.starCost)}</strong> (z katalogu „Wydaj Stars” przy surowcu {star.foodCostPercent}%). Przy obecnych limitach klient zdobędzie dziennie maks. <strong className="tabular-nums">{live.perDayStars} Stars</strong> ={' '}
            <strong className="tabular-nums">{formatMoney(live.perDayCost)}</strong>. Przez całe wydarzenie to maks. <strong className="tabular-nums">{formatMoney(live.perEventCost)}</strong> na jednego klienta – tyle samo Stars dałoby zamówienie za {formatMoney(live.equivalentSpend)}.
            {' '}Koszt Stars to ok. {perDayCostShare.toLocaleString('pl-PL', { maximumFractionDigits: 1 })}% kwoty, za którą trzeba by je kupić, więc liczy się głównie limit dzienny. Koszt pojawia się dopiero, gdy klient odbierze nagrodę.
          </p>
        </EconomicsNote>
      </section>

      <section aria-labelledby="hw-settings" className="flex flex-col gap-3">
        <h2 id="hw-settings" className="text-base font-black text-[#262220]">Ustawienia</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="hw-starts" className={labelClass}>Start wydarzenia</label>
            <input id="hw-starts" type="datetime-local" value={draft.starts} onChange={(event) => setDraft({ ...draft, starts: event.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="hw-ends" className={labelClass}>Koniec wydarzenia</label>
            <input id="hw-ends" type="datetime-local" value={draft.ends} onChange={(event) => setDraft({ ...draft, ends: event.target.value })} className={inputClass} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {FIELDS.map((field) => (
            <div key={field.key}>
              <label htmlFor={`hw-${field.key}`} className={labelClass}>{field.label}</label>
              <input id={`hw-${field.key}`} inputMode="numeric" value={draft[field.key]} onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value.replace(/\D/g, '') })} className={inputClass} />
              <p className="mt-1 text-[11px] text-[#8b827a]">{field.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="sticky bottom-3 z-10 flex justify-end">
        <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg disabled:opacity-60">
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Ghost className="size-4" aria-hidden="true" />}
          Zapisz ustawienia gry
        </button>
      </div>
    </form>
  )
}
