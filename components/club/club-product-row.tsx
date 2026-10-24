'use client'

import Image from 'next/image'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useCart } from '@/components/cart/cart-context'
import { formatPrice, type Product } from '@/lib/menu'
import { hasConfigurator } from '@/lib/menu-config'
import { bestPromotionFor, bundlePromotionFor, discountLabel } from '@/lib/promotions'
import { usePromotions } from '@/lib/use-promotions'
import { cn } from '@/lib/utils'

export function ClubProductRow({ product, animationDelay }: { product: Product; animationDelay?: number }) {
  const { openProduct, addLine } = useCart()
  const { promotions, now } = usePromotions()
  const promotion = now ? bestPromotionFor(promotions, { productId: product.id, category: product.category }, 'online', now) : null
  const bundle = now ? bundlePromotionFor(promotions, { productId: product.id, category: product.category }, 'online', now) : null
  const badgePromotion = bundle ?? promotion
  const hasOptions = Boolean(product.sizes?.length || product.extras?.length || hasConfigurator(product))
  const hasPriceRange = new Set(product.variants?.map((variant) => variant.price)).size > 1
  const description = product.description?.trim()

  function handleAdd() {
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
        'relative flex min-w-0 gap-3 rounded-2xl bg-card p-2 pr-3 ring-1 ring-border/70 transition-shadow hover:shadow-md sm:p-2.5 sm:pr-4',
        animationDelay !== undefined && 'menu-card-enter',
      )}
      style={animationDelay === undefined ? undefined : { animationDelay: `${animationDelay}ms` }}
    >
      <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-cream sm:size-28">
        <Image src={product.image || '/placeholder.svg'} alt="" fill sizes="112px" className="object-cover" />
        {badgePromotion && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-black text-primary-foreground shadow-sm">
            {discountLabel(badgePromotion)}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col py-0.5">
        {product.badge && (
          <span className="mb-0.5 text-[10px] font-extrabold uppercase tracking-wide text-primary">{product.badge}</span>
        )}
        <h3 className="line-clamp-2 text-sm font-extrabold leading-snug sm:text-base">
          <button
            type="button"
            onClick={() => openProduct(product)}
            className="text-left after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary"
          >
            {product.name}
          </button>
        </h3>
        {description && <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{description}</p>}

        <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
          <p className="min-w-0 text-sm font-black tabular-nums sm:text-base">
            {hasPriceRange && <span className="mr-1 text-[11px] font-medium text-muted-foreground">od</span>}
            {promotion ? (
              <>
                <span className="text-primary">{formatPrice(Math.round(product.price * (100 - Number(promotion.discount_percent))) / 100)}</span>
                <s className="ml-1 text-[11px] font-medium text-muted-foreground">
                  <span className="sr-only">Cena regularna </span>
                  {formatPrice(product.price)}
                </s>
              </>
            ) : (
              formatPrice(product.price)
            )}
          </p>
          <button
            type="button"
            onClick={handleAdd}
            className="relative z-10 grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/25 transition-transform active:scale-95"
          >
            <Plus className="size-5" aria-hidden="true" />
            <span className="sr-only">{hasOptions ? `Wybierz opcje: ${product.name}` : `Dodaj ${product.name} do koszyka`}</span>
          </button>
        </div>
      </div>
    </article>
  )
}
