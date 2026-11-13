'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Copy, Minus, Plus, Search, Trash2, UtensilsCrossed } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ADVENT_COLORS, type AdventColor, type AdventKind } from '@/lib/advent'
import type { StaffProduct } from '@/lib/use-menu'
import type { MenuCategory } from '@/lib/menu'
import { inputClass, labelClass } from '../menu-editor/form-styles'

export type DayItemDraft = { product_id: string | null; name: string; quantity: number }

export type DayDraft = {
  kind: AdventKind
  title: string
  description: string
  stars: string
  items: DayItemDraft[]
  discount_type: 'percent' | 'amount'
  discount_value: string
  color: AdventColor
}

export const TILE_SWATCH: Record<AdventColor, string> = {
  red: 'bg-[linear-gradient(180deg,#d6322c,#8e1410)]',
  green: 'bg-[linear-gradient(180deg,#2f9a62,#105033)]',
  gold: 'bg-[linear-gradient(180deg,#ffe08a,#d49a2a)]',
}

export const ADVENT_KINDS: { id: AdventKind; label: string }[] = [
  { id: 'stars', label: 'Stars' },
  { id: 'food', label: 'Jedzenie (kod)' },
  { id: 'discount', label: 'Rabat (kod)' },
  { id: 'none', label: 'Tylko życzenia' },
]

const digits = (value: string) => value.replace(/\D/g, '')

/** Krótki opis problemu z dniem (do podświetlenia w kalendarzu) albo null, gdy dzień jest gotowy. */
export function dayIssue(day: DayDraft, productIds: Set<string>): string | null {
  if (!day.title.trim()) return 'Brak nazwy nagrody'
  if (day.kind === 'stars' && !(Number(day.stars) >= 1)) return 'Podaj liczbę Stars'
  if (day.kind === 'discount' && !(Number(day.discount_value.replace(',', '.')) > 0)) return 'Podaj wartość rabatu'
  if (day.kind === 'food') {
    if (day.items.length === 0) return 'Wybierz pozycję z menu'
    if (day.items.some((item) => !item.product_id || !productIds.has(item.product_id))) return 'Pozycja spoza menu'
  }
  return null
}

export function suggestedTitle(day: DayDraft) {
  if (day.kind === 'stars') return `${Number(day.stars) || 0} Stars na start dnia`
  if (day.kind === 'discount') return `${day.discount_value || 0}${day.discount_type === 'percent' ? '%' : ' zł'} rabatu na zamówienie`
  if (day.kind === 'food' && day.items.length) return `${day.items.map((item) => (item.quantity > 1 ? `${item.quantity}x ${item.name}` : item.name)).join(' + ')} gratis`
  return ''
}

function MenuPicker({ products, categories, onPick }: { products: StaffProduct[]; categories: MenuCategory[]; onPick: (product: StaffProduct) => void }) {
  const [query, setQuery] = useState('')
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const labels = new Map(categories.map((category) => [category.id, category.label]))
    const order = new Map(categories.map((category, index) => [category.id, index]))
    const byCategory = new Map<string, StaffProduct[]>()
    for (const product of products) {
      if (needle && !product.name.toLowerCase().includes(needle)) continue
      const list = byCategory.get(product.category) ?? []
      list.push(product)
      byCategory.set(product.category, list)
    }
    return [...byCategory.entries()]
      .sort(([a], [b]) => (order.get(a) ?? 999) - (order.get(b) ?? 999))
      .map(([id, list]) => ({ id, label: labels.get(id) ?? id, products: list }))
  }, [products, categories, query])

  return (
    <div className="min-w-0 rounded-xl border border-zinc-200 bg-zinc-50 p-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
        <input type="search" aria-label="Szukaj w menu" placeholder="Szukaj w menu…" value={query} onChange={(event) => setQuery(event.target.value)} className={cn(inputClass, 'pl-8')} />
      </div>
      <div className="mt-2 max-h-56 overflow-y-auto overscroll-contain pr-1">
        {groups.length === 0 && <p className="p-3 text-center text-xs text-zinc-500">Brak pozycji pasujących do wyszukiwania.</p>}
        {groups.map((group) => (
          <div key={group.id} className="mb-2 last:mb-0">
            <p className="sticky top-0 bg-zinc-50 px-1 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">{group.label}</p>
            <ul className="flex flex-col gap-0.5">
              {group.products.map((product) => (
                <li key={product.id}>
                  <button type="button" onClick={() => onPick(product)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-zinc-900 hover:bg-white">
                    <span className="min-w-0 truncate font-semibold">{product.name}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-zinc-500">
                      {product.disabled && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">niedostępne</span>}
                      {product.price.toFixed(2).replace('.', ',')} zł
                      <Plus className="size-3.5 text-primary" aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdventDayEditor({
  index,
  day,
  dateLabel,
  opens,
  products,
  categories,
  menuLoading,
  onChange,
  onCopyPrevious,
}: {
  index: number
  day: DayDraft
  dateLabel: string
  opens?: number
  products: StaffProduct[]
  categories: MenuCategory[]
  menuLoading: boolean
  onChange: (patch: Partial<DayDraft>) => void
  onCopyPrevious?: () => void
}) {
  const [picking, setPicking] = useState(false)
  const productIds = useMemo(() => new Set(products.map((product) => product.id)), [products])
  const id = (name: string) => `adv-${name}-${index}`
  const suggestion = suggestedTitle(day)

  function addProduct(product: StaffProduct) {
    const existing = day.items.find((item) => item.product_id === product.id)
    const items = existing
      ? day.items.map((item) => (item.product_id === product.id ? { ...item, quantity: Math.min(10, item.quantity + 1) } : item))
      : [...day.items, { product_id: product.id, name: product.name, quantity: 1 }].slice(0, 10)
    onChange({ items })
    setPicking(false)
  }

  const setQuantity = (itemIndex: number, quantity: number) =>
    onChange({ items: day.items.map((item, i) => (i === itemIndex ? { ...item, quantity: Math.min(10, Math.max(1, quantity)) } : item)) })
  const removeItem = (itemIndex: number) => onChange({ items: day.items.filter((_, i) => i !== itemIndex) })

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1">
        {ADVENT_KINDS.map((kind) => (
          <button
            key={kind.id}
            type="button"
            aria-pressed={day.kind === kind.id}
            onClick={() => onChange({ kind: kind.id })}
            className={cn('rounded-lg px-2.5 py-1 text-xs font-bold transition-colors', day.kind === kind.id ? 'bg-primary text-primary-foreground' : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900')}
          >
            {kind.label}
          </button>
        ))}
        {onCopyPrevious && (
          <button type="button" onClick={onCopyPrevious} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-primary hover:bg-primary/10">
            <Copy className="size-3.5" aria-hidden="true" />Jak dzień wcześniej
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span id={id('color')} className="text-xs font-bold text-zinc-600">Kolor kafelka</span>
        <div role="radiogroup" aria-labelledby={id('color')} className="flex items-center gap-1.5">
          {ADVENT_COLORS.map((color) => (
            <button
              key={color.id}
              type="button"
              role="radio"
              aria-checked={day.color === color.id}
              onClick={() => onChange({ color: color.id })}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border py-1 pl-1 pr-2.5 text-xs font-bold transition-colors',
                day.color === color.id ? 'border-primary bg-primary/5 text-zinc-900 ring-2 ring-primary/20' : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300',
              )}
            >
              <span className={cn('size-5 rounded-md shadow-inner', TILE_SWATCH[color.id])} aria-hidden="true" />
              {color.label}
            </button>
          ))}
        </div>
      </div>

      {day.kind === 'food' && (
        <div className="flex flex-col gap-2">
          <p className={labelClass}>Pozycje z menu</p>
          {day.items.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {day.items.map((item, itemIndex) => {
                const missing = !item.product_id || !productIds.has(item.product_id)
                return (
                  <li key={`${item.product_id ?? item.name}-${itemIndex}`} className={cn('flex items-center gap-2 rounded-xl border px-2.5 py-1.5', missing && !menuLoading ? 'border-amber-300 bg-amber-50' : 'border-zinc-200 bg-white')}>
                    {missing && !menuLoading ? <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-hidden="true" /> : <UtensilsCrossed className="size-4 shrink-0 text-primary" aria-hidden="true" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-zinc-900">{item.name}</span>
                      {missing && !menuLoading && <span className="block text-[11px] font-semibold text-amber-700">Nie ma tego w menu – usuń i wybierz z listy</span>}
                    </span>
                    <span className="flex items-center gap-1">
                      <button type="button" aria-label={`Mniej: ${item.name}`} disabled={item.quantity <= 1} onClick={() => setQuantity(itemIndex, item.quantity - 1)} className="grid size-7 place-items-center rounded-lg bg-zinc-100 text-zinc-600 disabled:opacity-40"><Minus className="size-3.5" aria-hidden="true" /></button>
                      <span className="w-6 text-center text-sm font-black tabular-nums" aria-label={`Ilość: ${item.quantity}`}>{item.quantity}</span>
                      <button type="button" aria-label={`Więcej: ${item.name}`} disabled={item.quantity >= 10} onClick={() => setQuantity(itemIndex, item.quantity + 1)} className="grid size-7 place-items-center rounded-lg bg-zinc-100 text-zinc-600 disabled:opacity-40"><Plus className="size-3.5" aria-hidden="true" /></button>
                      <button type="button" aria-label={`Usuń ${item.name}`} onClick={() => removeItem(itemIndex)} className="grid size-7 place-items-center rounded-lg text-zinc-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-3.5" aria-hidden="true" /></button>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          {picking || day.items.length === 0 ? (
            menuLoading ? <p className="text-xs text-zinc-500">Wczytywanie menu…</p> : <MenuPicker products={products} categories={categories} onPick={addProduct} />
          ) : (
            day.items.length < 10 && (
              <button type="button" onClick={() => setPicking(true)} className="inline-flex items-center gap-1.5 self-start rounded-lg border border-dashed border-primary/50 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/5">
                <Plus className="size-3.5" aria-hidden="true" />Dodaj pozycję z menu
              </button>
            )
          )}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <div className={day.kind === 'none' ? 'sm:col-span-2' : undefined}>
          <label htmlFor={id('title')} className={labelClass}>Nazwa nagrody (widzi klient)</label>
          <input id={id('title')} value={day.title} maxLength={80} placeholder={suggestion || 'np. Wesołych Świąt!'} onChange={(event) => onChange({ title: event.target.value })} className={inputClass} />
          {suggestion && day.title.trim() !== suggestion && (
            <button type="button" onClick={() => onChange({ title: suggestion })} className="mt-1 text-left text-[11px] font-bold text-primary hover:underline">
              Użyj: „{suggestion}”
            </button>
          )}
        </div>
        {day.kind === 'stars' && (
          <div>
            <label htmlFor={id('stars')} className={labelClass}>Ile Stars</label>
            <input id={id('stars')} inputMode="numeric" value={day.stars} onChange={(event) => onChange({ stars: digits(event.target.value) })} className={inputClass} />
          </div>
        )}
        {day.kind === 'discount' && (
          <div>
            <label htmlFor={id('discount')} className={labelClass}>Rabat</label>
            <div className="flex gap-1.5">
              <input id={id('discount')} inputMode="decimal" value={day.discount_value} onChange={(event) => onChange({ discount_value: event.target.value.replace(/[^0-9.,]/g, '') })} className={inputClass} />
              <select aria-label="Rodzaj rabatu" value={day.discount_type} onChange={(event) => onChange({ discount_type: event.target.value as DayDraft['discount_type'] })} className={cn(inputClass, 'w-20 shrink-0')}>
                <option value="percent">%</option>
                <option value="amount">zł</option>
              </select>
            </div>
          </div>
        )}
        <div className="sm:col-span-2">
          <label htmlFor={id('desc')} className={labelClass}>Opis (opcjonalnie)</label>
          <input id={id('desc')} value={day.description} maxLength={200} placeholder={day.kind === 'stars' ? 'Stars trafiły od razu na Twoje konto.' : day.kind === 'none' ? 'Życzenia od zespołu' : 'Pokaż kod przy ladzie albo wpisz go w zamówieniu.'} onChange={(event) => onChange({ description: event.target.value })} className={inputClass} />
        </div>
      </div>

      <p className="text-[11px] font-semibold text-zinc-500">
        Dzień {index + 1} · {dateLabel}
        {opens ? ` · otwarte ${opens} razy` : ''}
      </p>
    </div>
  )
}
