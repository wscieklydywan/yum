'use client'

import { useState, type FormEvent } from 'react'
import { LoaderCircle, Shuffle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { PROMO_REWARD_LABELS, PROMO_REWARD_TYPES, normalizePromoCode, promoRewardSummary, type PromoCode, type PromoRewardType } from '@/lib/promo-codes'
import { cleanDecimal, inputClass, labelClass } from '../menu-editor/form-styles'

export type PromoProduct = { id: string; name: string }

type Draft = {
  id?: string
  code: string
  description: string
  reward_type: PromoRewardType
  points: string
  product_id: string
  discount_value: string
  coupon_hours: string
  unlimited: boolean
  max_uses: string
  per_user_limit: string
  hasExpiry: boolean
  expires_at: string
  active: boolean
}

function toLocalInput(iso: string | null) {
  const date = iso ? new Date(iso) : new Date(Date.now() + 7 * 24 * 3600_000)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function toDraft(promo: PromoCode | null): Draft {
  return {
    id: promo?.id,
    code: promo?.code ?? '',
    description: promo?.description ?? '',
    reward_type: promo?.reward_type ?? 'discount_percent',
    points: String(promo?.points || 100),
    product_id: promo?.product_id ?? '',
    discount_value: String(promo?.discount_value || 20),
    coupon_hours: String(promo?.coupon_hours ?? 24),
    unlimited: promo ? promo.max_uses === null : false,
    max_uses: String(promo?.max_uses ?? 100),
    per_user_limit: String(promo?.per_user_limit ?? 1),
    hasExpiry: promo ? promo.expires_at !== null : true,
    expires_at: toLocalInput(promo?.expires_at ?? null),
    active: promo?.active ?? true,
  }
}

function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return `YUMMY-${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')}`
}

export function PromoCodeEditor({
  open,
  promo,
  products,
  onOpenChange,
  onSave,
  onDelete,
}: {
  open: boolean
  promo: PromoCode | null
  products: PromoProduct[]
  onOpenChange: (open: boolean) => void
  onSave: (payload: Record<string, unknown>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(promo))
  const [saving, setSaving] = useState(false)
  const [lastPromo, setLastPromo] = useState(promo)
  const [lastOpen, setLastOpen] = useState(open)

  if (promo !== lastPromo || open !== lastOpen) {
    setLastPromo(promo)
    setLastOpen(open)
    if (open) setDraft(toDraft(promo))
  }

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const product = products.find((item) => item.id === draft.product_id)
  const preview = promoRewardSummary({
    reward_type: draft.reward_type,
    points: Number(draft.points) || 0,
    product_name: product?.name ?? '',
    discount_value: Number(draft.discount_value) || 0,
  })

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      await onSave({
        id: draft.id,
        code: draft.code,
        description: draft.description,
        reward_type: draft.reward_type,
        points: draft.points,
        product_id: draft.product_id,
        discount_value: draft.discount_value,
        coupon_hours: draft.coupon_hours,
        max_uses: draft.unlimited ? null : draft.max_uses,
        per_user_limit: draft.per_user_limit,
        expires_at: draft.hasExpiry ? new Date(draft.expires_at).toISOString() : null,
        active: draft.active,
      })
      onOpenChange(false)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Nie udało się zapisać kodu.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!draft.id || !window.confirm(`Usunąć kod ${draft.code}? Wydane już kupony pozostaną ważne.`)) return
    setSaving(true)
    try {
      await onDelete(draft.id)
      onOpenChange(false)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Nie udało się usunąć kodu.')
    } finally {
      setSaving(false)
    }
  }

  const isCoupon = draft.reward_type !== 'points'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{draft.id ? 'Edytuj kod rabatowy' : 'Nowy kod rabatowy'}</DialogTitle>
          <DialogDescription>Klient wpisuje kod w Yummy Club. Nagroda: <strong className="text-foreground">{preview}</strong></DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="promo-code" className={labelClass}>Kod</label>
            <div className="flex gap-2">
              <input id="promo-code" required value={draft.code} onChange={(event) => update('code', normalizePromoCode(event.target.value))} placeholder="np. FRYTKI2026" className={cn(inputClass, 'font-mono font-bold uppercase tracking-wider')} autoComplete="off" />
              <Button type="button" variant="outline" onClick={() => update('code', randomCode())} aria-label="Wygeneruj losowy kod"><Shuffle className="size-4" aria-hidden="true" /></Button>
            </div>
          </div>

          <div>
            <label htmlFor="promo-description" className={labelClass}>Opis (widoczny dla klienta)</label>
            <input id="promo-description" maxLength={120} value={draft.description} onChange={(event) => update('description', event.target.value)} placeholder="np. Darmowe frytki na otwarcie" className={inputClass} />
          </div>

          <fieldset>
            <legend className={labelClass}>Działanie kodu</legend>
            <div className="grid grid-cols-2 gap-2">
              {PROMO_REWARD_TYPES.map((type) => (
                <button key={type} type="button" aria-pressed={draft.reward_type === type} onClick={() => update('reward_type', type)} className={cn('rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition-colors', draft.reward_type === type ? 'border-primary bg-primary/5 text-primary' : 'border-[#e5ded6] bg-white text-[#5d5650] hover:bg-[#faf7f3]')}>
                  {PROMO_REWARD_LABELS[type]}
                </button>
              ))}
            </div>
          </fieldset>

          {draft.reward_type === 'points' && (
            <div>
              <label htmlFor="promo-points" className={labelClass}>Liczba punktów</label>
              <input id="promo-points" inputMode="numeric" value={draft.points} onChange={(event) => update('points', event.target.value.replace(/\D/g, ''))} className={inputClass} />
            </div>
          )}
          {draft.reward_type === 'free_item' && (
            <div>
              <label htmlFor="promo-product" className={labelClass}>Pozycja z menu</label>
              <select id="promo-product" required value={draft.product_id} onChange={(event) => update('product_id', event.target.value)} className={inputClass}>
                <option value="">Wybierz…</option>
                {products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
          )}
          {draft.reward_type.startsWith('discount') && (
            <div>
              <label htmlFor="promo-discount" className={labelClass}>{draft.reward_type === 'discount_percent' ? 'Rabat (%)' : 'Rabat (zł)'}</label>
              <input id="promo-discount" inputMode="decimal" value={draft.discount_value} onChange={(event) => update('discount_value', cleanDecimal(event.target.value))} className={inputClass} />
            </div>
          )}
          {isCoupon && (
            <div>
              <label htmlFor="promo-hours" className={labelClass}>Ważność kuponu po aktywacji (godziny)</label>
              <input id="promo-hours" inputMode="numeric" value={draft.coupon_hours} onChange={(event) => update('coupon_hours', event.target.value.replace(/\D/g, ''))} className={inputClass} />
              <p className="mt-1 text-[11px] text-[#8b827a]">Klient dostaje osobisty kupon do pokazania przy ladzie.</p>
            </div>
          )}

          <div className="grid gap-4 rounded-2xl bg-[#faf7f3] p-3 sm:grid-cols-2">
            <div>
              <label htmlFor="promo-max" className={labelClass}>Łączny limit użyć</label>
              <input id="promo-max" inputMode="numeric" disabled={draft.unlimited} value={draft.unlimited ? '' : draft.max_uses} placeholder="Bez limitu" onChange={(event) => update('max_uses', event.target.value.replace(/\D/g, ''))} className={inputClass} />
              <label className="mt-1.5 flex items-center gap-2 text-xs text-[#5d5650]"><input type="checkbox" checked={draft.unlimited} onChange={(event) => update('unlimited', event.target.checked)} className="accent-primary" />Bez limitu</label>
            </div>
            <div>
              <label htmlFor="promo-per-user" className={labelClass}>Limit na klienta</label>
              <input id="promo-per-user" inputMode="numeric" value={draft.per_user_limit} onChange={(event) => update('per_user_limit', event.target.value.replace(/\D/g, ''))} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="promo-expiry" className={labelClass}>Termin ważności kodu</label>
              <input id="promo-expiry" type="datetime-local" disabled={!draft.hasExpiry} value={draft.expires_at} onChange={(event) => update('expires_at', event.target.value)} className={inputClass} />
              <label className="mt-1.5 flex items-center gap-2 text-xs text-[#5d5650]"><input type="checkbox" checked={!draft.hasExpiry} onChange={(event) => update('hasExpiry', !event.target.checked)} className="accent-primary" />Bezterminowo</label>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold text-[#262220]">
            <input type="checkbox" checked={draft.active} onChange={(event) => update('active', event.target.checked)} className="size-4 accent-primary" />
            Kod aktywny
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {draft.id ? (
              <Button type="button" variant="ghost" onClick={remove} disabled={saving} className="text-red-600 hover:bg-red-50 hover:text-red-700"><Trash2 className="size-4" aria-hidden="true" />Usuń</Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
              <Button type="submit" disabled={saving}>{saving && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}Zapisz</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
