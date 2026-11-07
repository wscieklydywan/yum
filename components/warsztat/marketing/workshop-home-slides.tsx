'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ArrowDown, ArrowUp, Crown, Eye, EyeOff, LayoutTemplate, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { HOME_SLIDE_LABELS, HOME_SLIDES_PUBLIC_KEY, type HomeSlideId, type HomeSlidesSettings } from '@/lib/home-slides'
import { useWorkshopPromotions } from '@/lib/use-workshop-promotions'
import { TabIntro } from './help-parts'
import { mutate as globalMutate } from 'swr'

const KEY = '/api/workshop/home-slides'

async function fetchSettings(url: string): Promise<HomeSlidesSettings> {
  const response = await fetch(url, { cache: 'no-store' })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error ?? 'Nie udało się wczytać ustawień.')
  return body
}

const SLIDE_HINTS: Record<HomeSlideId, string> = {
  burgers: 'Stały slajd z burgerami Yummy.',
  burger_week: 'Żółty slajd z wybranym burgerem.',
  advent: 'Pokazuje się tylko, gdy kalendarz jest aktywny.',
  halloween: 'Pokazuje się tylko w okresie gry Halloween.',
}

export function WorkshopHomeSlides() {
  const { data, error, isLoading, mutate } = useSWR(KEY, fetchSettings, { revalidateOnFocus: false })
  if (error) return <p className="rounded-xl bg-red-50 p-3 sm:p-4 text-sm text-red-700">{error.message}</p>
  if (isLoading || !data) {
    return (
      <p className="flex items-center gap-2 text-sm text-zinc-600">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Wczytywanie…
      </p>
    )
  }
  return <Editor key={JSON.stringify(data)} initial={data} onSaved={(next) => mutate(next, { revalidate: false })} />
}

function Editor({ initial, onSaved }: { initial: HomeSlidesSettings; onSaved: (next: HomeSlidesSettings) => void }) {
  const [draft, setDraft] = useState(initial)
  const [saving, setSaving] = useState(false)
  const { data: menu } = useWorkshopPromotions()
  const products = menu?.products ?? []
  const week = draft.burger_week
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)

  const move = (index: number, delta: number) => {
    const order = [...draft.order]
    const target = index + delta
    if (target < 0 || target >= order.length) return
    ;[order[index], order[target]] = [order[target], order[index]]
    setDraft({ ...draft, order })
  }
  const toggleHidden = (id: HomeSlideId) =>
    setDraft({ ...draft, hidden: draft.hidden.includes(id) ? draft.hidden.filter((item) => item !== id) : [...draft.hidden, id] })
  const setWeek = (patch: Partial<HomeSlidesSettings['burger_week']>) => setDraft({ ...draft, burger_week: { ...week, ...patch } })

  async function save() {
    setSaving(true)
    try {
      const response = await fetch(KEY, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? 'Nie udało się zapisać.')
      onSaved(body)
      void globalMutate(HOME_SLIDES_PUBLIC_KEY)
      toast.success('Zapisano slider na stronie głównej')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Nie udało się zapisać.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <TabIntro
        icon={LayoutTemplate}
        title="Slider na stronie głównej"
        lead="Ustal, które wyróżnione slajdy widzą klienci w hero strony głównej i w jakiej kolejności."
        steps={[
          'Strzałkami ustaw kolejność slajdów.',
          'Okiem ukryj slajd, którego nie chcesz pokazywać.',
          'Wybierz burgera tygodnia, włącz go i zapisz.',
        ]}
      />

      <section aria-labelledby="slides-order" className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-4">
        <h3 id="slides-order" className="text-sm font-extrabold text-zinc-900">Kolejność slajdów</h3>
        <ol className="mt-3 flex flex-col gap-2">
          {draft.order.map((id, index) => {
            const hidden = draft.hidden.includes(id)
            return (
              <li
                key={id}
                className={cn('flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2.5 sm:gap-3 sm:px-3', hidden ? 'border-dashed border-zinc-300 bg-zinc-50 opacity-60' : 'border-zinc-200', id === 'burger_week' && !hidden && 'border-[#f6c234] bg-[#fff8dc]')}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-1.5 text-sm font-bold leading-tight text-zinc-900">
                    {id === 'burger_week' && <Crown className="size-3.5 text-[#c48a00]" aria-hidden="true" />}
                    {HOME_SLIDE_LABELS[id]}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{SLIDE_HINTS[id]}</p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                  <Button type="button" size="icon" variant="ghost" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Przesuń wyżej: ${HOME_SLIDE_LABELS[id]}`}>
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" disabled={index === draft.order.length - 1} onClick={() => move(index, 1)} aria-label={`Przesuń niżej: ${HOME_SLIDE_LABELS[id]}`}>
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => toggleHidden(id)} aria-pressed={hidden} aria-label={hidden ? `Pokaż: ${HOME_SLIDE_LABELS[id]}` : `Ukryj: ${HOME_SLIDE_LABELS[id]}`}>
                    {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      <section aria-labelledby="burger-week" className="rounded-xl border border-[#f6c234] bg-[#fffbea] p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="burger-week" className="flex items-center gap-2 text-sm font-extrabold text-zinc-900">
            <Crown className="size-4 text-[#c48a00]" aria-hidden="true" /> Burger tygodnia
          </h3>
          <label className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <Checkbox checked={week.enabled} onCheckedChange={(value) => setWeek({ enabled: value === true })} />
            Pokazuj na stronie głównej
          </label>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-zinc-700 sm:col-span-2">
            Produkt
            <select
              value={week.product_id ?? ''}
              onChange={(event) => setWeek({ product_id: event.target.value || null })}
              className="h-10 w-full min-w-0 max-w-full truncate rounded-md border border-input bg-white px-3 text-sm font-normal"
            >
              <option value="">— wybierz burgera —</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-zinc-700">
            Nagłówek plakietki
            <Input value={week.title} maxLength={40} onChange={(event) => setWeek({ title: event.target.value })} className="bg-white" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-zinc-700">
            Pokazuj do (opcjonalnie)
            <Input type="date" value={week.until ?? ''} onChange={(event) => setWeek({ until: event.target.value || null })} className="block w-full min-w-0 appearance-none bg-white" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-zinc-700 sm:col-span-2">
            Opis (puste = opis z menu)
            <textarea
              value={week.text}
              maxLength={200}
              rows={2}
              onChange={(event) => setWeek({ text: event.target.value })}
              className="w-full min-w-0 rounded-md border border-input bg-white px-3 py-2 text-sm font-normal"
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-zinc-500">Po dacie końca slajd znika sam. Cena i zdjęcie pochodzą z menu.</p>
      </section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={!dirty || saving} onClick={() => setDraft(initial)}>Cofnij zmiany</Button>
        <Button type="button" disabled={!dirty || saving} onClick={() => void save()}>
          {saving && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          Zapisz
        </Button>
      </div>
    </div>
  )
}
