'use client'

import { useState, type FormEvent } from 'react'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PromotionBadge } from '@/components/promotion-badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MOBILE_FULLSCREEN_DIALOG, skipInitialFocusOnMobile } from '@/lib/mobile-dialog'
import { cn } from '@/lib/utils'
import { WEEKDAYS, describeReward, describeSchedule, describeScope, discountLabel, shortTime, titleCoversLabel, type Promotion, type PromotionKind, type PromotionScope } from '@/lib/promotions'
import { sendPromotion, type PromotionCategory, type PromotionProduct } from '@/lib/use-workshop-promotions'
import { cleanDecimal, inputClass, labelClass } from '../menu-editor/form-styles'
import { StepLegend } from './help-parts'

export type RewardMode = 'price' | 'percent'

export type PromotionDraft = {
  id?: string
  title: string
  headline: string
  description: string
  kind: PromotionKind
  discount_percent: string
  buy_quantity: string
  reward_mode: RewardMode
  reward_price: string
  scope: PromotionScope
  category_ids: string[]
  product_ids: string[]
  excluded_product_ids: string[]
  days: number[]
  allDay: boolean
  start_time: string
  end_time: string
  hasDates: boolean
  valid_from: string
  valid_to: string
  online: boolean
  online_pickup_only: boolean
  in_store: boolean
  members_only: boolean
  active: boolean
}

export const emptyDraft = (patch: Partial<PromotionDraft> = {}): PromotionDraft => ({
  title: '',
  headline: '',
  description: '',
  kind: 'percent',
  discount_percent: '20',
  buy_quantity: '1',
  reward_mode: 'price',
  reward_price: '10',
  scope: 'all',
  category_ids: [],
  product_ids: [],
  excluded_product_ids: [],
  days: [],
  allDay: true,
  start_time: '12:00',
  end_time: '16:00',
  hasDates: false,
  valid_from: '',
  valid_to: '',
  online: true,
  online_pickup_only: false,
  in_store: true,
  members_only: false,
  active: false,
  ...patch,
})

export function draftFromPromotion(promotion: Promotion): PromotionDraft {
  return emptyDraft({
    id: promotion.id,
    title: promotion.title,
    headline: promotion.headline ?? '',
    description: promotion.description,
    kind: promotion.kind,
    discount_percent: promotion.discount_percent > 0 ? String(promotion.discount_percent) : '50',
    buy_quantity: String(promotion.buy_quantity),
    reward_mode: promotion.kind !== 'percent' && promotion.reward_price === null ? 'percent' : 'price',
    reward_price: promotion.reward_price === null ? '10' : String(promotion.reward_price),
    scope: promotion.scope,
    category_ids: promotion.category_ids,
    product_ids: promotion.product_ids,
    excluded_product_ids: promotion.excluded_product_ids,
    days: promotion.days,
    allDay: !promotion.start_time && !promotion.end_time,
    start_time: shortTime(promotion.start_time) || '12:00',
    end_time: shortTime(promotion.end_time) || '16:00',
    hasDates: Boolean(promotion.valid_from || promotion.valid_to),
    valid_from: promotion.valid_from ?? '',
    valid_to: promotion.valid_to ?? '',
    online: promotion.online,
    online_pickup_only: promotion.online_pickup_only,
    in_store: promotion.in_store,
    members_only: promotion.members_only,
    active: promotion.active,
  })
}

const kindOptions: { id: PromotionKind; label: string; hint: string }[] = [
  { id: 'percent', label: 'Taniej o %', hint: 'np. całe menu 20% taniej w każdą środę.' },
  { id: 'nth_item', label: 'Kolejna sztuka taniej', hint: 'np. kup burgera – drugi za 10 zł albo gratis.' },
  { id: 'next_order', label: 'Nagroda za kolejne zamówienie', hint: 'np. frytki gratis przy 2. zamówieniu ze strony.' },
]

const scopeOptions: { id: PromotionScope; label: string }[] = [
  { id: 'all', label: 'Całe menu' },
  { id: 'categories', label: 'Wybrane kategorie' },
  { id: 'products', label: 'Wybrane produkty' },
]

const chipClass = (selected: boolean) =>
  cn(
    'rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors',
    selected ? 'border-primary bg-primary text-primary-foreground' : 'border-zinc-200 bg-white text-zinc-600 hover:border-primary/50',
  )

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value])

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: PromotionDraft
  categories: PromotionCategory[]
  products: PromotionProduct[]
}

export function PromotionEditor({ open, onOpenChange, initial, categories, products }: Props) {
  const [draft, setDraft] = useState(initial)
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<PromotionDraft>) => setDraft((current) => ({ ...current, ...patch }))

  const isNextOrder = draft.kind === 'next_order'
  const isBundle = draft.kind === 'nth_item' || isNextOrder
  const usesRewardPrice = isBundle && draft.reward_mode === 'price'
  const payload = {
    title: draft.title,
    headline: draft.headline,
    description: draft.description,
    kind: draft.kind,
    discount_percent: usesRewardPrice ? '0' : draft.discount_percent,
    buy_quantity: isBundle ? draft.buy_quantity : '1',
    reward_price: usesRewardPrice ? draft.reward_price : null,
    scope: draft.scope,
    category_ids: draft.category_ids,
    product_ids: draft.product_ids,
    excluded_product_ids: draft.scope === 'products' ? [] : draft.excluded_product_ids,
    days: draft.days,
    start_time: draft.allDay ? null : draft.start_time,
    end_time: draft.allDay ? null : draft.end_time,
    valid_from: draft.hasDates ? draft.valid_from || null : null,
    valid_to: draft.hasDates ? draft.valid_to || null : null,
    online: isNextOrder ? true : draft.online,
    online_pickup_only: draft.online_pickup_only,
    in_store: isNextOrder ? false : draft.in_store,
    members_only: isNextOrder ? true : draft.members_only,
  }
  const toNumber = (value: string) => {
    const parsed = Number(cleanDecimal(value).replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : 0
  }
  const categoryNames = new Map(categories.map((category) => [category.id, category.label]))
  const productNames = new Map(products.map((product) => [product.id, product.name]))
  const preview = {
    ...payload,
    discount_percent: usesRewardPrice ? 0 : toNumber(draft.discount_percent),
    buy_quantity: Math.max(1, Math.floor(toNumber(payload.buy_quantity))),
    reward_price: usesRewardPrice ? toNumber(draft.reward_price) : null,
  }
  const scopedProducts = products.filter((product) => draft.scope === 'all' || (product.category_id !== null && draft.category_ids.includes(product.category_id)))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      if (draft.id) await sendPromotion('PATCH', { id: draft.id, ...payload })
      else await sendPromotion('POST', { ...payload, active: draft.active })
      toast.success(draft.id ? 'Zapisano promocję' : 'Dodano promocję')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się zapisać promocji.')
    } finally {
      setSaving(false)
    }
  }

  const groupedProducts = categories
    .map((category) => ({ category, items: products.filter((product) => product.category_id === category.id) }))
    .filter((group) => group.items.length)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent initialFocus={skipInitialFocusOnMobile} className={cn('max-h-[92dvh] content-start overflow-y-auto overscroll-contain sm:max-w-xl', MOBILE_FULLSCREEN_DIALOG)}>
        <DialogHeader>
          <DialogTitle className="text-lg font-extrabold">{draft.id ? 'Edytuj promocję' : 'Nowa promocja'}</DialogTitle>
          <DialogDescription>Przejdź po kolei przez 5 kroków. Na dole zobaczysz, jak promocja będzie wyglądać dla klientów.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-6">
          <fieldset>
            <StepLegend n={1} title="Jaki rodzaj promocji?" />
            <div className="grid gap-2 sm:grid-cols-3">
              {kindOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={draft.kind === option.id}
                  onClick={() => set(option.id === 'next_order' && draft.kind !== 'next_order' && !draft.id ? { kind: option.id, reward_mode: 'price', reward_price: '0', scope: 'products' } : { kind: option.id })}
                  className={cn('rounded-xl border p-3 text-left transition-colors', draft.kind === option.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-zinc-200 bg-white hover:border-primary/50')}
                >
                  <span className="block text-sm font-extrabold text-zinc-900">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">{option.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
          <StepLegend n={2} title="Nazwa i wysokość rabatu" />
          <div className={cn('grid gap-3', !isBundle && 'sm:grid-cols-[1fr_9rem]')}>
            <label>
              <span className={labelClass}>Nazwa promocji (widzą ją klienci)</span>
              <input required minLength={2} maxLength={60} value={draft.title} onChange={(event) => set({ title: event.target.value })} placeholder={isNextOrder ? 'np. Wracasz? Frytki od nas' : isBundle ? 'np. Drugi burger za 10 zł' : 'np. Burgerowa środa'} className={inputClass} />
            </label>
            {!isBundle && (
              <label>
                <span className={labelClass}>O ile % taniej?</span>
                <input required inputMode="decimal" value={draft.discount_percent} onChange={(event) => set({ discount_percent: cleanDecimal(event.target.value) })} className={inputClass} />
              </label>
            )}
          </div>

          {isBundle && (
            <fieldset className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <legend className="sr-only">Zasada promocji</legend>
              <div className="flex flex-col gap-3">
                {isNextOrder ? (
                  <label className="block">
                    <span className={labelClass}>Nagroda przy zamówieniu nr</span>
                    <input
                      required
                      inputMode="numeric"
                      value={String(Math.max(1, Number(draft.buy_quantity) || 1) + 1)}
                      onChange={(event) => {
                        const nth = Number(event.target.value.replace(/\D/g, '').slice(0, 2))
                        set({ buy_quantity: String(Math.min(9, Math.max(1, (nth || 2) - 1))) })
                      }}
                      className={cn(inputClass, 'w-20')}
                    />
                  </label>
                ) : (
                  <label className="block">
                    <span className={labelClass}>Klient kupuje w normalnej cenie (szt.)</span>
                    <input required inputMode="numeric" value={draft.buy_quantity} onChange={(event) => set({ buy_quantity: event.target.value.replace(/\D/g, '').slice(0, 1) })} className={cn(inputClass, 'w-20')} />
                  </label>
                )}
                <div>
                  <span className={labelClass}>{isNextOrder ? 'Nagroda (1 szt. z kroku 3) jest' : `A ${preview.buy_quantity + 1}. sztuka jest`}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex gap-1.5">
                      <button type="button" aria-pressed={draft.reward_mode === 'price'} onClick={() => set({ reward_mode: 'price' })} className={chipClass(draft.reward_mode === 'price')}>Za stałą cenę</button>
                      <button type="button" aria-pressed={draft.reward_mode === 'percent'} onClick={() => set({ reward_mode: 'percent' })} className={chipClass(draft.reward_mode === 'percent')}>Taniej o %</button>
                    </div>
                    {draft.reward_mode === 'price' ? (
                      <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
                        <span className="sr-only">Cena w zł (0 = gratis)</span>
                        <input required inputMode="decimal" value={draft.reward_price} onChange={(event) => set({ reward_price: cleanDecimal(event.target.value) })} className={cn(inputClass, 'w-24')} />
                        <span aria-hidden="true">zł</span>
                      </label>
                    ) : (
                      <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
                        <span className="sr-only">O ile % taniej?</span>
                        <input required inputMode="decimal" value={draft.discount_percent} onChange={(event) => set({ discount_percent: cleanDecimal(event.target.value) })} className={cn(inputClass, 'w-24')} />
                        <span aria-hidden="true">%</span>
                      </label>
                    )}
                  </div>
                  {draft.reward_mode === 'price' && <p className="mt-1.5 text-xs text-zinc-500">Wpisz 0, żeby nagroda była gratis.</p>}
                </div>
              </div>
              <p className="mt-2 text-xs text-zinc-500">W skrócie: {describeReward(preview).toLowerCase()}. {isNextOrder ? 'Liczymy zamówienia ze strony po koncie lub numerze telefonu – nagroda raz, na najtańszą pasującą pozycję w koszyku. Działa tylko online.' : 'Można mieszać różne produkty z kroku 3.'}</p>
            </fieldset>
          )}

          <label>
            <span className={labelClass}>Duże hasło na stronie głównej (nieobowiązkowe)</span>
            <input maxLength={60} value={draft.headline} onChange={(event) => set({ headline: event.target.value })} placeholder={isNextOrder ? 'np. Frytki dorzucamy GRATIS!' : 'np. Burgery taniej o 20%!'} className={inputClass} />
            <span className="mt-1 block text-[11px] text-zinc-500">Pokazujemy je pod nazwą, dużą czerwoną czcionką. Puste = automatyczny dopisek, np. „{discountLabel(preview)}”.</span>
          </label>

          <label>
            <span className={labelClass}>Opis dla klientów (nieobowiązkowe)</span>
            <textarea rows={3} maxLength={200} value={draft.description} onChange={(event) => set({ description: event.target.value })} placeholder={isNextOrder ? 'np. Zamów ponownie przez naszą stronę i zgarnij porcję frytek na nasz koszt.' : 'np. Bez kodów i bez haczyków.'} className={cn(inputClass, 'h-auto resize-none py-2')} />
            <span className="mt-1 block text-[11px] text-zinc-500">{draft.description.length}/200</span>
          </label>
          </fieldset>

          <fieldset>
            <StepLegend n={3} title={isNextOrder ? 'Co klient dostaje w nagrodę?' : 'Na co jest promocja?'} hint={isNextOrder ? 'Wybierz produkt – musi być w koszyku, wtedy jego cena spada. Najlepiej jeden, np. frytki cienkie.' : draft.scope === 'categories' ? 'Kliknij kategorie, które mają być taniej.' : draft.scope === 'products' ? 'Kliknij produkty, które mają być taniej.' : undefined} />
            <div className="flex flex-wrap gap-2">
              {scopeOptions.map((option) => (
                <button key={option.id} type="button" aria-pressed={draft.scope === option.id} onClick={() => set({ scope: option.id })} className={chipClass(draft.scope === option.id)}>{option.label}</button>
              ))}
            </div>
            {draft.scope === 'categories' && (
              <div className="mt-3 flex flex-wrap gap-2">
                {categories.map((category) => (
                  <button key={category.id} type="button" aria-pressed={draft.category_ids.includes(category.id)} onClick={() => set({ category_ids: toggle(draft.category_ids, category.id) })} className={chipClass(draft.category_ids.includes(category.id))}>{category.label}</button>
                ))}
              </div>
            )}
            {draft.scope === 'products' && (
              <div className="mt-3 flex max-h-56 flex-col gap-3 overflow-y-auto rounded-xl border border-zinc-200 p-3">
                {groupedProducts.map(({ category, items }) => (
                  <div key={category.id}>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-400">{category.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {items.map((product) => (
                        <button key={product.id} type="button" aria-pressed={draft.product_ids.includes(product.id)} onClick={() => set({ product_ids: toggle(draft.product_ids, product.id) })} className={chipClass(draft.product_ids.includes(product.id))}>{product.name}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {draft.scope !== 'products' && scopedProducts.length > 0 && (
              <details className="mt-3 rounded-xl border border-zinc-200 p-3" open={draft.excluded_product_ids.length > 0}>
                <summary className="cursor-pointer text-xs font-bold text-zinc-700">
                  {`Pomiń niektóre produkty – nie będą taniej${draft.excluded_product_ids.length ? ` (${draft.excluded_product_ids.length})` : ''}`}
                </summary>
                <div className="mt-2 flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                  {scopedProducts.map((product) => {
                    const selected = draft.excluded_product_ids.includes(product.id)
                    return (
                      <button key={product.id} type="button" aria-pressed={selected} onClick={() => set({ excluded_product_ids: toggle(draft.excluded_product_ids, product.id) })} className={cn(chipClass(false), selected && 'border-red-300 bg-red-50 text-red-700 line-through')}>{product.name}</button>
                    )
                  })}
                </div>
              </details>
            )}
          </fieldset>

          <fieldset>
            <StepLegend n={4} title="Kiedy działa?" hint="Wybierz „Codziennie” albo kliknij konkretne dni tygodnia." />
            <div className="flex flex-wrap gap-1.5">
              <button type="button" aria-pressed={!draft.days.length} onClick={() => set({ days: [] })} className={chipClass(!draft.days.length)}>Codziennie</button>
              {WEEKDAYS.map((weekday) => (
                <button key={weekday.day} type="button" aria-pressed={draft.days.includes(weekday.day)} aria-label={weekday.long} onClick={() => set({ days: toggle(draft.days, weekday.day).sort() })} className={cn(chipClass(draft.days.includes(weekday.day)), 'min-w-10')}>{weekday.short}</button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" aria-pressed={draft.allDay} onClick={() => set({ allDay: true })} className={chipClass(draft.allDay)}>Cały dzień</button>
              <button type="button" aria-pressed={!draft.allDay} onClick={() => set({ allDay: false })} className={chipClass(!draft.allDay)}>W godzinach</button>
              {!draft.allDay && (
                <span className="flex items-center gap-2">
                  <label className="sr-only" htmlFor="promo-start">Od</label>
                  <input id="promo-start" type="time" required value={draft.start_time} onChange={(event) => set({ start_time: event.target.value })} className={cn(inputClass, 'w-28')} />
                  <span aria-hidden="true">–</span>
                  <label className="sr-only" htmlFor="promo-end">Do</label>
                  <input id="promo-end" type="time" required value={draft.end_time} onChange={(event) => set({ end_time: event.target.value })} className={cn(inputClass, 'w-28')} />
                </span>
              )}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-zinc-700">
              <Checkbox checked={draft.hasDates} onCheckedChange={(checked) => set({ hasDates: checked })} className="size-5 rounded-md border-zinc-300 bg-white" />
              Tylko między konkretnymi datami (np. na wakacje)
            </label>
            {draft.hasDates && (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <label><span className={labelClass}>Od dnia</span><input type="date" value={draft.valid_from} onChange={(event) => set({ valid_from: event.target.value })} className={inputClass} /></label>
                <label><span className={labelClass}>Do dnia</span><input type="date" value={draft.valid_to} onChange={(event) => set({ valid_to: event.target.value })} className={inputClass} /></label>
              </div>
            )}
          </fieldset>

          <fieldset>
            <StepLegend n={5} title="Gdzie działa?" hint="Zaznacz, gdzie klient dostaje niższą cenę." />
            <div className="flex flex-wrap gap-4 text-sm text-zinc-700">
              {isNextOrder ? (
                <p>Tylko zamówienia przez stronę.</p>
              ) : (
                <>
                  <label className="flex items-center gap-2"><Checkbox checked={draft.online} onCheckedChange={(checked) => set({ online: checked })} className="size-5 rounded-md border-zinc-300 bg-white" />Zamówienia przez stronę</label>
                  <label className="flex items-center gap-2"><Checkbox checked={draft.in_store} onCheckedChange={(checked) => set({ in_store: checked })} className="size-5 rounded-md border-zinc-300 bg-white" />Na miejscu (przy barze)</label>
                </>
              )}
            </div>
            <div className="mt-3">
              <span className={labelClass}>Czy także przy dostawie do domu?</span>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" aria-pressed={!draft.online_pickup_only} onClick={() => set({ online_pickup_only: false })} className={chipClass(!draft.online_pickup_only)}>Tak, również z dostawą</button>
                <button type="button" aria-pressed={draft.online_pickup_only} onClick={() => set({ online_pickup_only: true })} className={chipClass(draft.online_pickup_only)}>Nie, bez dostawy</button>
              </div>
              {draft.online_pickup_only && <p className="mt-1.5 text-xs text-zinc-500">Przy dostawie promocja nie zadziała – ani online, ani gdy dostawę dodaje bar.</p>}
            </div>
            {!isNextOrder && (
              <div className="mt-3">
                <span className={labelClass}>Dla kogo?</span>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" aria-pressed={!draft.members_only} onClick={() => set({ members_only: false })} className={chipClass(!draft.members_only)}>Dla wszystkich</button>
                  <button type="button" aria-pressed={draft.members_only} onClick={() => set({ members_only: true })} className={chipClass(draft.members_only)}>Tylko Yummy Club</button>
                </div>
                {draft.members_only && <p className="mt-1.5 text-xs text-zinc-500">Online działa po zalogowaniu, przy barze – po wskazaniu klienta klubu.</p>}
              </div>
            )}
            <p className="mt-1.5 text-xs text-zinc-500">Zamówienia z Glovo i Pyszne.pl nigdy nie mają promocji.</p>
          </fieldset>

          {!draft.id && (
            <label className="flex items-start gap-2 text-sm font-semibold text-zinc-700">
              <Checkbox checked={draft.active} onCheckedChange={(checked) => set({ active: checked })} className="mt-0.5 size-5 rounded-md border-zinc-300 bg-white" />
              <span>Włącz od razu po zapisaniu<span className="block text-xs font-normal text-zinc-500">Jeśli nie zaznaczysz, włączysz ją później przełącznikiem na liście.</span></span>
            </label>
          )}

          <div className="rounded-xl bg-zinc-900 p-3 sm:p-4 text-white">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">Tak zobaczą to klienci</p>
            <div className="mt-2 flex items-center gap-3">
              <PromotionBadge promotion={preview} className="size-14" />
              <p className="min-w-0 text-lg font-extrabold leading-tight">{draft.title || 'Nazwa promocji'}</p>
            </div>
            {draft.headline.trim()
              ? <p className="text-xl font-black italic leading-tight text-primary">{draft.headline}</p>
              : !titleCoversLabel(preview) && <p className="text-lg font-extrabold text-primary">{discountLabel(preview)}</p>}
            {draft.description && <p className="mt-1 text-sm text-white/90">{draft.description}</p>}
            {!draft.headline.trim() && titleCoversLabel(preview) && <p className="mt-1 text-xs text-amber-300">Nazwa powtarza już nagrodę, więc ukrywamy dopisek „{discountLabel(preview)}”. Lepiej brzmi coś krótszego, np. „Wracasz? Frytki od nas”.</p>}
            <p className="text-sm text-white/70">{describeSchedule(preview)} · {describeScope(preview, { categories: categoryNames, products: productNames })}</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
            <Button type="submit" disabled={saving}>{saving && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}{draft.id ? 'Zapisz' : 'Dodaj promocję'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
