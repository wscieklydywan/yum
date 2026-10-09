'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ImagePlus, LoaderCircle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PrizeWheel } from '@/components/yummy/prize-wheel'
import { cn } from '@/lib/utils'
import {
  WHEEL_ICONS,
  WHEEL_REWARD_LABELS,
  WHEEL_REWARD_TYPES,
  formatChance,
  parseChance,
  rewardSummary,
  wheelIcon,
  type WheelPrizeAdmin,
  type WheelRewardType,
} from '@/lib/wheel'
import { MenuImageCropper } from '../menu-editor/menu-image-cropper'
import { cleanDecimal, inputClass, labelClass } from '../menu-editor/form-styles'

export type WheelProduct = { id: string; name: string; image: string | null; price: number }

type Draft = {
  id?: string
  label: string
  description: string
  reward_type: WheelRewardType
  points: string
  product_id: string
  discount_value: string
  coupon_hours: string
  chance: string
  visual: 'image' | 'icon'
  image: string
  icon: string
  active: boolean
}

function toDraft(prize: WheelPrizeAdmin | null): Draft {
  if (!prize) {
    return { label: '', description: '', reward_type: 'points', points: '50', product_id: '', discount_value: '10', coupon_hours: '24', chance: '5', visual: 'icon', image: '', icon: 'gift', active: true }
  }
  return {
    id: prize.id,
    label: prize.label,
    description: prize.description,
    reward_type: prize.reward_type,
    points: String(prize.points || 50),
    product_id: prize.product_id ?? '',
    discount_value: String(prize.discount_value || 10).replace('.', ','),
    coupon_hours: String(prize.coupon_hours || 24),
    chance: String(prize.chance).replace('.', ','),
    visual: prize.visual,
    image: prize.image,
    icon: prize.icon,
    active: prize.active,
  }
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0 rounded-2xl border border-[#ece6df] bg-white p-3.5 sm:p-4">
      <legend className="sr-only">{title}</legend>
      <p className="text-sm font-bold text-[#262220]">{title}</p>
      {hint && <p className="mt-0.5 text-[11px] text-[#8b827a]">{hint}</p>}
      <div className="mt-3">{children}</div>
    </fieldset>
  )
}

export function WheelPrizeEditor({
  open,
  onOpenChange,
  prize,
  prizes,
  products,
  totalChance,
  onSave,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  prize: WheelPrizeAdmin | null
  prizes: WheelPrizeAdmin[]
  products: WheelProduct[]
  totalChance: number
  onSave: (payload: Record<string, unknown>, isNew: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(prize))
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    setDraft(toDraft(prize))
    setCropSrc(null)
    setConfirmDelete(false)
  }, [open, prize])

  useEffect(() => () => { if (cropSrc) URL.revokeObjectURL(cropSrc) }, [cropSrc])

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const product = products.find((item) => item.id === draft.product_id)
  const chance = parseChance(draft.chance)
  const otherChance = totalChance - (prize?.active ? prize.chance : 0)
  const projectedTotal = otherChance + (draft.active && Number.isFinite(chance) ? chance : 0)
  const realChance = projectedTotal > 0 && Number.isFinite(chance) && draft.active ? (chance / projectedTotal) * 100 : 0

  const previewPrize: WheelPrizeAdmin = {
    id: draft.id ?? 'draft',
    sort: prize?.sort ?? 999,
    label: draft.label || 'Nagroda',
    description: draft.description,
    reward_type: draft.reward_type,
    points: Number(draft.points) || 0,
    product_id: draft.product_id || null,
    product_name: product?.name ?? '',
    discount_value: Number(cleanDecimal(draft.discount_value)) || 0,
    coupon_hours: Number(draft.coupon_hours) || 24,
    chance: Number.isFinite(chance) ? chance : 0,
    visual: draft.visual,
    image: draft.image,
    icon: draft.icon,
    active: draft.active,
  }
  const activePrizes = prizes.filter((item) => item.active && item.id !== draft.id)
  const previewList = [...activePrizes, ...(draft.active || !draft.id ? [previewPrize] : [])].sort((a, b) => a.sort - b.sort)
  const highlight = previewList.findIndex((item) => item.id === previewPrize.id)

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
    form.append('file', blob, 'wheel.webp')
    form.append('folder', 'wheel')
    const response = await fetch('/api/workshop/menu/image', { method: 'POST', body: form })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error ?? 'Nie udało się wgrać zdjęcia.')
    setDraft((current) => ({ ...current, visual: 'image', image: result.url }))
    setCropSrc(null)
    toast.success(`Zdjęcie wgrane (${Math.round(blob.size / 1024)} KB, WebP)`)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!Number.isFinite(chance)) return void toast.error('Podaj poprawną szansę, np. 0,1')
    setSaving(true)
    try {
      await onSave(
        {
          id: draft.id,
          label: draft.label,
          description: draft.description,
          reward_type: draft.reward_type,
          points: Number(draft.points),
          product_id: draft.product_id,
          discount_value: Number(cleanDecimal(draft.discount_value)),
          coupon_hours: Number(draft.coupon_hours),
          chance,
          visual: draft.visual,
          image: draft.image,
          icon: draft.icon,
          active: draft.active,
        },
        !draft.id,
      )
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się zapisać nagrody.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!draft.id) return
    setSaving(true)
    try {
      await onDelete(draft.id)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się usunąć nagrody.')
    } finally {
      setSaving(false)
    }
  }

  const productsWithImages = products.filter((item) => item.image)

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl lg:max-w-5xl">
        <DialogHeader className="border-b border-[#ece6df] px-4 py-3.5 sm:px-5">
          <DialogTitle>{draft.id ? 'Edytuj nagrodę' : 'Nowa nagroda'}</DialogTitle>
          <DialogDescription>Ustaw co daje pole koła, jego wygląd i szansę na wylosowanie.</DialogDescription>
        </DialogHeader>

        {cropSrc ? (
          <div className="overflow-y-auto p-4 sm:p-5">
            <MenuImageCropper
              src={cropSrc}
              aspect={1}
              maxWidth={480}
              round
              hint="Przesuń i przybliż zdjęcie. Okrągły kadr odpowiada polu na kole. Zdjęcie zostanie automatycznie skompresowane do WebP."
              onCancel={() => setCropSrc(null)}
              onConfirm={uploadCropped}
            />
          </div>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto overscroll-contain bg-[#faf7f3] p-4 pb-6 sm:p-5 lg:grid-cols-[1fr_300px]">
              <div className="flex min-w-0 flex-col gap-3">
                <Section title="Nazwa">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className={labelClass}>Nazwa na kole</span>
                      <input required maxLength={24} value={draft.label} onChange={(event) => update('label', event.target.value)} className={inputClass} placeholder="np. Burger" />
                    </label>
                    <label>
                      <span className={labelClass}>Opis (opcjonalnie)</span>
                      <input maxLength={80} value={draft.description} onChange={(event) => update('description', event.target.value)} className={inputClass} placeholder="np. Burger klasyczny" />
                    </label>
                  </div>
                </Section>

                <Section title="Nagroda" hint="Kupony (darmowa pozycja i rabaty) trafiają do zakładki kuponów klienta.">
                  <div role="radiogroup" aria-label="Typ nagrody" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {WHEEL_REWARD_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        role="radio"
                        aria-checked={draft.reward_type === type}
                        onClick={() => update('reward_type', type)}
                        className={cn(
                          'min-h-10 rounded-xl border-2 px-2 py-1.5 text-xs font-bold transition-colors',
                          draft.reward_type === type ? 'border-primary bg-primary/5 text-primary' : 'border-[#ece6df] text-[#5f5852] hover:border-[#d8cfc6]',
                        )}
                      >
                        {WHEEL_REWARD_LABELS[type]}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {draft.reward_type === 'points' && (
                      <label>
                        <span className={labelClass}>Liczba punktów</span>
                        <input inputMode="numeric" value={draft.points} onChange={(event) => update('points', event.target.value.replace(/\D/g, ''))} className={inputClass} />
                      </label>
                    )}
                    {draft.reward_type === 'free_item' && (
                      <label className="sm:col-span-2">
                        <span className={labelClass}>Pozycja z menu</span>
                        <select value={draft.product_id} onChange={(event) => update('product_id', event.target.value)} className={inputClass}>
                          <option value="">Wybierz pozycję…</option>
                          {products.map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    {draft.reward_type.startsWith('discount') && (
                      <label>
                        <span className={labelClass}>{draft.reward_type === 'discount_percent' ? 'Rabat (%)' : 'Rabat (zł)'}</span>
                        <input inputMode="decimal" value={draft.discount_value} onChange={(event) => update('discount_value', event.target.value.replace(/[^\d,.]/g, ''))} className={inputClass} />
                      </label>
                    )}
                    {(draft.reward_type === 'free_item' || draft.reward_type.startsWith('discount')) && (
                      <label>
                        <span className={labelClass}>Ważność kuponu (godz.)</span>
                        <input inputMode="numeric" value={draft.coupon_hours} onChange={(event) => update('coupon_hours', event.target.value.replace(/\D/g, ''))} className={inputClass} />
                      </label>
                    )}
                  </div>
                </Section>

                <Section title="Szansa na wylosowanie" hint="Dokładność do 0,001%. Rzeczywista szansa to udział w sumie szans wszystkich aktywnych pól.">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className={labelClass}>Szansa (%)</span>
                      <div className="relative">
                        <input inputMode="decimal" value={draft.chance} onChange={(event) => update('chance', event.target.value.replace(/[^\d,.]/g, ''))} className={`${inputClass} pr-8`} placeholder="np. 0,1" />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#8b827a]">%</span>
                      </div>
                    </label>
                    <div className="rounded-xl bg-[#f6f1eb] px-3 py-2 text-xs text-[#5f5852]">
                      <p>Suma aktywnych pól: <strong className="tabular-nums text-[#262220]">{formatChance(projectedTotal)}</strong></p>
                      <p className="mt-0.5">Rzeczywista szansa: <strong className="tabular-nums text-primary">{formatChance(Math.round(realChance * 1000) / 1000)}</strong></p>
                    </div>
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#262220]">
                    <input type="checkbox" checked={draft.active} onChange={(event) => update('active', event.target.checked)} className="size-4 accent-primary" />
                    Pole aktywne na kole
                  </label>
                </Section>

                <Section title="Wygląd pola" hint="Zdjęcie z menu strony głównej, ikona z paczki lub własne zdjęcie (kompresja do WebP).">
                  <div role="radiogroup" aria-label="Rodzaj grafiki" className="mb-3 inline-flex rounded-xl bg-[#f1ece6] p-1">
                    {(['image', 'icon'] as const).map((visual) => (
                      <button
                        key={visual}
                        type="button"
                        role="radio"
                        aria-checked={draft.visual === visual}
                        onClick={() => update('visual', visual)}
                        className={cn('rounded-lg px-3 py-1.5 text-xs font-bold transition-colors', draft.visual === visual ? 'bg-white text-[#262220] shadow-sm' : 'text-[#7a726a]')}
                      >
                        {visual === 'image' ? 'Zdjęcie' : 'Ikona'}
                      </button>
                    ))}
                  </div>
                  {draft.visual === 'image' ? (
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-full border-2 border-dashed border-[#d8cfc6] text-[10px] font-bold text-[#7a726a] transition-colors hover:border-primary hover:text-primary">
                        <ImagePlus className="size-5" aria-hidden="true" />
                        Własne
                        <input type="file" accept="image/*" onChange={pickFile} className="sr-only" />
                      </label>
                      {draft.image && !productsWithImages.some((item) => item.image === draft.image) && (
                        <button type="button" aria-pressed="true" className="relative aspect-square overflow-hidden rounded-full ring-[3px] ring-primary ring-offset-2">
                          <Image src={draft.image} alt="Wybrane własne zdjęcie" fill sizes="80px" className="object-cover" />
                        </button>
                      )}
                      {productsWithImages.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          aria-pressed={draft.image === item.image}
                          title={item.name}
                          onClick={() => update('image', item.image ?? '')}
                          className={cn('relative aspect-square overflow-hidden rounded-full bg-[#f1ece6] transition-shadow', draft.image === item.image ? 'ring-[3px] ring-primary ring-offset-2' : 'hover:ring-2 hover:ring-[#d8cfc6]')}
                        >
                          <Image src={item.image ?? ''} alt={item.name} fill sizes="80px" className="object-cover" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
                      {Object.entries(WHEEL_ICONS).map(([key, { icon: Icon, label }]) => (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={draft.icon === key}
                          aria-label={label}
                          title={label}
                          onClick={() => update('icon', key)}
                          className={cn('grid aspect-square place-items-center rounded-xl border-2 transition-colors', draft.icon === key ? 'border-primary bg-primary/5 text-primary' : 'border-[#ece6df] text-[#5f5852] hover:border-[#d8cfc6]')}
                        >
                          <Icon className="size-5" aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  )}
                </Section>
              </div>

              <aside className="flex flex-col gap-3 lg:sticky lg:top-0 lg:self-start">
                <div className="rounded-2xl border border-[#ece6df] bg-white p-4">
                  <p className={labelClass}>Podgląd koła</p>
                  <div className="mx-auto w-full max-w-[220px] [container-type:inline-size]">
                    <PrizeWheel prizes={previewList} highlight={highlight >= 0 ? highlight : undefined} className="max-w-full" />
                  </div>
                  <PrizeRow prize={previewPrize} />
                </div>
              </aside>
            </div>

            <div className="flex items-center gap-2 border-t border-[#ece6df] bg-white px-4 py-3 sm:px-5">
              {draft.id && (
                confirmDelete ? (
                  <Button type="button" variant="destructive" disabled={saving} onClick={remove}>Potwierdź usunięcie</Button>
                ) : (
                  <Button type="button" variant="ghost" disabled={saving} onClick={() => setConfirmDelete(true)} className="text-red-600 hover:bg-red-50 hover:text-red-700">
                    <Trash2 className="size-4" aria-hidden="true" />
                    Usuń
                  </Button>
                )
              )}
              <div className="ml-auto flex gap-2">
                <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Anuluj</Button>
                <Button type="submit" disabled={saving}>
                  {saving && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
                  {draft.id ? 'Zapisz' : 'Dodaj nagrodę'}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function PrizeRow({ prize }: { prize: WheelPrizeAdmin }) {
  const Icon = wheelIcon(prize.icon)
  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl bg-[#faf7f3] p-2">
      <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-primary">
        {prize.visual === 'image' && prize.image ? <Image src={prize.image} alt="" fill sizes="40px" className="object-cover" /> : <Icon className="size-5" aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[#262220]">{prize.label}</span>
        <span className="block truncate text-xs text-[#8b827a]">{prize.description || WHEEL_REWARD_LABELS[prize.reward_type]}</span>
      </span>
      <span className="max-w-[45%] shrink-0 truncate text-xs font-bold text-primary">{rewardSummary(prize)}</span>
    </div>
  )
}
