'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { ImagePlus, Link2, Pencil, Plus, Sparkles, Trash2, UtensilsCrossed } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MenuImageCropper } from '@/components/warsztat/menu-editor/menu-image-cropper'
import { cn } from '@/lib/utils'
import { DEFAULT_SEASONAL_LABEL, formatPrice } from '@/lib/menu'
import { COVER_IMAGE_ASPECT, isSafeSlideHref, SLIDE_THEME_LABELS, SLIDE_THEMES, untilLabel, warsawDate, type CustomSlide, type SlideTheme } from '@/lib/home-slides'
import type { SlideProduct } from '@/app/api/workshop/home-slides/products/route'

export const SLIDE_PRODUCTS_KEY = '/api/workshop/home-slides/products'
const MAX_CUSTOM = 12

const THEME_SWATCH: Record<SlideTheme, string> = {
  yellow: 'bg-[#f6c234]',
  dark: 'bg-[#1d1410]',
  red: 'bg-[#c8331f]',
  cream: 'bg-[#f7efe3] ring-1 ring-inset ring-zinc-300',
}

async function fetchProducts(url: string): Promise<SlideProduct[]> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Nie udało się wczytać menu.')
  return response.json()
}

export const emptySlide = (): CustomSlide => ({
  id: crypto.randomUUID(),
  badge: '',
  title: '',
  text: '',
  image_url: null,
  image_mode: 'circle',
  product_id: null,
  cta_label: '',
  cta_href: null,
  theme: 'yellow',
  until: null,
})

export function slideFromProduct(product: SlideProduct): CustomSlide {
  return {
    ...emptySlide(),
    product_id: product.id,
    title: product.name.slice(0, 60),
    badge: product.seasonal ? (product.seasonal_label || DEFAULT_SEASONAL_LABEL).slice(0, 30) : 'Polecamy',
    theme: 'red',
    until: product.available_until ? warsawDate(product.available_until) : null,
  }
}

export function useSlideProducts() {
  return useSWR(SLIDE_PRODUCTS_KEY, fetchProducts, { revalidateOnFocus: false })
}

export function CustomSlidesSection({ slides, onAdd, onUpdate, onRemove }: {
  slides: CustomSlide[]
  onAdd: (slide: CustomSlide) => void
  onUpdate: (slide: CustomSlide) => void
  onRemove: (id: string) => void
}) {
  const { data: products = [] } = useSlideProducts()
  const [editing, setEditing] = useState<{ slide: CustomSlide; isNew: boolean } | null>(null)
  const seasonal = products.filter((product) => product.seasonal)
  const usedProducts = new Set(slides.map((slide) => slide.product_id).filter(Boolean))
  const full = slides.length >= MAX_CUSTOM

  return (
    <section aria-labelledby="custom-slides" className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="custom-slides" className="text-sm font-extrabold text-zinc-900">Własne slajdy</h3>
          <p className="text-xs text-zinc-500">Promocja, wydarzenie albo danie z menu – z własnym tekstem, zdjęciem i przyciskiem.</p>
        </div>
        <Button type="button" size="sm" disabled={full} onClick={() => setEditing({ slide: emptySlide(), isNew: true })}>
          <Plus className="size-4" aria-hidden="true" /> Nowy slajd
        </Button>
      </div>

      {slides.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {slides.map((slide) => {
            const product = products.find((item) => item.id === slide.product_id)
            const image = slide.image_url || product?.image
            return (
              <li key={slide.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-zinc-200 p-2">
                <div className={cn('relative size-12 shrink-0 overflow-hidden rounded-lg', THEME_SWATCH[slide.theme])}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {image && (slide.image_url && slide.image_mode === 'cover'
                    ? <img src={image} alt="" className="absolute inset-0 size-full object-cover" />
                    : <img src={image} alt="" className="absolute right-0 top-1/2 size-9 -translate-y-1/2 translate-x-1/4 rounded-full object-cover" />)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-zinc-900">{slide.title || 'Bez tytułu'}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-zinc-500">
                    {product ? <><UtensilsCrossed className="size-3 shrink-0" aria-hidden="true" />{product.name}</> : slide.cta_href ? <><Link2 className="size-3 shrink-0" aria-hidden="true" />{slide.cta_href}</> : 'Bez przycisku'}
                    {slide.until && <span className="shrink-0">{` · do ${untilLabel(slide.until)}`}</span>}
                  </p>
                </div>
                <Button type="button" size="icon" variant="ghost" onClick={() => setEditing({ slide, isNew: false })} aria-label={`Edytuj slajd: ${slide.title}`}><Pencil className="size-4" /></Button>
                <Button type="button" size="icon" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => onRemove(slide.id)} aria-label={`Usuń slajd: ${slide.title}`}><Trash2 className="size-4" /></Button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-4 rounded-xl bg-amber-50 p-3">
        <p className="flex items-center gap-1.5 text-xs font-bold text-amber-900"><Sparkles className="size-3.5" aria-hidden="true" /> Szybko z dań sezonowych</p>
        {seasonal.length === 0 ? (
          <p className="mt-1 text-xs text-amber-800/80">Brak dań sezonowych. Zaznacz „To danie sezonowe” w edytorze menu, a pojawi się tutaj.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {seasonal.map((product) => {
              const used = usedProducts.has(product.id)
              return (
                <button
                  key={product.id}
                  type="button"
                  disabled={used || full}
                  onClick={() => setEditing({ slide: slideFromProduct(product), isNew: true })}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900 hover:border-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {used ? null : <Plus className="size-3" aria-hidden="true" />}
                  {product.name}
                  {used && <span className="text-[10px] font-normal">(na sliderze)</span>}
                  {!product.available && <span className="text-[10px] font-normal text-red-600">wyłączone</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <SlideDialog
        key={editing?.slide.id ?? 'none'}
        state={editing}
        products={products}
        onClose={() => setEditing(null)}
        onSubmit={(slide) => {
          if (editing?.isNew) onAdd(slide)
          else onUpdate(slide)
          setEditing(null)
        }}
      />
    </section>
  )
}

const fieldLabel = 'flex flex-col gap-1.5 text-sm font-semibold text-zinc-700'
const selectClass = 'h-10 w-full min-w-0 rounded-md border border-input bg-white px-3 text-sm font-normal'

function SlideDialog({ state, products, onClose, onSubmit }: {
  state: { slide: CustomSlide; isNew: boolean } | null
  products: SlideProduct[]
  onClose: () => void
  onSubmit: (slide: CustomSlide) => void
}) {
  const [draft, setDraft] = useState<CustomSlide>(() => state?.slide ?? emptySlide())
  const [target, setTarget] = useState<'product' | 'link' | 'none'>(() => (state?.slide.product_id ? 'product' : state?.slide.cta_href ? 'link' : 'none'))
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const update = (patch: Partial<CustomSlide>) => setDraft((current) => ({ ...current, ...patch }))
  const product = products.find((item) => item.id === draft.product_id)
  const cover = draft.image_mode === 'cover'

  useEffect(() => () => { if (cropSrc) URL.revokeObjectURL(cropSrc) }, [cropSrc])

  function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return void toast.error('Wybierz plik graficzny.')
    if (file.size > 25 * 1024 * 1024) return void toast.error('Zdjęcie jest za duże (maks. 25 MB).')
    setCropSrc(URL.createObjectURL(file))
  }

  async function upload(blob: Blob) {
    const form = new FormData()
    form.append('file', blob, 'slide.webp')
    form.append('folder', 'slides')
    const response = await fetch('/api/workshop/menu/image', { method: 'POST', body: form })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error ?? 'Nie udało się wgrać zdjęcia.')
    update({ image_url: result.url })
    setCropSrc(null)
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const href = draft.cta_href?.trim() || null
    if (target === 'product' && !draft.product_id) return void toast.error('Wybierz danie z menu.')
    if (target === 'link' && (!href || !isSafeSlideHref(href))) return void toast.error('Link musi zaczynać się od „/” (np. /menu) albo „https://”.')
    onSubmit({
      ...draft,
      title: draft.title.trim(),
      product_id: target === 'product' ? draft.product_id : null,
      cta_href: target === 'link' ? href : null,
    })
  }

  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{state?.isNew ? 'Nowy slajd' : 'Edytuj slajd'}</DialogTitle>
          <DialogDescription>Zmiany trafią na stronę po kliknięciu „Zapisz” pod sliderem.</DialogDescription>
        </DialogHeader>

        <form id="custom-slide-form" onSubmit={submit} className="flex flex-col gap-4">
          <label className={fieldLabel}>
            Tytuł
            <Input required maxLength={60} value={draft.title} onChange={(event) => update({ title: event.target.value })} placeholder="np. Dyniowy Smash" />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <label className={fieldLabel}>
              Plakietka (opcjonalnie)
              <Input maxLength={30} value={draft.badge} onChange={(event) => update({ badge: event.target.value })} placeholder="np. Halloween" />
            </label>
            <label className={fieldLabel}>
              Pokazuj do (opcjonalnie)
              <Input type="date" value={draft.until ?? ''} onChange={(event) => update({ until: event.target.value || null })} className="block w-full min-w-0" />
            </label>
          </div>
          <label className={fieldLabel}>
            {`Opis${target === 'product' ? ' (puste = opis z menu)' : ' (opcjonalnie)'}`}
            <textarea rows={2} maxLength={240} value={draft.text} onChange={(event) => update({ text: event.target.value })} className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm font-normal" />
          </label>

          <fieldset>
            <legend className="text-sm font-semibold text-zinc-700">Kolor tła</legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {SLIDE_THEMES.map((theme) => (
                <button key={theme} type="button" onClick={() => update({ theme })} aria-pressed={draft.theme === theme} className={cn('flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold', draft.theme === theme ? 'border-zinc-900 ring-2 ring-zinc-900/15' : 'border-zinc-200')}>
                  <span className={cn('size-4 rounded-full', THEME_SWATCH[theme])} aria-hidden="true" />
                  {SLIDE_THEME_LABELS[theme]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold text-zinc-700">Przycisk prowadzi do</legend>
            <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-lg bg-zinc-100 p-1">
              {([['product', 'Dania z menu'], ['link', 'Linku'], ['none', 'Bez przycisku']] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setTarget(value)} aria-pressed={target === value} className={cn('h-8 rounded-md text-xs font-semibold', target === value ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600')}>{label}</button>
              ))}
            </div>
            {target === 'product' && (
              <div className="mt-3 flex flex-col gap-1.5">
                <select aria-label="Danie z menu" value={draft.product_id ?? ''} onChange={(event) => update({ product_id: event.target.value || null })} className={selectClass}>
                  <option value="">— wybierz danie —</option>
                  {products.map((item) => <option key={item.id} value={item.id}>{`${item.seasonal ? '★ ' : ''}${item.name} – ${formatPrice(item.price)}`}</option>)}
                </select>
                <p className="text-xs text-zinc-500">Przycisk otworzy danie do zamówienia. Slajd sam się ukryje, gdy danie zostanie wyłączone.</p>
              </div>
            )}
            {target !== 'none' && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
                <label className={fieldLabel}>
                  Tekst przycisku
                  <Input maxLength={30} value={draft.cta_label} onChange={(event) => update({ cta_label: event.target.value })} placeholder={target === 'product' ? 'Zamów teraz' : 'Sprawdź'} />
                </label>
                {target === 'link' && (
                  <label className={fieldLabel}>
                    Link
                    <Input value={draft.cta_href ?? ''} maxLength={300} onChange={(event) => update({ cta_href: event.target.value })} placeholder="/menu" />
                  </label>
                )}
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold text-zinc-700">Układ zdjęcia</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1">
              {([['circle', 'Zdjęcie w kole'], ['cover', 'Grafika na cały slajd']] as const).map(([value, label]) => (
                <button key={value} type="button" disabled={cropSrc !== null} onClick={() => update({ image_mode: value })} aria-pressed={draft.image_mode === value} className={cn('h-8 rounded-md text-xs font-semibold disabled:opacity-60', draft.image_mode === value ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600')}>{label}</button>
              ))}
            </div>
            {cover && <p className="mt-1.5 text-xs text-zinc-500">Wgraj szeroki baner (proporcje 21:9, np. 2100×900 px). Lewą stronę grafiki zostaw spokojniejszą – tam leży tytuł i przycisk. Bez własnej grafiki slajd pokaże zdjęcie z menu w kole.</p>}
          </fieldset>

          <div>
            <p className="text-sm font-semibold text-zinc-700">{cover ? 'Grafika slajdu' : `Zdjęcie${target === 'product' ? ' (puste = zdjęcie z menu)' : ' (opcjonalnie)'}`}</p>
            {cropSrc ? (
              <div className="mt-1.5">
                {cover
                  ? <MenuImageCropper src={cropSrc} aspect={COVER_IMAGE_ASPECT} maxWidth={2100} hint="Przesuń i przybliż grafikę. Wypełni cały slajd." onCancel={() => setCropSrc(null)} onConfirm={upload} />
                  : <MenuImageCropper src={cropSrc} aspect={1} maxWidth={1000} round hint="Przesuń i przybliż zdjęcie. Na slajdzie wyświetli się w kole." onCancel={() => setCropSrc(null)} onConfirm={upload} />}
              </div>
            ) : (
              <div className="mt-1.5 flex items-center gap-3">
                <div className={cn('flex shrink-0 items-center justify-center overflow-hidden bg-zinc-100 text-zinc-400', cover ? 'aspect-[21/9] w-36 rounded-lg' : 'size-16 rounded-full')}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {draft.image_url || product?.image ? <img src={draft.image_url || product?.image || ''} alt="Podgląd zdjęcia slajdu" className="size-full object-cover" /> : <ImagePlus className="size-5" aria-hidden="true" />}
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => fileInput.current?.click()}><ImagePlus className="size-3.5" aria-hidden="true" />{draft.image_url ? 'Zmień zdjęcie' : 'Wgraj zdjęcie'}</Button>
                {draft.image_url && <Button type="button" size="sm" variant="ghost" onClick={() => update({ image_url: null })}>Usuń</Button>}
                <input ref={fileInput} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={pickFile} />
              </div>
            )}
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Anuluj</Button>
          <Button type="submit" form="custom-slide-form" disabled={cropSrc !== null}>{state?.isNew ? 'Dodaj slajd' : 'Zapisz slajd'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
