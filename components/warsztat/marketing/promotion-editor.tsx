'use client'

import { useState, type FormEvent } from 'react'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MOBILE_FULLSCREEN_DIALOG, skipInitialFocusOnMobile } from '@/lib/mobile-dialog'
import { cn } from '@/lib/utils'
import { WEEKDAYS, describeReward, describeSchedule, describeScope, discountLabel, shortTime, type Promotion, type PromotionKind, type PromotionScope } from '@/lib/promotions'
import { sendPromotion, type PromotionCategory, type PromotionProduct } from '@/lib/use-workshop-promotions'
import { cleanDecimal, inputClass, labelClass } from '../menu-editor/form-styles'

export type RewardMode = 'price' | 'percent'

export type PromotionDraft = {
  id?: string
  title: string
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
  active: boolean
}

export const emptyDraft = (patch: Partial<PromotionDraft> = {}): PromotionDraft => ({
  title: '',
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
  active: false,
  ...patch,
})

export function draftFromPromotion(promotion: Promotion): PromotionDraft {
  return emptyDraft({
    id: promotion.id,
    title: promotion.title,
    description: promotion.description,
    kind: promotion.kind,
    discount_percent: promotion.discount_percent > 0 ? String(promotion.discount_percent) : '50',
    buy_quantity: String(promotion.buy_quantity),
    reward_mode: promotion.kind === 'nth_item' && promotion.reward_price === null ? 'percent' : 'price',
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
    active: promotion.active,
  })
}

const kindOptions: { id: PromotionKind; label: string; hint: string }[] = [
  { id: 'percent', label: 'Rabat procentowy', hint: 'Każdy produkt z zakresu taniej o X%.' },
  { id: 'nth_item', label: 'Kolejna sztuka taniej', hint: 'np. drugi burger za 10 zł, trzeci gratis.' },
]

const scopeOptions: { id: PromotionScope; label: string }[] = [
  { id: 'all', label: 'Całe menu' },
  { id: 'categories', label: 'Kategorie' },
  { id: 'products', label: 'Produkty' },
]

const chipClass = (selected: boolean) =>
  cn(
    'rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors',
    selected ? 'border-primary bg-primary text-primary-foreground' : 'border-[#e5ded6] bg-white text-[#5f5852] hover:border-primary/50',
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

  const isBundle = draft.kind === 'nth_item'
  const usesRewardPrice = isBundle && draft.reward_mode === 'price'
  const payload = {
    title: draft.title,
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
    online: draft.online,
    online_pickup_only: draft.online_pickup_only,
    in_store: draft.in_store,
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
          <DialogDescription>Rabat nalicza się automatycznie w terminie promocji – ale tylko wtedy, gdy bar ją włączy.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-5">
          <fieldset>
            <legend className={labelClass}>Typ promocji</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {kindOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={draft.kind === option.id}
                  onClick={() => set({ kind: option.id })}
                  className={cn('rounded-xl border p-3 text-left transition-colors', draft.kind === option.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-[#e5ded6] bg-white hover:border-primary/50')}
                >
                  <span className="block text-sm font-extrabold text-[#211e1b]">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-[#7a726a]">{option.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className={cn('grid gap-3', !isBundle && 'sm:grid-cols-[1fr_7rem]')}>
            <label>
              <span className={labelClass}>Nazwa</span>
              <input required minLength={2} maxLength={60} value={draft.title} onChange={(event) => set({ title: event.target.value })} placeholder={isBundle ? 'np. Drugi burger za 10 zł' : 'np. Burgerowa środa'} className={inputClass} />
            </label>
            {!isBundle && (
              <label>
                <span className={labelClass}>Rabat %</span>
                <input required inputMode="decimal" value={draft.discount_percent} onChange={(event) => set({ discount_percent: cleanDecimal(event.target.value) })} className={inputClass} />
              </label>
            )}
          </div>

          {isBundle && (
            <fieldset className="rounded-xl border border-[#eee8e2] bg-[#faf8f6] p-3">
              <legend className="sr-only">Zasada promocji</legend>
              <div className="flex flex-wrap items-end gap-3">
                <label>
                  <span className={labelClass}>Kup (szt.)</span>
                  <input required inputMode="numeric" value={draft.buy_quantity} onChange={(event) => set({ buy_quantity: event.target.value.replace(/\D/g, '').slice(0, 1) })} className={cn(inputClass, 'w-20')} />
                </label>
                <div>
                  <span className={labelClass}>{`${preview.buy_quantity + 1}. sztuka`}</span>
                  <div className="flex gap-1.5">
                    <button type="button" aria-pressed={draft.reward_mode === 'price'} onClick={() => set({ reward_mode: 'price' })} className={chipClass(draft.reward_mode === 'price')}>Za stałą cenę</button>
                    <button type="button" aria-pressed={draft.reward_mode === 'percent'} onClick={() => set({ reward_mode: 'percent' })} className={chipClass(draft.reward_mode === 'percent')}>Taniej o %</button>
                  </div>
                </div>
                {draft.reward_mode === 'price' ? (
                  <label>
                    <span className={labelClass}>Cena (zł, 0 = gratis)</span>
                    <input required inputMode="decimal" value={draft.reward_price} onChange={(event) => set({ reward_price: cleanDecimal(event.target.value) })} className={cn(inputClass, 'w-28')} />
                  </label>
                ) : (
                  <label>
                    <span className={labelClass}>Rabat %</span>
                    <input required inputMode="decimal" value={draft.discount_percent} onChange={(event) => set({ discount_percent: cleanDecimal(event.target.value) })} className={cn(inputClass, 'w-24')} />
                  </label>
                )}
              </div>
              <p className="mt-2 text-xs text-[#7a726a]">{describeReward(preview)}. Liczą się sztuki z zakresu poniżej – można mieszać różne produkty.</p>
            </fieldset>
          )}

          <label>
            <span className={labelClass}>Opis na stronie (opcjonalnie)</span>
            <input maxLength={200} value={draft.description} onChange={(event) => set({ description: event.target.value })} placeholder="np. Bez kodów i bez haczyków." className={inputClass} />
          </label>

          <fieldset>
            <legend className={labelClass}>Na co</legend>
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
              <div className="mt-3 flex max-h-56 flex-col gap-3 overflow-y-auto rounded-xl border border-[#eee8e2] p-3">
                {groupedProducts.map(({ category, items }) => (
                  <div key={category.id}>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#9a9189]">{category.label}</p>
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
              <details className="mt-3 rounded-xl border border-[#eee8e2] p-3" open={draft.excluded_product_ids.length > 0}>
                <summary className="cursor-pointer text-xs font-bold text-[#4f4943]">
                  {`Wyklucz produkty${draft.excluded_product_ids.length ? ` (${draft.excluded_product_ids.length})` : ''}`}
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
            <legend className={labelClass}>Kiedy</legend>
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
            <label className="mt-3 flex items-center gap-2 text-sm text-[#4f4943]">
              <input type="checkbox" checked={draft.hasDates} onChange={(event) => set({ hasDates: event.target.checked })} className="size-4 accent-primary" />
              Tylko w wybranym okresie
            </label>
            {draft.hasDates && (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <label><span className={labelClass}>Od dnia</span><input type="date" value={draft.valid_from} onChange={(event) => set({ valid_from: event.target.value })} className={inputClass} /></label>
                <label><span className={labelClass}>Do dnia</span><input type="date" value={draft.valid_to} onChange={(event) => set({ valid_to: event.target.value })} className={inputClass} /></label>
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend className={labelClass}>Gdzie działa</legend>
            <div className="flex flex-wrap gap-4 text-sm text-[#4f4943]">
              <label className="flex items-center gap-2"><input type="checkbox" checked={draft.online} onChange={(event) => set({ online: event.target.checked })} className="size-4 accent-primary" />Zamówienia online</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={draft.in_store} onChange={(event) => set({ in_store: event.target.checked })} className="size-4 accent-primary" />Na miejscu (bar)</label>
            </div>
            <div className="mt-3">
              <span className={labelClass}>Zamówienia z dostawą</span>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" aria-pressed={!draft.online_pickup_only} onClick={() => set({ online_pickup_only: false })} className={chipClass(!draft.online_pickup_only)}>Również z dostawą</button>
                <button type="button" aria-pressed={draft.online_pickup_only} onClick={() => set({ online_pickup_only: true })} className={chipClass(draft.online_pickup_only)}>Bez dostawy</button>
              </div>
              {draft.online_pickup_only && <p className="mt-1.5 text-xs text-[#8b827a]">Nie działa na dostawy – ani online, ani dodane na barze.</p>}
            </div>
            <p className="mt-1.5 text-xs text-[#8b827a]">Zamówienia z Glovo i Pyszne.pl nie są objęte promocjami.</p>
          </fieldset>

          {!draft.id && (
            <label className="flex items-center gap-2 text-sm font-semibold text-[#4f4943]">
              <input type="checkbox" checked={draft.active} onChange={(event) => set({ active: event.target.checked })} className="size-4 accent-primary" />
              Włącz od razu
            </label>
          )}

          <div className="rounded-2xl bg-[#211e1b] p-4 text-white">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">Podgląd</p>
            <p className="mt-1 text-lg font-extrabold">{draft.title || 'Nazwa promocji'} <span className="text-primary">{discountLabel(preview)}</span></p>
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
