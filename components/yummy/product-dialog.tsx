'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Check, Info, Minus, Plus, Star, X } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useCart } from '@/components/cart/cart-context'
import { formatPrice, type Product, type Station } from '@/lib/menu'
import { availableModifiers, hasConfigurator, resolveSelection } from '@/lib/menu-config'
import { useRestaurantStatus } from '@/lib/use-restaurant-status'
import { stationOpen } from '@/lib/restaurant-status'
import { ProductBadge } from './product-card'
import { ModifierSections, VariantPicker } from './product-configurator'
import { AllergenIcon } from './allergen-icon'
import { allergenLabel, splitDescription } from '@/lib/allergens'
import { cn } from '@/lib/utils'
import { useBackButtonClose } from '@/lib/use-back-button-close'

export function ProductDialog() {
  const { activeProduct, openProduct } = useCart()
  const [lastProduct, setLastProduct] = useState(activeProduct)
  if (activeProduct && activeProduct !== lastProduct) setLastProduct(activeProduct)
  const shownProduct = activeProduct ?? lastProduct
  const open = activeProduct !== null
  const handleOpenChange = (next: boolean) => {
    if (!next) openProduct(null)
  }
  useBackButtonClose(open, handleOpenChange)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-keep-size
        showCloseButton={false}
        overlayClassName="duration-200 max-sm:bg-card max-sm:backdrop-blur-none max-sm:supports-backdrop-filter:backdrop-blur-none"
        className="inset-0 flex max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 select-none overflow-hidden rounded-none border-0 bg-card p-0 ring-0 duration-200 data-open:slide-in-from-bottom-8 data-open:zoom-in-100 data-closed:slide-out-to-bottom-8 data-closed:zoom-out-100 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[min(720px,90svh)] sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:ring-1 sm:data-open:slide-in-from-bottom-0 sm:data-open:zoom-in-95 sm:data-closed:slide-out-to-bottom-0 sm:data-closed:zoom-out-95 md:h-[min(640px,88svh)] md:max-w-4xl"
      >
        <DialogClose className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 grid size-8 place-items-center rounded-full bg-card text-foreground shadow-md ring-1 ring-black/5 transition-colors hover:bg-muted">
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">Zamknij</span>
        </DialogClose>
        {shownProduct && <ProductConfigurator key={shownProduct.id} product={shownProduct} />}
      </DialogContent>
    </Dialog>
  )
}

export type ProductDraftLine = Parameters<ReturnType<typeof useCart>['addLine']>[0]

function ProductConfigurator({ product }: { product: Product }) {
  const { addLine, openProduct } = useCart()
  return (
    <ProductDetails
      product={product}
      onAdd={(line) => {
        addLine(line)
        toast.success(`${product.name} w koszyku`)
        openProduct(null)
      }}
    />
  )
}

export function ProductDetails({
  product,
  onAdd,
  standalone = false,
}: {
  product: Product
  onAdd: (line: ProductDraftLine) => void
  standalone?: boolean
}) {
  const Title = standalone ? 'h2' : DialogTitle
  const Description = standalone ? 'p' : DialogDescription
  const configurable = hasConfigurator(product)
  const [sizeId, setSizeId] = useState(product.sizes?.[0]?.id)
  const [extras, setExtras] = useState<string[]>([])
  const [variantId, setVariantId] = useState(product.variants?.[0]?.id)
  const [modifiers, setModifiers] = useState<Record<string, string[]>>({})
  const [quantity, setQuantity] = useState(1)
  const [showFullDescription, setShowFullDescription] = useState(false)

  const size = product.sizes?.find((s) => s.id === sizeId)
  const selectedExtras = product.extras?.filter((e) => extras.includes(e.id)) ?? []
  const { status } = useRestaurantStatus()
  const isStationOpen = standalone || !status ? undefined : (station: Station) => stationOpen(status, station)
  const activeModifiers = availableModifiers(product, modifiers, isStationOpen)
  const resolved = configurable ? resolveSelection(product, { variantId, modifiers: activeModifiers }) : null
  const missingRequired = product.modifierGroups?.find((group) => (activeModifiers[group.id]?.length ?? 0) < group.min)
  const unitPrice = resolved?.ok
    ? resolved.unitPrice
    : configurable
      ? (product.variants?.find((variant) => variant.id === variantId)?.price ?? product.price)
      : product.price + (size?.price ?? 0) + selectedExtras.reduce((s, e) => s + e.price, 0)

  const toggleExtra = (id: string) =>
    setExtras((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const handleAdd = () => {
    if (resolved && !resolved.ok) {
      toast.error(resolved.error)
      return
    }
    const details = resolved?.ok
      ? resolved.details
      : [
          ...(size ? [size.label] : product.variantLabel ? [product.variantLabel] : []),
          ...selectedExtras.map((e) => `+ ${e.label.toLowerCase()}`),
        ]
    onAdd({
      productId: product.id,
      name: product.name,
      image: product.image,
      unitPrice,
      quantity,
      details,
      category: product.category,
      ...(resolved?.ok ? { selection: resolved.selection } : {}),
    })
  }

  const split = splitDescription(product.description, product.name)
  const ingredients = product.ingredients && product.ingredients.length > 0 ? product.ingredients : split.ingredients
  const tagline = split.tagline
  const allergens = product.allergens ?? []
  const fromPrice = product.variants && product.variants.length > 1 ? Math.min(...product.variants.map((variant) => variant.price)) : null
  const hasOptions = configurable || Boolean(product.sizes) || Boolean(product.extras)

  return (
    <div className={cn('flex min-w-0 flex-col', !standalone && 'min-h-0 flex-1 md:flex-row')}>
      {!standalone && (
        <div className="relative hidden shrink-0 overflow-hidden bg-cream md:block md:w-[40%]">
          <Image src={product.image || '/placeholder.svg'} alt={product.name} fill sizes="400px" className="object-cover" />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent" />
          <p aria-hidden="true" className="absolute bottom-5 left-5 -rotate-6 font-script text-2xl text-white drop-shadow">
            To jest Yummy!
          </p>
        </div>
      )}

      <div className={cn('flex min-w-0 flex-col', !standalone && 'min-h-0 flex-1')}>
        <div className={cn('min-w-0', !standalone && 'min-h-0 flex-1 overflow-y-auto overscroll-contain')}>
          <div className={cn('relative shrink-0 overflow-hidden bg-cream sm:h-44', standalone ? 'h-32' : 'h-56 md:hidden')}>
            <Image src={product.image || '/placeholder.svg'} alt={product.name} fill sizes="(min-width: 640px) 576px, 100vw" className="object-cover" />
            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent" />
          </div>

          <div className="px-4 pb-3 pt-1 sm:px-6 sm:pt-3 md:pt-6">
            {(product.badge || product.rating) && (
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                {product.badge && <ProductBadge badge={product.badge} />}
                {product.rating && (
                  <span className="inline-flex items-center gap-1 text-[11px]">
                    <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                    <span className="font-semibold">{product.rating.toFixed(1).replace('.', ',')}</span>
                    <span className="text-muted-foreground">({product.reviews})</span>
                  </span>
                )}
              </div>
            )}
            <div className="flex items-baseline justify-between gap-3">
              <Title className="min-w-0 break-words text-lg font-black uppercase leading-tight tracking-tight [hyphens:auto] sm:text-xl md:text-2xl">
                {product.name}
              </Title>
              <p className="shrink-0 text-right text-[15px] font-black tabular-nums text-primary sm:text-lg">
                {fromPrice !== null && <span className="mr-0.5 text-[11px] font-semibold text-muted-foreground">od</span>}
                {formatPrice(fromPrice ?? product.price)}
              </p>
            </div>
            {tagline ? (
              <div className="mt-1">
                <Description className={cn('text-[12.5px] leading-snug text-muted-foreground sm:text-[13px]', !showFullDescription && 'line-clamp-2')}>
                  {tagline}
                </Description>
                {tagline.length > 110 && (
                  <button
                    type="button"
                    onClick={() => setShowFullDescription((value) => !value)}
                    className="mt-0.5 text-[12px] font-semibold text-foreground underline-offset-2 hover:underline"
                  >
                    {showFullDescription ? 'Zwiń' : 'Czytaj więcej'}
                  </button>
                )}
              </div>
            ) : (
              <Description className="sr-only">{product.description}</Description>
            )}

            {ingredients.length > 0 && (
              <p className="mt-2 text-[12px] leading-snug text-foreground/80">
                <span className="font-semibold text-foreground">Skład: </span>
                {ingredients.join(', ')}
              </p>
            )}

            <AllergenStrip allergens={allergens} />
          </div>

          {hasOptions && (
            <div className="flex flex-col gap-4 border-t border-border bg-muted/40 px-4 pb-5 pt-3.5 sm:px-6">
              {configurable && (
                <>
                  <VariantPicker product={product} value={variantId} onChange={setVariantId} />
                  {product.modifierGroups && (
                    <ModifierSections groups={product.modifierGroups} value={modifiers} onChange={setModifiers} isStationOpen={isStationOpen} />
                  )}
                </>
              )}

              {!configurable && product.sizes && (
                <fieldset>
                  <legend className="text-[13px] font-bold">Rozmiar</legend>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {product.sizes.map((s) => {
                      const selected = s.id === sizeId
                      return (
                        <button
                          key={s.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setSizeId(s.id)}
                          className={cn(
                            'flex flex-col items-center justify-center rounded-xl px-2 py-2 text-center text-[12px] font-semibold leading-tight transition-all',
                            selected ? 'bg-primary/5 ring-2 ring-primary' : 'bg-card ring-1 ring-border hover:ring-foreground/30',
                          )}
                        >
                          {s.label}
                          {s.price > 0 && <span className="mt-0.5 text-[11px] font-normal text-muted-foreground">+ {formatPrice(s.price)}</span>}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
              )}

              {!configurable && product.extras && (
                <fieldset>
                  <legend className="text-[13px] font-bold">
                    Dodatki <span className="text-[11px] font-normal text-muted-foreground">· opcjonalne</span>
                  </legend>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {product.extras.map((extra) => {
                      const checked = extras.includes(extra.id)
                      return (
                        <label
                          key={extra.id}
                          className={cn(
                            'flex min-h-11 cursor-pointer items-center gap-2 rounded-xl py-1.5 pl-2.5 pr-2 transition-all',
                            checked ? 'bg-primary/5 ring-2 ring-primary' : 'bg-card ring-1 ring-border hover:ring-foreground/30',
                          )}
                        >
                          <input type="checkbox" checked={checked} onChange={() => toggleExtra(extra.id)} className="peer sr-only" />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="line-clamp-2 text-[12px] font-medium leading-tight">{extra.label}</span>
                            <span className="text-[11px] text-muted-foreground">+ {formatPrice(extra.price)}</span>
                          </span>
                          <span
                            aria-hidden="true"
                            className={cn('grid size-4 shrink-0 place-items-center rounded-[5px]', checked ? 'bg-primary text-primary-foreground' : 'ring-1 ring-input')}
                          >
                            {checked && <Check className="size-2.5" strokeWidth={3.5} />}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              )}
            </div>
          )}
        </div>

        <div
          className={cn(
            'flex shrink-0 items-center gap-2 border-t border-border bg-card px-3 pt-2.5 sm:gap-3 sm:px-6',
            standalone ? 'pb-2.5' : 'pb-[max(0.625rem,env(safe-area-inset-bottom))]',
          )}
        >
          <QuantityStepper value={quantity} onChange={setQuantity} label={product.name} size="sm" />
          <button
            type="button"
            onClick={handleAdd}
            aria-disabled={Boolean(missingRequired)}
            className={cn(
              'flex h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-full bg-primary pl-4 pr-1.5 text-[13px] font-bold text-primary-foreground shadow-md shadow-primary/25 transition-colors hover:bg-primary/90 sm:h-12 sm:text-sm',
              missingRequired && 'opacity-60',
            )}
          >
            <span className="truncate">{missingRequired ? 'Wybierz opcję' : 'Dodaj do koszyka'}</span>
            <span className="shrink-0 rounded-full bg-black/15 px-2.5 py-1.5 tabular-nums">{formatPrice(unitPrice * quantity)}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function AllergenStrip({ allergens }: { allergens: string[] }) {
  if (allergens.length === 0) {
    return (
      <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
        <Info className="mt-px size-3 shrink-0" aria-hidden="true" />
        Informację o alergenach uzyskasz u obsługi.
      </p>
    )
  }
  return (
    <div className="mt-2.5">
      <h3 className="sr-only">Alergeny</h3>
      <ul aria-label="Alergeny" className="flex flex-wrap items-center gap-1">
        <li aria-hidden="true" className="mr-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Alergeny
        </li>
        {allergens.map((id) => (
          <li
            key={id}
            className="inline-flex h-6 items-center gap-1 rounded-full bg-amber-50 pl-1.5 pr-2 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200/80"
          >
            <AllergenIcon id={id} className="size-3" />
            {allergenLabel(id)}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function QuantityStepper({
  value,
  onChange,
  label,
  size = 'md',
  min = 1,
}: {
  value: number
  onChange: (v: number) => void
  label: string
  size?: 'sm' | 'md'
  min?: number
}) {
  const btn = size === 'sm' ? 'size-8' : 'size-9'
  return (
    <div className={cn('inline-flex shrink-0 items-center rounded-full bg-background ring-1 ring-border', size === 'sm' ? 'p-1' : 'p-1.5')}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min && min > 0}
        className={cn('grid place-items-center rounded-full text-foreground transition-colors hover:bg-muted disabled:opacity-40', btn)}
      >
        <Minus className="size-4" aria-hidden="true" />
        <span className="sr-only">Zmniejsz ilość: {label}</span>
      </button>
      <span className="w-6 text-center text-sm font-bold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(20, value + 1))}
        className={cn('grid place-items-center rounded-full text-foreground transition-colors hover:bg-muted', btn)}
      >
        <Plus className="size-4" aria-hidden="true" />
        <span className="sr-only">Zwiększ ilość: {label}</span>
      </button>
    </div>
  )
}
