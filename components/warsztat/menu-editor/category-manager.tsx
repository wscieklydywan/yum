'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Check, ImagePlus, LoaderCircle, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { MenuCategory } from '@/lib/menu'
import { dangerIconButtonClass, iconButtonClass, inputClass } from './form-styles'
import { sendJson } from './use-menu-structure'
import { MenuImageCropper } from './menu-image-cropper'
import { CategoryIcon } from '../category-icon'

const URL = '/api/workshop/menu/categories'

export function CategoryManager({ open, onOpenChange, categories, productCounts, onChanged }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: MenuCategory[]
  productCounts: Record<string, number>
  onChanged: () => Promise<unknown>
}) {
  const [newLabel, setNewLabel] = useState('')
  const [editing, setEditing] = useState<{ id: string; label: string } | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [crop, setCrop] = useState<{ id: string; src: string } | null>(null)
  const cropLabel = categories.find((category) => category.id === crop?.id)?.label

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    try {
      await action()
      await onChanged()
      toast.success(success)
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Operacja nie powiodła się.')
      return false
    } finally {
      setBusy(false)
    }
  }

  function pickImage(categoryId: string, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return void toast.error('Wybierz plik graficzny.')
    if (file.size > 25 * 1024 * 1024) return void toast.error('Zdjęcie jest za duże (maks. 25 MB).')
    setCrop({ id: categoryId, src: window.URL.createObjectURL(file) })
  }

  function closeCrop() {
    if (crop) window.URL.revokeObjectURL(crop.src)
    setCrop(null)
  }

  async function uploadIcon(blob: Blob) {
    if (!crop) return
    const form = new FormData()
    form.append('file', blob, 'category.webp')
    form.append('folder', 'categories')
    const response = await fetch('/api/workshop/menu/image', { method: 'POST', body: form })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error ?? 'Nie udało się wgrać zdjęcia.')
    if (await run(() => sendJson(URL, 'PATCH', { id: crop.id, image: result.url }), `Ikona zapisana (${Math.round(blob.size / 1024)} KB, WebP)`)) closeCrop()
  }

  async function add(event: React.FormEvent) {
    event.preventDefault()
    if (!newLabel.trim()) return
    if (await run(() => sendJson(URL, 'POST', { label: newLabel }), 'Dodano kategorię')) setNewLabel('')
  }

  async function rename(event: React.FormEvent) {
    event.preventDefault()
    if (!editing?.label.trim()) return
    if (await run(() => sendJson(URL, 'PATCH', editing), 'Zmieniono nazwę')) setEditing(null)
  }

  function reorder(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= categories.length) return
    const order = categories.map((category) => category.id)
    ;[order[index], order[target]] = [order[target], order[index]]
    void run(() => sendJson(URL, 'PUT', { order }), 'Zmieniono kolejność')
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-3xl border-[#e8e1d9] bg-[#f6f3ef] p-0">
      <DialogHeader className="border-b border-[#e8e1d9] bg-white px-4 py-3.5 text-left sm:px-5">
        <DialogTitle className="text-base font-extrabold">Kategorie menu</DialogTitle>
        <DialogDescription className="text-xs">Kolejność tutaj to kolejność zakładek w menu klienta.</DialogDescription>
      </DialogHeader>
      <div className="flex-1 overflow-y-auto p-3 sm:p-5">
        {crop && <div className="mb-3 rounded-2xl border border-[#e8e1d9] bg-white p-3">
          <p className="mb-2 text-sm font-bold text-[#262220]">Ikona: {cropLabel}</p>
          <div className="mx-auto max-w-xs">
            <MenuImageCropper src={crop.src} aspect={1} maxWidth={256} round onCancel={closeCrop} onConfirm={uploadIcon} hint="Ustaw danie w kółku. Ikona zostanie zmniejszona i skompresowana do WebP." />
          </div>
        </div>}
        <form onSubmit={add} className="flex gap-2">
          <label htmlFor="new-category" className="sr-only">Nazwa nowej kategorii</label>
          <input id="new-category" maxLength={40} className={inputClass} placeholder="Nowa kategoria, np. Desery" value={newLabel} onChange={(event) => setNewLabel(event.target.value)} />
          <button type="submit" disabled={busy || !newLabel.trim()} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-50"><Plus className="size-4" aria-hidden="true" />Dodaj</button>
        </form>

        <ul className="mt-3 overflow-hidden rounded-2xl border border-[#e8e1d9] bg-white">
          {categories.map((category, index) => {
            const count = productCounts[category.id] ?? 0
            const isEditing = editing?.id === category.id
            return <li key={category.id} className={`flex items-center gap-1 px-2 py-1.5 ${index ? 'border-t border-[#f0ece7]' : ''}`}>
              {isEditing ? <form onSubmit={rename} className="flex flex-1 items-center gap-1">
                <label htmlFor={`rename-${category.id}`} className="sr-only">Nowa nazwa</label>
                <input id={`rename-${category.id}`} autoFocus maxLength={40} className={`${inputClass} h-9`} value={editing.label} onChange={(event) => setEditing({ id: category.id, label: event.target.value })} />
                <button type="submit" aria-label="Zapisz nazwę" disabled={busy} className={iconButtonClass}><Check className="size-4" /></button>
                <button type="button" aria-label="Anuluj" onClick={() => setEditing(null)} className={iconButtonClass}><X className="size-4" /></button>
              </form> : <>
                <label className="relative shrink-0 cursor-pointer rounded-full focus-within:ring-2 focus-within:ring-ring" title={category.image ? 'Zmień ikonę' : 'Dodaj ikonę'}>
                  <span className="sr-only">{category.image ? `Zmień ikonę ${category.label}` : `Dodaj ikonę ${category.label}`}</span>
                  <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(event) => pickImage(category.id, event)} />
                  <CategoryIcon image={category.image} className="size-10" />
                  <span className="absolute -bottom-0.5 -right-0.5 grid size-4.5 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-white" aria-hidden="true"><ImagePlus className="size-2.5" /></span>
                </label>
                <div className="min-w-0 flex-1 px-1">
                  <p className="truncate text-sm font-bold text-[#262220]">{category.label}</p>
                  <p className="text-[11px] text-[#8b827a]">{count} poz.</p>
                </div>
                <button type="button" aria-label={`Przesuń ${category.label} wyżej`} disabled={busy || index === 0} onClick={() => reorder(index, -1)} className={iconButtonClass}><ArrowUp className="size-4" /></button>
                <button type="button" aria-label={`Przesuń ${category.label} niżej`} disabled={busy || index === categories.length - 1} onClick={() => reorder(index, 1)} className={iconButtonClass}><ArrowDown className="size-4" /></button>
                <button type="button" aria-label={`Zmień nazwę ${category.label}`} onClick={() => { setEditing({ id: category.id, label: category.label }); setConfirmId(null) }} className={iconButtonClass}><Pencil className="size-4" /></button>
                {confirmId === category.id
                  ? <button type="button" disabled={busy} onClick={() => void run(() => sendJson(URL, 'DELETE', { id: category.id }), 'Usunięto kategorię').then(() => setConfirmId(null))} className="h-9 shrink-0 rounded-xl bg-red-600 px-2.5 text-[11px] font-bold text-white">{busy ? <LoaderCircle className="size-3.5 animate-spin" aria-label="Usuwanie" /> : 'Usuń?'}</button>
                  : <button type="button" aria-label={`Usuń ${category.label}`} title={count ? 'Najpierw przenieś pozycje' : undefined} onClick={() => count ? toast.error(`Kategoria zawiera ${count} poz. – przenieś je lub usuń najpierw.`) : setConfirmId(category.id)} className={dangerIconButtonClass}><Trash2 className="size-4" /></button>}
              </>}
            </li>
          })}
          {categories.length === 0 && <li className="p-4 text-sm text-[#817970]">Brak kategorii.</li>}
        </ul>
      </div>
    </DialogContent>
  </Dialog>
}
