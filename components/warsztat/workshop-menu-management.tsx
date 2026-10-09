'use client'

import { useMemo, useState } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import { useMenuRealtime } from '@/lib/use-menu-realtime'
import { FolderCog, ImageIcon, Layers, LoaderCircle, Pencil, Plus, Search, Utensils } from 'lucide-react'
import { CategoryManager } from './menu-editor/category-manager'
import { ModifierGroupManager } from './menu-editor/modifier-group-manager'
import { sendJson, useMenuStructure } from './menu-editor/use-menu-structure'
import { formatPrice } from '@/lib/menu'
import { useMenuCategories } from '@/lib/use-menu'
import { Button } from '@/components/ui/button'
import { MenuItemEditor } from './menu-editor/menu-item-editor'
import type { MenuItem } from './menu-editor/menu-types'

async function fetchMenu(url: string): Promise<MenuItem[]> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Nie udało się wczytać menu.')
  return response.json()
}

export function WorkshopMenuManagement({ canToggle, canEdit }: { canToggle: boolean; canEdit: boolean }) {
  useMenuRealtime()
  const { data: menu = [], error, isLoading, mutate } = useSWR<MenuItem[]>('/api/menu', fetchMenu)
  const { categories } = useMenuCategories()
  const { structure, loaded: structureLoaded, error: structureError, mutate: mutateStructure } = useMenuStructure(canEdit)
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false)
  const [groupManagerOpen, setGroupManagerOpen] = useState(false)
  const productCounts = useMemo(() => menu.reduce<Record<string, number>>((counts, item) => ({ ...counts, [item.category_id]: (counts[item.category_id] ?? 0) + 1 }), {}), [menu])
  const refreshAll = () => Promise.all([mutate(), mutateStructure(), globalMutate('/api/menu/categories'), globalMutate('/api/menu/catalog')])
  const priceLabel = (item: MenuItem) => {
    const prices = structure.variants.filter((variant) => variant.product_id === item.id && variant.active).map((variant) => variant.price)
    return prices.length > 1 && Math.min(...prices) !== Math.max(...prices) ? `${formatPrice(Math.min(...prices))}–${formatPrice(Math.max(...prices))}` : formatPrice(Number(item.price))
  }
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [editor, setEditor] = useState<{ open: boolean; item: MenuItem | null }>({ open: false, item: null })

  const categoryLabel = (id: string) => categories.find((entry) => entry.id === id)?.label ?? id
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return menu.filter((item) => (category === 'all' || item.category_id === category) && (!needle || item.name.toLowerCase().includes(needle)))
  }, [menu, query, category])

  async function toggleAvailability(item: MenuItem) {
    setSavingId(item.id)
    setMessage('')
    try {
      await sendJson('/api/workshop/menu/availability', 'PATCH', { id: item.id, available: !item.available })
      await Promise.all([mutate(), globalMutate('/api/menu/catalog')])
    } catch (toggleError) {
      setMessage(toggleError instanceof Error ? toggleError.message : 'Nie udało się zaktualizować dostępności.')
    } finally {
      setSavingId(null)
    }
  }

  return <section className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 duration-300">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="mb-1 flex items-center gap-2 text-primary"><Utensils className="size-4" aria-hidden="true" /><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b827a]">Katalog kuchni</p></div>
        <h1 className="text-[21px] font-extrabold tracking-tight sm:text-2xl">Menu</h1>
        <p className="mt-0.5 text-xs text-[#817970]">{canEdit ? 'Dodawaj, edytuj i ukrywaj pozycje w menu.' : 'Dostępność aktualizuje menu dla klientów.'}</p>
      </div>
      {canEdit && <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setCategoryManagerOpen(true)}><FolderCog className="size-4" aria-hidden="true" />Kategorie</Button>
        <Button size="sm" variant="outline" onClick={() => setGroupManagerOpen(true)}><Layers className="size-4" aria-hidden="true" />Dodatki</Button>
        <Button size="sm" onClick={() => setEditor({ open: true, item: null })}><Plus className="size-4" aria-hidden="true" />Dodaj pozycję</Button>
      </div>}
    </div>

    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
      <label className="relative flex-1 sm:max-w-xs">
        <span className="sr-only">Szukaj dania</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#a39b92]" aria-hidden="true" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj dania…" className="h-9 w-full rounded-xl border border-[#e5ded6] bg-white pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
      </label>
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 sm:pb-0" role="group" aria-label="Filtr kategorii">
        {[{ id: 'all', label: 'Wszystkie' }, ...categories].map((entry) => <button key={entry.id} type="button" aria-pressed={category === entry.id} onClick={() => setCategory(entry.id)} className={`h-8 shrink-0 rounded-full px-3 text-xs font-semibold transition-colors ${category === entry.id ? 'bg-[#211e1b] text-white' : 'bg-white text-[#5f5953] ring-1 ring-[#e5ded6] hover:bg-[#faf8f5]'}`}>{entry.label}</button>)}
      </div>
    </div>

    {message && <p role="status" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>}
    {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error.message}</p>}
    {structureError && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{structureError.message}</p>}

    <ul className="mt-4 overflow-hidden rounded-2xl border border-[#e8e1d9] bg-white">
      {isLoading ? <li className="p-5 text-sm text-[#817970]">Wczytywanie menu…</li> : visible.map((item, index) => <li key={item.id} className={`flex items-center gap-3 px-3 py-2.5 sm:px-4 ${index ? 'border-t border-[#f0ece7]' : ''} ${item.available ? '' : 'bg-[#fbfaf8]'}`}>
        <div className={`relative aspect-[4/3] w-14 shrink-0 overflow-hidden rounded-lg bg-[#f1ece6] sm:w-16 ${item.available ? '' : 'opacity-50'}`}>
          {item.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={item.image} alt="" loading="lazy" className="size-full object-cover" /> : <ImageIcon className="absolute inset-0 m-auto size-4 text-[#bdb4aa]" aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-[#262220]">{item.name}</p>
          <p className="mt-0.5 truncate text-[11px] text-[#898178]">{categoryLabel(item.category_id)} · <span className="font-semibold text-[#5f5953]">{priceLabel(item)}</span>{item.badge ? ` · ${item.badge}` : ''}</p>
        </div>
        <button type="button" aria-pressed={item.available} disabled={!canToggle || savingId === item.id} onClick={() => void toggleAvailability(item)} className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${item.available ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-[#f1efec] text-[#777068] hover:bg-[#e9e5df]'} disabled:cursor-not-allowed disabled:opacity-60`}>{savingId === item.id && <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />}{item.available ? 'Dostępne' : 'Ukryte'}</button>
        {canEdit && <button type="button" aria-label={`Edytuj ${item.name}`} onClick={() => setEditor({ open: true, item })} className="flex size-8 shrink-0 items-center justify-center rounded-full text-[#6f6861] transition-colors hover:bg-[#f1ece6] hover:text-[#211e1b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Pencil className="size-3.5" /></button>}
      </li>)}
      {!isLoading && visible.length === 0 && <li className="p-5 text-sm text-[#817970]">Brak pozycji.</li>}
    </ul>

    {canEdit && <>
      <MenuItemEditor open={editor.open} item={editor.item} categories={categories} structure={structure} structureLoaded={structureLoaded} onOpenChange={(open) => setEditor((current) => ({ ...current, open }))} onSaved={refreshAll} onManageGroups={() => setGroupManagerOpen(true)} />
      <CategoryManager open={categoryManagerOpen} onOpenChange={setCategoryManagerOpen} categories={categories} productCounts={productCounts} onChanged={refreshAll} />
      <ModifierGroupManager open={groupManagerOpen} onOpenChange={setGroupManagerOpen} structure={structure} onChanged={refreshAll} />
    </>}
  </section>
}
