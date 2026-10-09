'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Check, Minus, Plus, Star } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useCart } from '@/components/cart/cart-context'
import { formatPrice, type Product, type Station } from '@/lib/menu'
import { availableModifiers, hasConfigurator, resolveSelection } from '@/lib/menu-config'
import { useRestaurantStatus } from '@/lib/use-restaurant-status'
import { stationOpen } from '@/lib/restaurant-status'
import { ProductBadge } from './product-card'
import { ModifierSections, VariantPicker } from './product-configurator'
import { cn } from '@/lib/utils'

export function ProductDialog() {
  const { activeProduct, openProduct } = useCart()

  return (
    <Dialog open={activeProduct !== null} onOpenChange={(open) => !open && openProduct(null)}>
      <DialogContent data-keep-size className="left-0 top-0 h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 gap-0 select-none overflow-y-auto overflow-x-hidden rounded-none p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[92dvh] sm:w-full sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
        {activeProduct && <ProductConfigurator key={activeProduct.id} product={activeProduct} />}
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

  return (
    <div className={cn('grid min-w-0 grid-cols-1', !standalone && 'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]')}>
      <div className={cn('relative aspect-[4/3] min-w-0 bg-cream', !standalone && 'sm:aspect-square md:aspect-auto')}>
        <Image src={product.image || '/placeholder.svg'} alt={product.name} fill sizes="(min-width: 768px) 384px, 100vw" className="object-cover" />
        <p aria-hidden="true" className="absolute bottom-5 left-5 -rotate-6 font-script text-2xl text-primary drop-shadow-sm">
          To jest Yummy!
        </p>
      </div>

      <div className="flex min-w-0 flex-col p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {product.badge && <ProductBadge badge={product.badge} />}
          {product.rating && (
            <span className="inline-flex items-center gap-1 text-sm">
              <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
              <span className="font-semibold">{product.rating.toFixed(1).replace('.', ',')}</span>
              <span className="text-muted-foreground">({product.reviews} opinii)</span>
            </span>
          )}
        </div>
        <Title className="mt-3 break-words text-2xl font-black uppercase tracking-tight [hyphens:auto] sm:text-3xl">{product.name}</Title>
        <Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {product.description}
        </Description>

        {configurable && (
          <>
            <VariantPicker product={product} value={variantId} onChange={setVariantId} />
            {product.modifierGroups && (
              <ModifierSections groups={product.modifierGroups} value={modifiers} onChange={setModifiers} isStationOpen={isStationOpen} />
            )}
          </>
        )}

        {!configurable && product.sizes && (
          <fieldset className="mt-6">
            <legend className="text-sm font-bold">Rozmiar</legend>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {product.sizes.map((s) => {
                const selected = s.id === sizeId
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSizeId(s.id)}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-xl px-2 py-2.5 text-center text-xs font-semibold leading-tight transition-colors',
                      selected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background ring-1 ring-border hover:bg-muted',
                    )}
                  >
                    {s.label}
                    {s.price > 0 && (
                      <span className={cn('mt-0.5 font-normal', selected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                        + {formatPrice(s.price)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        {!configurable && product.extras && (
          <fieldset className="mt-6">
            <legend className="text-sm font-bold">Dodatki <span className="font-normal text-muted-foreground">· opcjonalne</span></legend>
            <ul className="mt-3 divide-y divide-border rounded-xl ring-1 ring-border">
              {product.extras.map((extra) => {
                const checked = extras.includes(extra.id)
                return (
                  <li key={extra.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm hover:bg-muted/60">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleExtra(extra.id)}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={cn(
                          'grid size-5 place-items-center rounded-md ring-1 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary',
                          checked ? 'bg-primary text-primary-foreground ring-primary' : 'bg-card ring-input',
                        )}
                      >
                        {checked && <Check className="size-3.5" strokeWidth={3} />}
                      </span>
                      <span className="flex-1">{extra.label}</span>
                      <span className="text-muted-foreground">+ {formatPrice(extra.price)}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </fieldset>
        )}

        <div className="sticky bottom-0 -mx-4 mt-8 flex flex-wrap items-center gap-3 border-t border-border bg-card px-4 py-3 sm:-mx-6 sm:px-6 md:mt-auto">
          <QuantityStepper value={quantity} onChange={setQuantity} label={product.name} />
          <button
            type="button"
            onClick={handleAdd}
            aria-disabled={Boolean(missingRequired)}
            className={cn(
              'flex h-12 flex-1 items-center justify-between gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90',
              missingRequired && 'opacity-60',
            )}
          >
            <span>{missingRequired ? 'Wybierz opcję' : 'Dodaj do koszyka'}</span>
            <span>{formatPrice(unitPrice * quantity)}</span>
          </button>
          {product.variantLabel && !size && (
            <p className="-mt-1 basis-full truncate text-center text-xs text-muted-foreground">{product.variantLabel}</p>
          )}
        </div>
      </div>
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
  const btn = size === 'sm' ? 'size-7' : 'size-9'
  return (
    <div className={cn('inline-flex items-center rounded-full bg-background ring-1 ring-border', size === 'sm' ? 'p-0.5' : 'p-1.5')}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min && min > 0}
        className={cn('grid place-items-center rounded-full text-foreground transition-colors hover:bg-muted disabled:opacity-40', btn)}
      >
        <Minus className="size-4" aria-hidden="true" />
        <span className="sr-only">Zmniejsz ilość: {label}</span>
      </button>
      <span className="w-7 text-center text-sm font-bold tabular-nums" aria-live="polite">
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
