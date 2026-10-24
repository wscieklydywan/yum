'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, ImagePlus, LoaderCircle, Pencil, Plus, Settings2, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { MenuCategory } from '@/lib/menu'
import { parseVat, VAT_LETTERS, vatLabel } from '@/lib/vat'
import { AllergenIngredientEditor } from './allergen-ingredient-editor'
import { MenuImageCropper } from './menu-image-cropper'
import { MenuProductPreview } from './menu-product-preview'
import { addButtonClass, cleanDecimal, dangerIconButtonClass, iconButtonClass, inputClass, labelClass } from './form-styles'
import { badgeOptions, draftToPayload, groupSummary, newModifier, stationLabels, toDraft, type DraftModifier, type DraftVariant, type MenuDraft, type MenuItem, type MenuStation, type MenuStructure } from './menu-types'
import { sendJson } from './use-menu-structure'

function Step({ number, title, hint, children }: { number: number; title: string; hint?: string; children: React.ReactNode }) {
  return <fieldset className="min-w-0 rounded-2xl border border-[#ece6df] bg-white p-3.5 sm:p-4">
    <legend className="sr-only">{title}</legend>
    <div className="mb-3 flex items-start gap-2.5">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-extrabold text-primary-foreground" aria-hidden="true">{number}</span>
      <div><p className="text-sm font-bold leading-6 text-[#262220]">{title}</p>{hint && <p className="text-[11px] text-[#8b827a]">{hint}</p>}</div>
    </div>
    {children}
  </fieldset>
}

function PriceInput({ label, value, onChange, prefix }: { label: string; value: string; onChange: (value: string) => void; prefix?: string }) {
  return <div className="relative w-28 shrink-0">
    {prefix && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#8b827a]">{prefix}</span>}
    <input aria-label={label} inputMode="decimal" className={`${inputClass} ${prefix ? 'pl-6' : ''} pr-7`} placeholder="0" value={value} onChange={(event) => onChange(cleanDecimal(event.target.value))} />
    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#8b827a]">zł</span>
  </div>
}

function move<T>(items: T[], index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= items.length) return items
  const copy = [...items]
  ;[copy[index], copy[target]] = [copy[target], copy[index]]
  return copy
}

function VariantList({ items, onChange }: { items: DraftVariant[]; onChange: (items: DraftVariant[]) => void }) {
  return <div>
    {items.length > 0 && <ul className="flex flex-col gap-2">
      {items.map((item, index) => <li key={item.id ?? `new-${index}`} className="flex items-center gap-1.5">
        <input aria-label={`Wariant ${index + 1} – nazwa`} className={inputClass} placeholder="np. Double" value={item.name} maxLength={40} onChange={(event) => onChange(items.map((current, i) => i === index ? { ...current, name: event.target.value } : current))} />
        <PriceInput label={`Wariant ${index + 1} – cena`} value={item.price} onChange={(price) => onChange(items.map((current, i) => i === index ? { ...current, price } : current))} />
        <button type="button" aria-label="Przesuń wyżej" disabled={index === 0} onClick={() => onChange(move(items, index, -1))} className={`${iconButtonClass} hidden sm:flex`}><ArrowUp className="size-4" /></button>
        <button type="button" aria-label="Usuń wariant" onClick={() => onChange(items.filter((_, i) => i !== index))} className={dangerIconButtonClass}><X className="size-4" /></button>
      </li>)}
    </ul>}
    <button type="button" onClick={() => onChange([...items, { name: '', price: '' }])} className={addButtonClass}><Plus className="size-3.5" aria-hidden="true" />Dodaj rozmiar</button>
  </div>
}

function ModifierList({ items, structure, onChange, onManageGroups }: { items: DraftModifier[]; structure: MenuStructure; onChange: (items: DraftModifier[]) => void; onManageGroups: () => void }) {
  const available = structure.groups.filter((group) => !items.some((item) => item.group_id === group.id))
  const patch = (index: number, value: Partial<DraftModifier>) => onChange(items.map((current, i) => i === index ? { ...current, ...value } : current))

  return <div>
    {items.length > 0 && <ul className="flex flex-col gap-2">
      {items.map((item, index) => {
        const group = structure.groups.find((entry) => entry.id === item.group_id)
        return <li key={item.group_id} className="rounded-xl border border-[#ece6df] bg-[#faf8f5] p-3">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[#262220]">{group?.name ?? item.group_id}</p>
              <p className="truncate text-[11px] text-[#8b827a]">{group ? groupSummary(group) : 'Grupa nie istnieje'}{group && !group.active ? ' · wyłączona' : ''}</p>
            </div>
            <button type="button" aria-label="Przesuń wyżej" disabled={index === 0} onClick={() => onChange(move(items, index, -1))} className={iconButtonClass}><ArrowUp className="size-4" /></button>
            <button type="button" aria-label="Przesuń niżej" disabled={index === items.length - 1} onClick={() => onChange(move(items, index, 1))} className={iconButtonClass}><ArrowDown className="size-4" /></button>
            <button type="button" aria-label={`Odepnij ${group?.name ?? 'grupę'}`} onClick={() => onChange(items.filter((_, i) => i !== index))} className={dangerIconButtonClass}><X className="size-4" /></button>
          </div>
          <div role="group" aria-label="Czy klient musi wybrać" className="mt-2.5 grid grid-cols-2 gap-1 rounded-lg bg-[#eae5de] p-1">
            {[false, true].map((required) => <button key={String(required)} type="button" aria-pressed={item.required === required} onClick={() => patch(index, { required })} className={`h-8 rounded-md text-xs font-bold transition-colors ${item.required === required ? 'bg-white text-[#211e1b] shadow-sm' : 'text-[#706961]'}`}>{required ? 'Klient musi wybrać' : 'Klient może wybrać'}</button>)}
          </div>
          <details className="group mt-2">
            <summary className="cursor-pointer list-none text-[11px] font-semibold text-[#8b827a] hover:text-[#4d4741] [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">+ Więcej ustawień (ile sztuk, cena)</span><span className="hidden group-open:inline">− Mniej ustawień</span>
            </summary>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div><label htmlFor={`min-${item.group_id}`} className={labelClass}>Wybierz co najmniej</label><input id={`min-${item.group_id}`} inputMode="numeric" disabled={!item.required} className={inputClass} value={item.required ? item.min : '0'} onChange={(event) => patch(index, { min: event.target.value.replace(/\D/g, '') })} /></div>
              <div><label htmlFor={`max-${item.group_id}`} className={labelClass}>Najwyżej</label><input id={`max-${item.group_id}`} inputMode="numeric" disabled={group?.selection_mode === 'single'} className={inputClass} placeholder={group?.selection_mode === 'single' ? '1' : group?.max_selections ? String(group.max_selections) : 'bez limitu'} value={group?.selection_mode === 'single' ? '1' : item.max} onChange={(event) => patch(index, { max: event.target.value.replace(/\D/g, '') })} /></div>
              <div><label htmlFor={`override-${item.group_id}`} className={labelClass}>Inna cena (zł)</label><input id={`override-${item.group_id}`} inputMode="decimal" className={inputClass} placeholder="jak w grupie" value={item.price_override} onChange={(event) => patch(index, { price_override: cleanDecimal(event.target.value) })} /></div>
            </div>
            <p className="mt-1.5 text-[10px] text-[#a39b92]">{'„Inna cena” zmienia cenę każdej opcji z tej grupy tylko w tym daniu. Puste = cena z grupy.'}</p>
          </details>
        </li>
      })}
    </ul>}
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {available.length > 0 && <select aria-label="Przypnij grupę dodatków" className={`${inputClass} h-9 min-w-0 basis-full truncate sm:basis-0 sm:flex-1`} value="" onChange={(event) => {
        const group = structure.groups.find((entry) => entry.id === event.target.value)
        if (group) onChange([...items, newModifier(group)])
      }}>
        <option value="">+ Dodaj do dania grupę (np. Sosy)…</option>
        {available.map((group) => <option key={group.id} value={group.id}>{group.name} ({group.options.length})</option>)}
      </select>}
      <button type="button" onClick={onManageGroups} className={`${addButtonClass} mt-0`}><Settings2 className="size-3.5" aria-hidden="true" />Edytuj listy dodatków</button>
    </div>
  </div>
}

export function MenuItemEditor({ open, item, categories, structure, structureLoaded, onOpenChange, onSaved, onManageGroups }: {
  open: boolean
  item: MenuItem | null
  categories: MenuCategory[]
  structure: MenuStructure
  structureLoaded: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => Promise<unknown>
  onManageGroups: () => void
}) {
  const [draft, setDraft] = useState<MenuDraft>(() => toDraft(item, categories[0]?.id ?? '', structure))
  const [tab, setTab] = useState<'form' | 'preview'>('form')
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (!open) {
      initialized.current = false
      return
    }
    if (initialized.current || !structureLoaded) return
    initialized.current = true
    setDraft(toDraft(item, categories[0]?.id ?? '', structure))
    setTab('form')
    setCropSrc(null)
    setConfirmDelete(false)
  }, [open, item, categories, structure, structureLoaded])

  useEffect(() => () => { if (cropSrc) URL.revokeObjectURL(cropSrc) }, [cropSrc])

  const update = <K extends keyof MenuDraft>(key: K, value: MenuDraft[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const categoryLabel = categories.find((category) => category.id === draft.category_id)?.label ?? draft.category_id
  const hasVariants = draft.variants.length > 0

  function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return void toast.error('Wybierz plik graficzny.')
    if (file.size > 25 * 1024 * 1024) return void toast.error('Zdjęcie jest za duże (maks. 25 MB).')
    setCropSrc(URL.createObjectURL(file))
  }

  async function uploadCropped(blob: Blob) {
    const form = new FormData()
    form.append('file', blob, 'menu.webp')
    const response = await fetch('/api/workshop/menu/image', { method: 'POST', body: form })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error ?? 'Nie udało się wgrać zdjęcia.')
    update('image', result.url)
    setCropSrc(null)
    toast.success(`Zdjęcie wgrane (${Math.round(blob.size / 1024)} KB, WebP)`)
  }

  async function run(action: () => Promise<unknown>, success: string) {
    setSaving(true)
    try {
      await action()
      await onSaved()
      toast.success(success)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Operacja nie powiodła się.')
    } finally {
      setSaving(false)
    }
  }

  function save(event: React.FormEvent) {
    event.preventDefault()
    if (draft.variants.some((variant) => variant.name.trim() && !variant.price.trim())) return void toast.error('Uzupełnij cenę ka��dego wariantu.')
    void run(() => sendJson('/api/workshop/menu', draft.id ? 'PATCH' : 'POST', draftToPayload(draft)), draft.id ? 'Zapisano zmiany' : 'Dodano pozycję do menu')
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1rem)] max-w-2xl flex-col sm:max-w-2xl md:max-w-3xl lg:max-w-4xl gap-0 overflow-hidden rounded-3xl border-[#e8e1d9] bg-[#f6f3ef] p-0">
      <DialogHeader className="border-b border-[#e8e1d9] bg-white px-4 py-3.5 text-left sm:px-5">
        <DialogTitle className="text-base font-extrabold">{draft.id ? 'Edytuj pozycję' : 'Nowa pozycja menu'}</DialogTitle>
        <DialogDescription className="text-xs">Wypełnij pola od góry. Wymagane są tylko nazwa, kategoria i cena – resztę możesz pominąć. Przycisk „Podgląd” pokaże gotowy wygląd.</DialogDescription>
      </DialogHeader>

      <form id="menu-item-form" onSubmit={save} className="flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
        {!structureLoaded ? <p className="flex items-center gap-2 p-4 text-sm text-[#817970]"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Wczytywanie danych pozycji…</p>
          : tab === 'preview' ? <MenuProductPreview draft={draft} groups={structure.groups} categoryLabel={categoryLabel} /> : <div className="flex flex-col gap-3">
          <Step number={1} title="Nazwa, kategoria i cena" hint="To, co klient zobaczy w menu.">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><label htmlFor="menu-name" className={labelClass}>Nazwa</label><input id="menu-name" required maxLength={40} className={inputClass} placeholder="np. Burger Classic" value={draft.name} onChange={(event) => update('name', event.target.value)} /></div>
              <div><label htmlFor="menu-category" className={labelClass}>Kategoria</label><select id="menu-category" required className={inputClass} value={draft.category_id} onChange={(event) => update('category_id', event.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></div>
              <div><label htmlFor="menu-price" className={labelClass}>Cena (zł)</label><input id="menu-price" required={!hasVariants} disabled={hasVariants} inputMode="decimal" className={inputClass} placeholder="29.90" value={hasVariants ? draft.variants[0]?.price ?? '' : draft.price} onChange={(event) => update('price', cleanDecimal(event.target.value))} />{hasVariants && <p className="mt-1 text-[10px] text-[#a39b92]">Danie ma rozmiary – ceny ustawiasz niżej</p>}</div>
              <div className="sm:col-span-2"><label htmlFor="menu-description" className={labelClass}>Opis</label><textarea id="menu-description" rows={3} maxLength={400} className={`${inputClass} h-auto resize-none py-2.5`} placeholder="Składniki, gramatura, alergeny…" value={draft.description} onChange={(event) => update('description', event.target.value)} /><p className="mt-1 text-right text-[10px] text-[#a39b92]">{draft.description.length}/400</p></div>
            </div>
          </Step>

          <Step number={2} title="Zdjęcie (opcjonalnie)" hint="Wybierz zdjęcie z urządzenia i dopasuj kadr. Resztą zajmie się system.">
            {cropSrc ? <MenuImageCropper src={cropSrc} onCancel={() => setCropSrc(null)} onConfirm={uploadCropped} /> : <div className="flex items-center gap-3">
              <div className="relative aspect-[4/3] w-32 shrink-0 overflow-hidden rounded-xl bg-[#f1ece6] sm:w-40">
                {draft.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={draft.image} alt="Zdjęcie pozycji" className="size-full object-cover" /> : <div className="flex size-full items-center justify-center text-[#b3aba2]"><ImagePlus className="size-6" aria-hidden="true" /></div>}
              </div>
              <div className="flex flex-col gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => fileInput.current?.click()}><ImagePlus className="size-3.5" aria-hidden="true" />{draft.image ? 'Zmień zdjęcie' : 'Wybierz zdjęcie'}</Button>
                {draft.image && <Button type="button" size="sm" variant="ghost" className="text-[#8b827a]" onClick={() => update('image', '')}>Usuń zdjęcie</Button>}
              </div>
              <input ref={fileInput} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={pickFile} />
            </div>}
          </Step>

          <Step number={3} title="Rozmiary (opcjonalnie)" hint="Tylko jeśli danie ma kilka rozmiarów, np. Single / Double albo 6 szt. / 12 szt. Wpisz pełną cenę każdego rozmiaru.">
            <VariantList items={draft.variants} onChange={(items) => update('variants', items)} />
          </Step>

          <Step number={4} title="Co klient może dobrać (opcjonalnie)" hint="Np. sosy albo dodatki. Wybierz listę z rozwijanego menu i zdecyduj, czy wybór jest obowiązkowy.">
            <ModifierList items={draft.modifiers} structure={structure} onChange={(items) => update('modifiers', items)} onManageGroups={onManageGroups} />
          </Step>

          <Step number={5} title="Skład i alergeny" hint="Zgodnie z przepisami UE klient musi wiedzieć, czy danie zawiera któryś z 14 głównych alergenów.">
            <AllergenIngredientEditor
              allergens={draft.allergens}
              ingredients={draft.ingredients}
              onAllergensChange={(next) => update('allergens', next)}
              onIngredientsChange={(next) => update('ingredients', next)}
            />
          </Step>

          <Step number={6} title="Pozostałe ustawienia">
            <p className={labelClass}>Naklejka na karcie (opcjonalnie)</p>
            <div className="flex flex-wrap gap-1.5">
              {[null, ...badgeOptions].map((badge) => <button key={badge ?? 'none'} type="button" aria-pressed={draft.badge === badge} onClick={() => update('badge', badge)} className={`h-8 rounded-full border px-3 text-xs font-semibold transition-colors ${draft.badge === badge ? 'border-primary bg-primary text-primary-foreground' : 'border-[#e5ded6] bg-white text-[#5f5953] hover:border-[#cfc6bb]'}`}>{badge ?? 'Brak'}</button>)}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div><label htmlFor="menu-station" className={labelClass}>Kto przygotowuje</label><select id="menu-station" className={inputClass} value={draft.station} onChange={(event) => update('station', event.target.value as MenuStation)}>{(Object.keys(stationLabels) as MenuStation[]).map((station) => <option key={station} value={station}>{stationLabels[station]}</option>)}</select></div>
              <div><label htmlFor="menu-vat" className={labelClass}>Stawka VAT</label><select id="menu-vat" required className={inputClass} value={draft.vat} onChange={(event) => update('vat', parseVat(event.target.value) ?? '')}><option value="" disabled>Wybierz stawkę</option>{VAT_LETTERS.map((vat) => <option key={vat} value={vat}>{vatLabel(vat)}</option>)}</select></div>
            </div>
            {!draft.vat && <p role="status" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">{draft.id ? 'Ta pozycja nie ma jeszcze zweryfikowanej stawki VAT — paragon zostanie zablokowany, dopóki jej nie ustawisz.' : 'Wybierz stawkę VAT — trafi do każdego zamówienia i na paragon.'}</p>}
            <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-[#faf8f5] px-3 py-2.5">
              <span><span className="block text-sm font-semibold text-[#262220]">Widoczne dla klientów</span><span className="block text-[11px] text-[#8b827a]">Odznacz, jeśli danie chwilowo jest niedostępne.</span></span>
              <input type="checkbox" checked={draft.available} onChange={(event) => update('available', event.target.checked)} className="size-5 accent-primary" />
            </label>
          </Step>
        </div>}
      </form>

      <div className="flex items-center gap-2 border-t border-[#e8e1d9] bg-white px-3 py-3 sm:px-5">
        {draft.id && (confirmDelete
          ? <Button type="button" size="sm" variant="destructive" disabled={saving} onClick={() => void run(() => sendJson('/api/workshop/menu', 'DELETE', { id: draft.id }), 'Usunięto pozycję')}>Potwierdź usunięcie</Button>
          : <Button type="button" size="icon" variant="ghost" aria-label="Usuń pozycję" className="text-[#8b827a] hover:text-red-600" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" /></Button>)}
        <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => setTab(tab === 'form' ? 'preview' : 'form')}>{tab === 'form' ? <><Eye className="size-3.5" aria-hidden="true" />Podgląd</> : <><Pencil className="size-3.5" aria-hidden="true" />Wróć do edycji</>}</Button>
        <Button type="submit" form="menu-item-form" size="sm" disabled={saving || Boolean(cropSrc) || !structureLoaded}>{saving && <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />}Zapisz</Button>
      </div>
    </DialogContent>
  </Dialog>
}
