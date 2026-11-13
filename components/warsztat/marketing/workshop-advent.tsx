'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { CalendarDays, Eye, EyeOff, Gift, LayoutGrid, List, Loader2, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ADVENT_ADMIN_KEY, ADVENT_DEFAULT_DAYS, adventDateLabel, adventDefaultColor, isAdventColor, type AdventMode } from '@/lib/advent'
import { useMenu, useMenuCategories } from '@/lib/use-menu'
import { AdventDayEditor, dayIssue, type DayDraft } from './advent-day-editor'
import { AdventCalendarBoard } from './advent-calendar-board'
import type { AdventAdminData, AdventDayConfig, AdventSettings } from '@/app/api/workshop/advent/route'
import { inputClass, labelClass } from '../menu-editor/form-styles'
import { EconomicsNote, fetchJson, Metric } from './economics-parts'
import { StepNumber, TabIntro } from './help-parts'

type Draft = Omit<AdventSettings, 'days' | 'coupon_valid_days'> & { days: string; coupon_valid_days: string; windows: DayDraft[] }

const MODES: { id: AdventMode; label: string; hint: string; icon: typeof Eye }[] = [
  { id: 'off', label: 'Wyłączony', hint: 'Klienci nic nie widzą.', icon: EyeOff },
  { id: 'teaser', label: 'Zapowiedź', hint: 'Widać kalendarz i datę startu, okienka są zamknięte.', icon: Megaphone },
  { id: 'live', label: 'Włączony', hint: 'Od daty startu klienci otwierają okienka.', icon: Eye },
]

const emptyDay = (dayNumber: number): DayDraft => ({ kind: 'stars', title: '', description: '', stars: '10', items: [], discount_type: 'percent', discount_value: '10', color: adventDefaultColor(dayNumber) })

function toDayDraft(day: AdventDayConfig | undefined, dayNumber: number): DayDraft {
  if (!day) return emptyDay(dayNumber)
  return {
    color: isAdventColor(day.color) ? day.color : adventDefaultColor(dayNumber),
    kind: day.kind,
    title: day.title,
    description: day.description ?? '',
    stars: String(day.stars || 10),
    items: (day.items ?? []).map((item) => ({ product_id: item.product_id ?? null, name: item.name, quantity: item.quantity })),
    discount_type: day.discount_type ?? 'percent',
    discount_value: String(day.discount_value ?? 10),
  }
}

function toDraft(data: AdventAdminData): Draft {
  const byDay = new Map(data.days.map((day) => [day.day, day]))
  return {
    ...data.settings,
    days: String(data.settings.days),
    coupon_valid_days: String(data.settings.coupon_valid_days),
    windows: Array.from({ length: 31 }, (_, index) => toDayDraft(byDay.get(index + 1), index + 1)),
  }
}

const digits = (value: string) => value.replace(/\D/g, '')

export function WorkshopAdvent() {
  const { data, error, isLoading, mutate } = useSWR<AdventAdminData>(ADVENT_ADMIN_KEY, fetchJson)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [selected, setSelected] = useState(0)
  const { products, isLoading: menuLoading } = useMenu({ includeUnavailable: true })
  const { categories } = useMenuCategories()
  const productIds = useMemo(() => new Set(products.map((product) => product.id)), [products])

  useEffect(() => {
    if (data && !draft) setDraft(toDraft(data))
  }, [data, draft])

  if (error) return <p className="rounded-xl bg-red-50 p-3 sm:p-4 text-sm text-red-700">{error.message}</p>
  if (isLoading || !data || !draft) return <div className="flex justify-center p-10"><Loader2 className="size-6 animate-spin text-primary" aria-label="Wczytywanie" /></div>

  const dayCount = Math.min(31, Math.max(1, Number(draft.days) || ADVENT_DEFAULT_DAYS))
  const windows = draft.windows.slice(0, dayCount)
  const plannedStars = windows.reduce((sum, day) => sum + (day.kind === 'stars' ? Number(day.stars) || 0 : 0), 0)
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })
  const updateDay = (index: number, patch: Partial<DayDraft>) =>
    setDraft({ ...draft, windows: draft.windows.map((day, i) => (i === index ? { ...day, ...patch } : day)) })
  const copyPrevious = (index: number) =>
    index > 0 && updateDay(index, { ...draft.windows[index - 1], items: draft.windows[index - 1].items.map((item) => ({ ...item })), color: draft.windows[index].color })
  const issues = windows.map((day) => (menuLoading && day.kind === 'food' ? null : dayIssue(day, productIds)))
  const issueCount = issues.filter(Boolean).length
  const current = Math.min(selected, dayCount - 1)
  const todayKey = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' })
  const todayOffset = Math.round((Date.parse(todayKey) - Date.parse(draft.starts_on)) / 86_400_000)
  const todayIndex = todayOffset >= 0 && todayOffset < dayCount ? todayOffset : null

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!draft) return
    const firstIssue = issues.findIndex(Boolean)
    if (firstIssue >= 0) {
      setSelected(firstIssue)
      setView('calendar')
      toast.error(`Dzień ${firstIssue + 1}: ${issues[firstIssue]}`)
      return
    }
    setSaving(true)
    try {
      const response = await fetch(ADVENT_ADMIN_KEY, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            mode: draft.mode,
            starts_on: draft.starts_on,
            days: dayCount,
            allow_late: draft.allow_late,
            coupon_valid_days: Number(draft.coupon_valid_days),
            teaser_text: draft.teaser_text,
            show_home_slide: draft.show_home_slide,
            show_bubble: draft.show_bubble,
            show_club_banner: draft.show_club_banner,
          },
          days: windows.map((day) => ({
            kind: day.kind,
            title: day.title,
            description: day.description,
            stars: Number(day.stars),
            items: day.kind === 'food' ? day.items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })) : [],
            discount_type: day.discount_type,
            discount_value: Number(day.discount_value.replace(',', '.')),
            color: day.color,
          })),
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error ?? 'Nie udało się zapisać.')
      await mutate(result, { revalidate: false })
      setDraft(toDraft(result))
      toast.success('Zapisano kalendarz adwentowy')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Nie udało się zapisać.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <TabIntro
        icon={CalendarDays}
        title="Kalendarz adwentowy"
        lead="Klienci Yummy Club codziennie otwierają jedno okienko i dostają niespodziankę: Stars, kod na jedzenie albo rabat. Możesz go najpierw tylko zapowiedzieć, a w dniu startu włączyć."
        steps={[
          'Wybierz, czy kalendarz jest wyłączony, w zapowiedzi czy włączony (krok 1).',
          'Ustaw datę pierwszego okienka i gdzie ma być widoczny (krok 2).',
          'Klikaj okienka w kalendarzu, ustaw nagrody (jedzenie z menu) i kolor kafelka, a potem kliknij „Zapisz” na dole (krok 3).',
        ]}
      />

      <section aria-labelledby="adv-stats" className="flex flex-col gap-3">
        <h2 id="adv-stats" className="text-base font-black text-zinc-900">Jak idzie?</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Otwarte okienka" value={data.stats.opens} hint={`${data.stats.players} klientów`} />
          <Metric label="Rozdane Stars" value={data.stats.stars} hint={`W planie: ${plannedStars} na klienta`} />
          <Metric label="Wydane kody" value={data.stats.coupons} hint="Jedzenie i rabaty" />
          <Metric label="Wykorzystane kody" value={data.stats.coupons_used} hint={data.stats.coupons ? `${Math.round((data.stats.coupons_used / data.stats.coupons) * 100)}% kodów` : 'Jeszcze brak'} tone={data.stats.coupons_used ? 'good' : 'default'} />
        </div>
      </section>

      <section aria-labelledby="adv-mode" className="flex flex-col gap-3">
        <h2 id="adv-mode" className="flex items-center gap-2.5 text-base font-black text-zinc-900"><StepNumber n={1} />Co widzą klienci?</h2>
        <div role="radiogroup" aria-labelledby="adv-mode" className="grid gap-2 sm:grid-cols-3">
          {MODES.map(({ id, label, hint, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={draft.mode === id}
              onClick={() => set({ mode: id })}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                draft.mode === id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-zinc-200 bg-white hover:border-zinc-300',
              )}
            >
              <Icon className={cn('mt-0.5 size-4 shrink-0', draft.mode === id ? 'text-primary' : 'text-zinc-500')} aria-hidden="true" />
              <span>
                <span className="block text-sm font-black text-zinc-900">{label}</span>
                <span className="block text-xs text-zinc-500">{hint}</span>
              </span>
            </button>
          ))}
        </div>
        <EconomicsNote>
          <p>
            {draft.mode === 'off'
              ? 'Kalendarz jest ukryty. Możesz spokojnie przygotować nagrody i zapisać – nikt ich nie zobaczy.'
              : draft.mode === 'teaser'
                ? `Klienci widzą zapowiedź „Od ${adventDateLabel(draft.starts_on)}”, ale nie otworzą żadnego okienka, nawet po tej dacie. W dniu startu przełącz na „Włączony”.`
                : `Okienka otwierają się codziennie od ${adventDateLabel(draft.starts_on)} do ${adventDateLabel(draft.starts_on, dayCount - 1)}. Przed tą datą klienci widzą zapowiedź.`}
          </p>
        </EconomicsNote>
      </section>

      <section aria-labelledby="adv-settings" className="flex flex-col gap-3">
        <h2 id="adv-settings" className="flex items-center gap-2.5 text-base font-black text-zinc-900"><StepNumber n={2} />Kiedy i gdzie?</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <div className="col-span-2 lg:col-span-1">
            <label htmlFor="adv-start" className={labelClass}>Pierwsze okienko</label>
            <input id="adv-start" type="date" value={draft.starts_on} onChange={(event) => set({ starts_on: event.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="adv-days" className={labelClass}>Liczba okienek</label>
            <input id="adv-days" inputMode="numeric" value={draft.days} onChange={(event) => set({ days: digits(event.target.value) })} className={inputClass} />
            <p className="mt-1 text-[11px] text-zinc-500">Od 1 do 31</p>
          </div>
          <div>
            <label htmlFor="adv-coupon" className={labelClass}>Ważność kodów (dni)</label>
            <input id="adv-coupon" inputMode="numeric" value={draft.coupon_valid_days} onChange={(event) => set({ coupon_valid_days: digits(event.target.value) })} className={inputClass} />
            <p className="mt-1 text-[11px] text-zinc-500">Ile dni klient ma na wykorzystanie</p>
          </div>
        </div>
        <div>
          <label htmlFor="adv-teaser" className={labelClass}>Tekst na stronie (opcjonalnie)</label>
          <input id="adv-teaser" value={draft.teaser_text} maxLength={200} placeholder="Zostaw puste, żeby użyć domyślnego tekstu" onChange={(event) => set({ teaser_text: event.target.value })} className={inputClass} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            ['allow_late', 'Można otworzyć zaległe okienka', 'Jeśli klient przegapi dzień, otworzy je później.'],
            ['show_home_slide', 'Slajd na stronie głównej', 'Duży baner w karuzeli na górze strony.'],
            ['show_bubble', 'Pływający przycisk', 'Mały prezent w rogu strony głównej.'],
            ['show_club_banner', 'Baner w Yummy Club', 'Tu klienci otwierają okienka.'],
          ] as const).map(([key, label, hint]) => (
            <label key={key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3">
              <input type="checkbox" checked={draft[key]} onChange={(event) => set({ [key]: event.target.checked })} className="mt-0.5 size-4 accent-primary" />
              <span>
                <span className="block text-sm font-bold text-zinc-900">{label}</span>
                <span className="block text-xs text-zinc-500">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section aria-labelledby="adv-days-list" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="adv-days-list" className="flex items-center gap-2.5 text-base font-black text-zinc-900"><StepNumber n={3} /><Gift className="size-4 text-primary" aria-hidden="true" />Co jest w okienkach?</h2>
            <p className="text-sm text-zinc-500">Klikaj okienka i ustawiaj nagrody. Jedzenie wybierasz prosto z menu. Klient widzi nagrodę dopiero po otwarciu.</p>
          </div>
          <div role="tablist" aria-label="Widok" className="inline-flex rounded-xl bg-zinc-100 p-1">
            {([['calendar', 'Kalendarz', LayoutGrid], ['list', 'Lista', List]] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold', view === id ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600')}>
                <Icon className="size-3.5" aria-hidden="true" />{label}
              </button>
            ))}
          </div>
        </div>
        {issueCount > 0 && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{issueCount === 1 ? '1 okienko wymaga' : `${issueCount} okienek wymaga`} uzupełnienia – są oznaczone wykrzyknikiem.</p>}
        {view === 'calendar' ? (
          <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <AdventCalendarBoard days={windows} selected={current} onSelect={setSelected} dateLabel={(index) => adventDateLabel(draft.starts_on, index)} issues={issues} todayIndex={todayIndex} />
            <div className="min-w-0 rounded-xl border border-zinc-200 bg-white p-3 sm:p-4">
              <p className="mb-3 text-lg font-black text-primary">Dzień {current + 1} <span className="text-sm font-semibold text-zinc-500">· {adventDateLabel(draft.starts_on, current)}</span></p>
              <AdventDayEditor key={current} index={current} day={windows[current]} dateLabel={adventDateLabel(draft.starts_on, current)} opens={data.stats.per_day?.[String(current + 1)]} products={products} categories={categories} menuLoading={menuLoading} onChange={(patch) => updateDay(current, patch)} onCopyPrevious={current > 0 ? () => copyPrevious(current) : undefined} />
            </div>
          </div>
        ) : (
          <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
            {windows.map((day, index) => (
              <fieldset key={index} className={cn('flex min-w-0 flex-col gap-2 rounded-xl border bg-white p-3', issues[index] ? 'border-amber-300' : 'border-zinc-200')}>
                <legend className="px-1 text-sm font-black text-primary">Dzień {index + 1} <span className="font-semibold text-zinc-500">· {adventDateLabel(draft.starts_on, index)}</span></legend>
                <AdventDayEditor index={index} day={day} dateLabel={adventDateLabel(draft.starts_on, index)} opens={data.stats.per_day?.[String(index + 1)]} products={products} categories={categories} menuLoading={menuLoading} onChange={(patch) => updateDay(index, patch)} onCopyPrevious={index > 0 ? () => copyPrevious(index) : undefined} />
              </fieldset>
            ))}
          </div>
        )}
      </section>

      <div className="pointer-events-none sticky bottom-3 z-10 flex justify-end">
        <button type="submit" disabled={saving} className="pointer-events-auto inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground shadow-lg shadow-primary/30 transition-opacity hover:opacity-90 disabled:opacity-60">
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Zapisz kalendarz
        </button>
      </div>
    </form>
  )
}
