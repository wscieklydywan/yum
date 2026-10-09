'use client'

import Image from 'next/image'
import { Flame, Plus, Star } from 'lucide-react'
import { toast } from 'sonner'
import { useCart } from '@/components/cart/cart-context'
import { formatPrice, type Product } from '@/lib/menu'
import { hasConfigurator } from '@/lib/menu-config'
import { cn } from '@/lib/utils'

export function ProductBadge({ badge, className }: { badge: NonNullable<Product['badge']>; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
        badge === 'Nowość' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground',
        className,
      )}
    >
      {badge !== 'Nowość' && <Flame className="size-3" aria-hidden="true" />}
      {badge}
    </span>
  )
}

export function ProductCard({ product, animationDelay }: { product: Product; animationDelay?: number }) {
  const { openProduct, addLine } = useCart()
  const hasOptions = Boolean(product.sizes?.length || product.extras?.length || hasConfigurator(product))

  const handleAdd = () => {
    if (hasOptions) {
      openProduct(product)
      return
    }
    addLine({
      productId: product.id,
      name: product.name,
      image: product.image,
      unitPrice: product.price,
      quantity: 1,
      details: product.variantLabel ? [product.variantLabel] : [],
      category: product.category,
    })
    toast.success(`${product.name} w koszyku`)
  }

  return (
    <article
      className={cn(
        'group flex flex-col overflow-hidden rounded-3xl bg-card shadow-sm ring-1 ring-border transition-shadow hover:shadow-lg',
        animationDelay !== undefined && 'menu-card-enter',
      )}
      style={animationDelay === undefined ? undefined : { animationDelay: `${animationDelay}ms` }}
    >
      <button
        type="button"
        onClick={() => openProduct(product)}
        className="relative aspect-[4/3] overflow-hidden bg-cream sm:aspect-[4/3]"
        aria-label={`Szczegóły: ${product.name}`}
      >
        <Image
          src={product.image || '/placeholder.svg'}
          alt=""
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {product.badge && <ProductBadge badge={product.badge} className="absolute left-3 top-3 shadow-sm" />}
      </button>

      <div className="flex flex-1 flex-col p-2.5 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[13px] font-bold leading-tight sm:text-lg">{product.name}</h3>
          {product.rating && (
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold">
              <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
              {product.rating.toFixed(1).replace('.', ',')}
            </span>
          )}
        </div>
        {product.description?.trim() && (
          <p className="mt-1.5 line-clamp-2 min-h-[2lh] text-xs leading-relaxed text-muted-foreground sm:mt-2 sm:text-sm">{product.description}</p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-2 sm:pt-4">
          <p className="min-w-0 whitespace-nowrap text-sm font-black sm:text-xl">
            {new Set(product.variants?.map((variant) => variant.price)).size > 1 && (
              <span className="mr-1 text-xs font-medium text-muted-foreground sm:text-sm">od</span>
            )}
            {formatPrice(product.price)}
          </p>
          <button
            type="button"
            onClick={handleAdd}
            className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/30 transition-transform hover:scale-105 active:scale-95 sm:size-11"
          >
            <Plus className="size-5" aria-hidden="true" />
            <span className="sr-only">Dodaj {product.name} do koszyka</span>
          </button>
        </div>
      </div>
    </article>
  )
}
