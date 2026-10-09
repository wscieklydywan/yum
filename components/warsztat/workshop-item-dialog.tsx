'use client'

import { useState, type FormEvent } from 'react'
import { LoaderCircle, Minus, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { useGroupedMenu } from './use-grouped-menu'
import { receiptedQuantity, type KitchenOrder, type Station } from './order-data'

export type ItemDialogTarget = { order: KitchenOrder; index: number | null }

const CUSTOM = '__custom'
const inputClass = 'h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60'

function parsePrice(value: string) {
  const normalized = value.replace(',', '.').trim()
  if (!normalized) return null
  const price = Number(normalized)
  return Number.isFinite(price) && price >= 0 && price <= 10000 ? Math.round(price * 100) / 100 : Number.NaN
}

export function WorkshopItemDialog({ target, onClose, onSaved, onRemove }: { target: ItemDialogTarget | null; onClose: () => void; onSaved: () => void; onRemove: (order: KitchenOrder, index: number) => void }) {
  return <Dialog open={!!target} onOpenChange={(open) => { if (!open) onClose() }}>
    <DialogContent className="workshop-dashboard sm:max-w-md">
      {target && <ItemForm key={`${target.order.databaseId}-${target.index}`} target={target} onClose={onClose} onSaved={onSaved} onRemove={onRemove} />}
    </DialogContent>
  </Dialog>
}

function ItemForm({ target, onClose, onSaved, onRemove }: { target: ItemDialogTarget; onClose: () => void; onSaved: () => void; onRemove: (order: KitchenOrder, index: number) => void }) {
  const { order, index } = target
  const item = index === null ? null : order.items[index]
  const locked = item ? receiptedQuantity(item) : 0
  const { products, groups: productGroups, isLoading } = useGroupedMenu()
  const [productId, setProductId] = useState('')
  const [name, setName] = useState('')
  const [station, setStation] = useState<Station>('kitchen')
  const [quantity, setQuantity] = useState(item?.quantity ?? 1)
  const [options, setOptions] = useState(item?.options ?? '')
  const [price, setPrice] = useState(item?.unitPrice !== undefined ? String(item.unitPrice).replace('.', ',') : '')
  const [saving, setSaving] = useState(false)
  const minQuantity = Math.max(1, locked)
  const custom = productId === CUSTOM

  function chooseProduct(id: string) {
    setProductId(id)
    const product = products.find((entry) => entry.id === id)
    if (product) setPrice(product.price.toFixed(2).replace('.', ','))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving || !order.databaseId) return
    const unitPrice = parsePrice(price)
    if (Number.isNaN(unitPrice)) { toast.error('Nieprawidłowa cena.'); return }
    if (!item && !productId) { toast.error('Wybierz danie.'); return }
    if (!item && custom && (name.trim().length < 2 || unitPrice === null)) { toast.error('Podaj nazwę i cenę pozycji.'); return }

    const payload: Record<string, unknown> = { quantity, options }
    if (unitPrice !== null && !locked) payload.unitPrice = unitPrice
    if (!item) {
      if (custom) Object.assign(payload, { name: name.trim(), station })
      else payload.productId = productId
    }

    setSaving(true)
    const { error } = await createClient().rpc('workshop_edit_order', { p_order_id: order.databaseId, p_action: item ? 'edit_item' : 'add_item', p_index: index, p_payload: payload })
    setSaving(false)
    if (error) { toast.error(error.message || 'Nie udało się zapisać pozycji.'); return }
    toast.success(item ? `${order.id}: zmieniono „${item.name}”` : `${order.id}: dodano pozycję`)
    onSaved()
  }

  return <form onSubmit={submit} className="flex flex-col gap-4">
    <DialogHeader>
      <DialogTitle>{item ? `Edytuj: ${item.name}` : `Dodaj pozycję do ${order.id}`}</DialogTitle>
      <DialogDescription>{locked
        ? `${locked} szt. jest już na paragonie — możesz tylko dołożyć sztuki. Nie da się ich zmniejszyć, przecenić ani zmienić dodatków. Do zwrotu użyj „Zwrot”.`
        : item ? 'Zmiana trafi od razu do kuchni i na paragon.' : 'Np. klient dzwoni i dobiera coś do zamówienia. Pozycja trafi do kuchni.'}</DialogDescription>
    </DialogHeader>

    {!item && <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
        Danie
        <select value={productId} onChange={(event) => chooseProduct(event.target.value)} className={inputClass} required>
          <option value="" disabled>{isLoading ? 'Ładowanie menu…' : 'Wybierz z menu'}</option>
          {productGroups.map((group) => <optgroup key={group.id} label={group.label}>
            {group.products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.price.toFixed(2).replace('.', ',')} zł</option>)}
          </optgroup>)}
          <option value={CUSTOM}>Inna pozycja (spoza menu)…</option>
        </select>
      </label>
      {custom && <div className="grid grid-cols-[1fr_auto] gap-2">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">Nazwa<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required className={inputClass} /></label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">Stanowisko
          <select value={station} onChange={(event) => setStation(event.target.value as Station)} className={inputClass}><option value="kitchen">Kuchnia</option><option value="cashier">Bar</option></select>
        </label>
      </div>}
    </div>}

    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
        <span id="item-quantity-label">Ilość</span>
        <div role="group" aria-labelledby="item-quantity-label" className="flex h-9 items-center justify-between rounded-lg border border-border">
          <button type="button" aria-label="Mniej" onClick={() => setQuantity((value) => Math.max(minQuantity, value - 1))} disabled={quantity <= minQuantity} className="grid size-9 place-items-center text-foreground disabled:opacity-40"><Minus className="size-4" aria-hidden="true" /></button>
          <span className="text-sm font-semibold tabular-nums text-foreground" aria-live="polite">{quantity}</span>
          <button type="button" aria-label="Więcej" onClick={() => setQuantity((value) => Math.min(50, value + 1))} disabled={quantity >= 50} className="grid size-9 place-items-center text-foreground disabled:opacity-40"><Plus className="size-4" aria-hidden="true" /></button>
        </div>
      </div>
      <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
        Cena za szt. (zł)
        <input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" placeholder="0,00" disabled={locked > 0} className={inputClass} />
      </label>
    </div>

    <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
      Dodatki / uwagi do pozycji
      <textarea value={options} onChange={(event) => setOptions(event.target.value)} maxLength={200} rows={2} placeholder="np. bez cebuli, extra ser" disabled={locked > 0} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" />
    </label>

    <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
      {item && index !== null && !locked ? <Button type="button" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onRemove(order, index)}><Trash2 data-icon="inline-start" />Usuń</Button> : <span />}
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Anuluj</Button>
        <Button type="submit" disabled={saving}>{saving && <LoaderCircle className="animate-spin" data-icon="inline-start" />}Zapisz</Button>
      </div>
    </DialogFooter>
  </form>
}
