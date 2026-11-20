'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { CalendarClock, Crown, Ghost, Loader2 } from 'lucide-react'
import { formatMoney } from '@/lib/marketing'
import {
  HALLOWEEN_ADMIN_KEY,
  eventDays,
  type HalloweenAdminData,
  type HalloweenPrizeConfig,
  type HalloweenSettings,
} from '@/lib/loyalty-economics'
import { inputClass, labelClass } from '../menu-editor/form-styles'
import { EconomicsNote, fetchJson, Metric } from './economics-parts'
import { useStarCost } from './use-star-cost'
import { StepNumber, TabIntro } from './help-parts'
import { WorkshopHalloweenWinners } from './workshop-halloween-winners'

type PrizeDraft = { title: string; short: string; items: string }
type Draft = {
  starts: string
  ends: string
  daily_games: string
  points_per_star: string
  max_stars_per_game: string
  daily_star_cap: string
  runner_up_stars: string
  showcase_until: string
  prizes: PrizeDraft[]
}

const itemsToText = (items: HalloweenPrizeConfig['items']) => items.map((item) => `${item.quantity}x ${item.name}`).join('\n')
const textToItems = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s*[x×*]\s*(.+)$/i)
      return match ? { quantity: Number(match[1]), name: match[2].trim() } : { quantity: 1, name: line }
    })

const todayEnd = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T23:59:59`
}

const pad = (value: number) => String(value).padStart(2, '0')
const toLocalInput = (iso: string) => {
  const date = new Date(iso)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
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
    runner_up_stars: String(settings.runner_up_stars ?? 20),
    showcase_until: toLocalInput(settings.showcase_until ?? settings.ends_at),
    prizes: [0, 1, 2].map((index) => {
      const prize = settings.prizes?.[index]
      return { title: prize?.title ?? '', short: prize?.short ?? '', items: prize ? itemsToText(prize.items) : '' }
    }),
  }
}

const FIELDS: { key: 'daily_games' | 'points_per_star' | 'max_stars_per_game' | 'daily_star_cap'; label: string; hint: string }[] = [
  { key: 'daily_games', label: 'Ile gier dziennie?', hint: 'Na jednego klienta (od 1 do 50)' },
  { key: 'points_per_star', label: 'Ile punktów w grze = 1 Star', hint: 'Im więcej, tym trudniej zdobyć Star' },
  { key: 'max_stars_per_game', label: 'Najwięcej Stars za 1 grę', hint: 'Wpisz 0, jeśli gra ma być tylko dla zabawy' },
  { key: 'daily_star_cap', label: 'Limit dzienny Stars', hint: 'Najwięcej Stars dziennie na klienta, ze wszystkich gier' },
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

  if (error) return <p className="rounded-xl bg-red-50 p-3 sm:p-4 text-sm text-red-700">{error.message}</p>
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
          runner_up_stars: int(draft.runner_up_stars),
          showcase_until: new Date(draft.showcase_until).toISOString(),
          prizes: draft.prizes.map((prize) => ({ title: prize.title, short: prize.short, items: textToItems(prize.items) })),
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
      <TabIntro
        icon={Ghost}
        title="Gra Halloween"
        lead="Klienci grają w grę w Yummy Club i zbierają punkty (Stars). Na koniec 3 najlepszych dostaje nagrody. Tu ustawiasz, kiedy gra trwa i co można wygrać."
        steps={[
          'Ustaw, od kiedy do kiedy trwa gra (krok 1).',
          'Ustal limity punktów, żeby gra nie kosztowała za dużo (krok 2).',
          'Wpisz nagrody dla 1., 2. i 3. miejsca i kliknij „Zapisz” na dole (krok 3).',
        ]}
      />
      <WorkshopHalloweenWinners />
      <section aria-labelledby="hw-summary" className="flex flex-col gap-3">
        <div>
          <h2 id="hw-summary" className="text-base font-black text-zinc-900">Ile Cię to kosztuje?</h2>
          <p className="text-sm text-zinc-500">Liczymy sami. Klient dostaje punkty za darmo, więc koszt pojawia się dopiero, gdy wymieni je na jedzenie.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Do tej pory" value={formatMoney(spentTotal)} hint={`${data.stats.stars} Stars · ${data.stats.games} gier`} />
          <Metric label="Dzisiaj" value={formatMoney(spentToday)} hint={`${data.stats.today_stars} Stars · ${data.stats.today_games} gier`} />
          <Metric label="Średnio na gracza" value={formatMoney(avgPerPlayer)} hint={`${data.stats.players} graczy${data.stats.flagged ? ` · ${data.stats.flagged} podejrzanych gier` : ''}`} />
          <Metric label="Najwięcej na 1 klienta" value={formatMoney(live.perEventCost)} hint={`Cała gra (${live.days} dni)`} />
        </div>
        <EconomicsNote>
          <p>
            Jeden klient może dziennie zdobyć najwyżej <strong className="tabular-nums">{live.perDayStars} Stars</strong>, czyli kosztować Cię ok. <strong className="tabular-nums">{formatMoney(live.perDayCost)}</strong>. Przez całą grę to najwyżej <strong className="tabular-nums">{formatMoney(live.perEventCost)}</strong> na osobę. Chcesz taniej? Zmniejsz „limit dzienny” w kroku 2.
          </p>
        </EconomicsNote>
      </section>

      <section aria-labelledby="hw-settings" className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <StepNumber n={1} />
          <h2 id="hw-settings" className="text-base font-black text-zinc-900">Kiedy trwa gra?</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="hw-starts" className={labelClass}>Gra zaczyna się</label>
            <input id="hw-starts" type="datetime-local" value={draft.starts} onChange={(event) => setDraft({ ...draft, starts: event.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="hw-ends" className={labelClass}>Gra kończy się</label>
            <input id="hw-ends" type="datetime-local" step={1} value={draft.ends} onChange={(event) => setDraft({ ...draft, ends: event.target.value })} className={inputClass} />
            <button
              type="button"
              onClick={() => setDraft({ ...draft, ends: todayEnd() })}
              className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
            >
              <CalendarClock className="size-3.5" aria-hidden="true" />
              Ustaw koniec na dziś 23:59:59
            </button>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="hw-showcase" className={labelClass}>Do kiedy pokazywać baner gry na stronie?</label>
            <input id="hw-showcase" type="datetime-local" value={draft.showcase_until} onChange={(event) => setDraft({ ...draft, showcase_until: event.target.value })} className={inputClass} />
            <p className="mt-1.5 text-xs text-zinc-500">Po końcu gry baner pokazuje zwycięzców. Ustaw np. kilka dni po końcu gry (nie wcześniej niż koniec gry).</p>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, showcase_until: toLocalInput(new Date().toISOString()) })}
              className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
            >
              <CalendarClock className="size-3.5" aria-hidden="true" />
              Ukryj slajd od teraz
            </button>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2.5">
          <StepNumber n={2} />
          <div>
            <h3 className="text-base font-black text-zinc-900">Limity punktów</h3>
            <p className="text-xs text-zinc-500">Nie musisz nic zmieniać – domyślne wartości są bezpieczne.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {FIELDS.map((field) => (
            <div key={field.key}>
              <label htmlFor={`hw-${field.key}`} className={labelClass}>{field.label}</label>
              <input id={`hw-${field.key}`} inputMode="numeric" value={draft[field.key]} onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value.replace(/\D/g, '') })} className={inputClass} />
              <p className="mt-1 text-[11px] text-zinc-500">{field.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="hw-prizes" className="flex flex-col gap-3">
        <div>
          <h2 id="hw-prizes" className="flex items-center gap-2.5 text-base font-black text-zinc-900"><StepNumber n={3} /><Crown className="size-4 text-primary" aria-hidden="true" />Co wygrywają najlepsi?</h2>
          <p className="text-sm text-zinc-500">3 najlepszych graczy dostaje kod na jedzenie. Każdą rzecz wpisz w nowej linii, np. „2x Burger SERTASTIC”.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {draft.prizes.map((prize, index) => {
            const update = (patch: Partial<PrizeDraft>) =>
              setDraft({ ...draft, prizes: draft.prizes.map((item, i) => (i === index ? { ...item, ...patch } : item)) })
            return (
              <fieldset key={index} className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-3">
                <legend className="px-1 text-sm font-black text-primary">{index + 1}. miejsce</legend>
                <div>
                  <label htmlFor={`hw-prize-title-${index}`} className={labelClass}>Nazwa nagrody</label>
                  <input id={`hw-prize-title-${index}`} value={prize.title} maxLength={80} onChange={(event) => update({ title: event.target.value })} className={inputClass} />
                </div>
                <div>
                  <label htmlFor={`hw-prize-short-${index}`} className={labelClass}>Krótka nazwa (widżety)</label>
                  <input id={`hw-prize-short-${index}`} value={prize.short} maxLength={40} onChange={(event) => update({ short: event.target.value })} className={inputClass} />
                </div>
                <div>
                  <label htmlFor={`hw-prize-items-${index}`} className={labelClass}>Pozycje z menu</label>
                  <textarea id={`hw-prize-items-${index}`} rows={3} value={prize.items} onChange={(event) => update({ items: event.target.value })} className={`${inputClass} h-auto py-2`} />
                </div>
              </fieldset>
            )
          })}
        </div>
        <div className="max-w-xs">
          <label htmlFor="hw-runner-up" className={labelClass}>Stars dla miejsc 4–10</label>
          <input id="hw-runner-up" inputMode="numeric" value={draft.runner_up_stars} onChange={(event) => setDraft({ ...draft, runner_up_stars: event.target.value.replace(/\D/g, '') })} className={inputClass} />
          <p className="mt-1 text-[11px] text-zinc-500">0 = bez nagrody za miejsca 4–10</p>
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
