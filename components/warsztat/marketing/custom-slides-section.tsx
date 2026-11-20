'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Crop, ImagePlus, Link2, Monitor, Pencil, Plus, Smartphone, Sparkles, Trash2, UtensilsCrossed } from 'lucide-react'
import { SlideImageCropper, type SlideCropResult } from './slide-image-cropper'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { DEFAULT_SEASONAL_LABEL, formatPrice } from '@/lib/menu'
import { isSafeSlideHref, PRODUCT_SLIDE_KINDS, SLIDE_KIND_HINTS, SLIDE_KIND_LABELS, SLIDE_KINDS, type SlideKind, SLIDE_THEME_LABELS, SLIDE_THEMES, untilLabel, warsawDate, type CustomSlide, type SlideTheme } from '@/lib/home-slides'
import type { SlideProduct } from '@/app/api/workshop/home-slides/products/route'
import { describeSchedule, discountLabel, isPromotionRunning, type Promotion } from '@/lib/promotions'
import { useWorkshopPromotions } from '@/lib/use-workshop-promotions'
import { BadgePercent } from 'lucide-react'

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
  kind: 'other',
  badge: '',
  title: '',
  text: '',
  image_url: null,
  image_mobile_url: null,
  image_mode: 'circle',
  product_id: null,
  cta_label: '',
  cta_href: null,
  theme: 'yellow',
  until: null,
  promotion_id: null,
})

export function slideFromProduct(product: SlideProduct): CustomSlide {
  return {
    ...emptySlide(),
    kind: product.seasonal ? 'seasonal' : 'dish',
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
  const { data: promotionData } = useWorkshopPromotions()
  const promotions = promotionData?.promotions ?? []
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
            const promotion = promotions.find((item) => item.id === slide.promotion_id)
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
                  <p className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm font-bold text-zinc-900">{slide.title || 'Bez tytułu'}</span>
                    <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">{SLIDE_KIND_LABELS[slide.kind]}</span>
                  </p>
                  <p className="flex items-center gap-1 truncate text-xs text-zinc-500">
                    {product ? <><UtensilsCrossed className="size-3 shrink-0" aria-hidden="true" />{product.name}</> : slide.cta_href ? <><Link2 className="size-3 shrink-0" aria-hidden="true" />{slide.cta_href}</> : 'Bez przycisku'}
                    {slide.until && <span className="shrink-0">{` · do ${untilLabel(slide.until)}`}</span>}
                  </p>
                  {promotion && (
                    <p className="flex items-center gap-1 truncate text-xs text-zinc-500">
                      <BadgePercent className="size-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{promotion.title}</span>
                      <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold', isPromotionRunning(promotion) ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500')}>{isPromotionRunning(promotion) ? 'teraz widoczny' : 'czeka na promocję'}</span>
                    </p>
                  )}
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
        promotions={promotions}
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

function SlideDialog({ state, products, promotions, onClose, onSubmit }: {
  state: { slide: CustomSlide; isNew: boolean } | null
  products: SlideProduct[]
  promotions: Promotion[]
  onClose: () => void
  onSubmit: (slide: CustomSlide) => void
}) {
  const [draft, setDraft] = useState<CustomSlide>(() => state?.slide ?? emptySlide())
  const [target, setTarget] = useState<'product' | 'link' | 'none'>(() => (state?.slide.product_id ? 'product' : state?.slide.cta_href ? 'link' : 'none'))
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [originalSrc, setOriginalSrc] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const update = (patch: Partial<CustomSlide>) => setDraft((current) => ({ ...current, ...patch }))
  const product = products.find((item) => item.id === draft.product_id)
  const cover = draft.image_mode === 'cover'
  const pickable = draft.kind === 'seasonal' && products.some((item) => item.seasonal) ? products.filter((item) => item.seasonal || item.id === draft.product_id) : products

  const linkedPromotion = draft.kind === 'promo' ? promotions.find((item) => item.id === draft.promotion_id) : undefined

  function pickPromotion(id: string) {
    const promotion = promotions.find((item) => item.id === id)
    if (!promotion) return update({ promotion_id: null })
    update({
      promotion_id: promotion.id,
      title: draft.title || promotion.title.slice(0, 60),
      badge: draft.badge || 'Promocja',
      until: draft.until ?? promotion.valid_to,
    })
    if (target === 'none') {
      setTarget('link')
      update({ cta_href: draft.cta_href || '/menu' })
    }
  }

  function pickKind(kind: SlideKind) {
    update({ kind })
    if (PRODUCT_SLIDE_KINDS.includes(kind) && target === 'none') setTarget('product')
  }

  // The original upload stays in memory for the whole dialog, so re-cropping never loses quality.
  useEffect(() => () => { if (originalSrc) URL.revokeObjectURL(originalSrc) }, [originalSrc])
  const recropSource = originalSrc || draft.image_url || product?.image || null

  function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return void toast.error('Wybierz plik graficzny.')
    if (file.size > 25 * 1024 * 1024) return void toast.error('Zdjęcie jest za duże (maks. 25 MB).')
    const url = URL.createObjectURL(file)
    setOriginalSrc(url)
    setCropSrc(url)
  }

  function pickMode(mode: CustomSlide['image_mode']) {
    if (mode === draft.image_mode) return
    update({ image_mode: mode, image_mobile_url: null })
    if (recropSource) setCropSrc(recropSource)
  }

  async function uploadOne(blob: Blob, name: string) {
    const form = new FormData()
    form.append('file', blob, name)
    form.append('folder', 'slides')
    const response = await fetch('/api/workshop/menu/image', { method: 'POST', body: form })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error ?? 'Nie udało się wgrać zdjęcia.')
    return result.url as string
  }

  async function upload({ desktop, mobile }: SlideCropResult) {
    const [desktopUrl, mobileUrl] = await Promise.all([uploadOne(desktop, 'slide.webp'), uploadOne(mobile, 'slide-mobile.webp')])
    update({ image_url: desktopUrl, image_mobile_url: mobileUrl })
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
      promotion_id: draft.kind === 'promo' ? draft.promotion_id : null,
    })
  }

  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{state?.isNew ? 'Nowy slajd' : 'Edytuj slajd'}</DialogTitle>
          <DialogDescription>Zmiany trafią na stronę po kliknięciu „Zapisz” pod sliderem.</DialogDescription>
        </DialogHeader>

        <form id="custom-slide-form" onSubmit={submit} className="flex flex-col gap-4">
          <fieldset>
            <legend className="text-sm font-semibold text-zinc-700">Czego dotyczy ta grafika?</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {SLIDE_KINDS.map((kind) => (
                <button key={kind} type="button" onClick={() => pickKind(kind)} aria-pressed={draft.kind === kind} className={cn('h-8 rounded-full border px-3 text-xs font-semibold', draft.kind === kind ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 text-zinc-700 hover:border-zinc-400')}>
                  {SLIDE_KIND_LABELS[kind]}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">{SLIDE_KIND_HINTS[draft.kind]}{PRODUCT_SLIDE_KINDS.includes(draft.kind) ? ' Podepnij niżej danie z menu, a przycisk otworzy je do zamówienia.' : ''}</p>
          </fieldset>

          {draft.kind === 'promo' && (
            <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <label className={fieldLabel}>
                <span className="flex items-center gap-1.5"><BadgePercent className="size-4 text-amber-700" aria-hidden="true" /> Podepnij promocję (opcjonalnie)</span>
                <select value={draft.promotion_id ?? ''} onChange={(event) => pickPromotion(event.target.value)} className={selectClass}>
                  <option value="">— bez powiązania, slajd widoczny zawsze —</option>
                  {promotions.map((item) => <option key={item.id} value={item.id}>{`${item.title} · ${discountLabel(item)}${item.active ? '' : ' (wyłączona)'}`}</option>)}
                </select>
              </label>
              {linkedPromotion ? (
                <div className="text-xs text-amber-900">
                  <p>Slajd pojawi się sam, <strong>tylko gdy promocja działa</strong>: {describeSchedule(linkedPromotion)}{linkedPromotion.valid_from ? `, od ${untilLabel(linkedPromotion.valid_from)}` : ''}{linkedPromotion.valid_to ? `, do ${untilLabel(linkedPromotion.valid_to)}` : ''}.</p>
                  <p className="mt-1">Użyje gotowego szablonu promocji z dużym hasłem „{linkedPromotion.headline || discountLabel(linkedPromotion)}” i okrągłą pieczątką. Zdjęcie w kole jest opcjonalne; grafika na cały slajd zastępuje szablon.</p>
                  {!linkedPromotion.active && <p className="mt-1 font-semibold text-red-700">Ta promocja jest wyłączona – slajd się nie pokaże, dopóki jej nie włączysz.</p>}
                  {linkedPromotion.active && !linkedPromotion.online && <p className="mt-1 font-semibold text-red-700">Promocja działa tylko na miejscu – slajd na stronie się nie pokaże.</p>}
                </div>
              ) : (
                <p className="text-xs text-amber-900/80">Wybierz promocję z zakładki Promocje, a slajd sam włączy się i wyłączy razem z nią (dni, godziny, daty).</p>
              )}
            </div>
          )}

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
                  {pickable.map((item) => <option key={item.id} value={item.id}>{`${item.seasonal ? '★ ' : ''}${item.name} – ${formatPrice(item.price)}`}</option>)}
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
                <button key={value} type="button" disabled={cropSrc !== null} onClick={() => pickMode(value)} aria-pressed={draft.image_mode === value} className={cn('h-8 rounded-md text-xs font-semibold disabled:opacity-60', draft.image_mode === value ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600')}>{label}</button>
              ))}
            </div>
            {cover
              ? <p className="mt-1.5 text-xs text-zinc-500">Wgraj szeroki baner (proporcje 21:9, najlepiej 2100×900 px, minimum 1400×600 px). Lewą stronę grafiki zostaw spokojniejszą – tam leży tytuł i przycisk. Bez własnej grafiki slajd pokaże zdjęcie z menu w kole.</p>
              : <p className="mt-1.5 text-xs text-zinc-500">Najlepiej kwadratowe zdjęcie 1000×1000 px (minimum 600×600 px). Na komputerze pokaże się w kole, na telefonie w zaokrąglonym kwadracie – każdy kadr ustawisz osobno.</p>}
            <p className="mt-1 text-xs text-zinc-500">Możesz wgrać JPG, PNG lub WebP – grafika zostanie automatycznie zmniejszona i zapisana jako WebP.</p>
          </fieldset>

          <div>
            <p className="text-sm font-semibold text-zinc-700">{cover ? 'Grafika slajdu' : `Zdjęcie${target === 'product' ? ' (puste = zdjęcie z menu)' : ' (opcjonalnie)'}`}</p>
            {cropSrc ? (
              <div className="mt-1.5">
                <SlideImageCropper
                  key={`${cropSrc}-${draft.image_mode}`}
                  src={cropSrc}
                  mode={draft.image_mode}
                  theme={draft.theme}
                  title={draft.title}
                  badge={draft.badge}
                  onCancel={() => setCropSrc(null)}
                  onConfirm={upload}
                />
              </div>
            ) : (
              <div className="mt-1.5 flex flex-col gap-2">
                {(draft.image_url || product?.image) && (
                  <div className="flex items-end gap-3">
                    <figure className="flex flex-col gap-1">
                      <figcaption className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500"><Monitor className="size-3" aria-hidden="true" />Komputer</figcaption>
                      <div className={cn('overflow-hidden bg-zinc-100', cover ? 'aspect-[21/9] w-36 rounded-lg' : 'size-16 rounded-full')}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={draft.image_url || product?.image || ''} alt="Kadr slajdu na komputer" className="size-full object-cover" />
                      </div>
                    </figure>
                    <figure className="flex flex-col gap-1">
                      <figcaption className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500"><Smartphone className="size-3" aria-hidden="true" />Telefon</figcaption>
                      <div className={cn('overflow-hidden bg-zinc-100', cover ? 'aspect-[4/3] w-20 rounded-lg' : 'size-16 rounded-xl')}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={draft.image_mobile_url || draft.image_url || product?.image || ''} alt="Kadr slajdu na telefon" className={cn('size-full object-cover', cover && !draft.image_mobile_url && 'object-right')} />
                      </div>
                    </figure>
                  </div>
                )}
                {draft.image_url && !draft.image_mobile_url && <p className="text-xs text-amber-700">Brak osobnego kadru na telefon – kliknij „Kadruj”, żeby go ustawić.</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => fileInput.current?.click()}><ImagePlus className="size-3.5" aria-hidden="true" />{draft.image_url ? 'Zmień zdjęcie' : 'Wgraj zdjęcie'}</Button>
                  {recropSource && <Button type="button" size="sm" variant="outline" onClick={() => setCropSrc(recropSource)}><Crop className="size-3.5" aria-hidden="true" />Kadruj PC i telefon</Button>}
                  {draft.image_url && <Button type="button" size="sm" variant="ghost" onClick={() => { update({ image_url: null, image_mobile_url: null }); setOriginalSrc(null) }}>Usuń</Button>}
                  <input ref={fileInput} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={pickFile} />
                </div>
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
