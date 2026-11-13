'use client'

import { useMemo } from 'react'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { formatMoney } from '@/lib/marketing'
import type { RewardItem, RewardMenuProduct } from '@/lib/loyalty-economics'
import { inputClass, labelClass } from '../menu-editor/form-styles'

export function groupProducts(products: RewardMenuProduct[]) {
  const groups = new Map<string, RewardMenuProduct[]>()
  for (const product of products) groups.set(product.category, [...(groups.get(product.category) ?? []), product])
  return [...groups.entries()]
}

export function RewardItemsEditor({
  id,
  items,
  products,
  onChange,
}: {
  id: string
  items: RewardItem[]
  products: RewardMenuProduct[]
  onChange: (items: RewardItem[]) => void
}) {
  const groups = useMemo(() => groupProducts(products), [products])
  const byId = useMemo(() => new Map(products.map((product) => [product.id, product])), [products])
  const update = (index: number, patch: Partial<RewardItem>) => onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={labelClass}>Co klient dostaje (produkty z menu)</legend>
      {items.map((item, index) => {
        const product = item.product_id ? byId.get(item.product_id) : undefined
        const missing = !item.product_id || !product
        return (
          <div key={index} className="flex flex-col gap-1.5 rounded-lg bg-zinc-50 p-2">
            <div className="flex items-center gap-2">
              <label htmlFor={`${id}-item-${index}`} className="sr-only">Produkt</label>
              <select
                id={`${id}-item-${index}`}
                value={product ? product.id : ''}
                onChange={(event) => {
                  const next = byId.get(event.target.value)
                  if (next) update(index, { product_id: next.id, name: next.name })
                }}
                className={`${inputClass} min-w-0 flex-1`}
              >
                <option value="" disabled>{item.name ? `${item.name} – wybierz produkt` : 'Wybierz produkt…'}</option>
                {groups.map(([category, list]) => (
                  <optgroup key={category} label={category}>
                    {list.map((option) => (
                      <option key={option.id} value={option.id}>{option.name} · {formatMoney(option.price)}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <label htmlFor={`${id}-qty-${index}`} className="sr-only">Ilość</label>
              <input
                id={`${id}-qty-${index}`}
                inputMode="numeric"
                value={item.quantity}
                onChange={(event) => update(index, { quantity: Math.min(10, Math.max(1, Number(event.target.value.replace(/\D/g, '')) || 1)) })}
                className={`${inputClass} w-14 text-center`}
              />
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                aria-label={`Usuń ${product?.name ?? item.name ?? 'produkt'} z kuponu`}
                className="grid size-10 shrink-0 place-items-center rounded-xl text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
            {missing ? (
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                Ta pozycja nie jest powiązana z menu – wybierz prawdziwy produkt.
              </p>
            ) : (
              <label className="flex items-center gap-2 text-xs text-zinc-600">
                <input type="checkbox" checked={item.choice === true} onChange={(event) => update(index, { choice: event.target.checked })} className="size-4 accent-primary" />
                Klient może wybrać inny produkt z „{product.category}” do {formatMoney(product.price)}
              </label>
            )}
          </div>
        )
      })}
      {items.length < 6 && (
        <button
          type="button"
          onClick={() => onChange([...items, { name: '', quantity: 1 }])}
          className="flex h-9 items-center justify-center gap-1.5 self-start rounded-xl border border-dashed border-zinc-300 px-3 text-xs font-semibold text-zinc-700 transition-colors hover:border-primary hover:text-primary"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Dodaj produkt
        </button>
      )}
    </fieldset>
  )
}
