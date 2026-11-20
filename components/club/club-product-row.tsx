'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Plus, Sparkles, UtensilsCrossed } from 'lucide-react'
import { toast } from 'sonner'
import { useCart } from '@/components/cart/cart-context'
import { formatPrice, type Product } from '@/lib/menu'
import { hasConfigurator } from '@/lib/menu-config'
import { bestPromotionFor, bundlePromotionFor, discountLabel } from '@/lib/promotions'
import { usePromotions } from '@/lib/use-promotions'
import { cn } from '@/lib/utils'
import { isViceProduct } from '@/lib/vice'

export function ClubProductRow({ product, animationDelay }: { product: Product; animationDelay?: number }) {
  const { openProduct, addLine } = useCart()
  const [imageFailed, setImageFailed] = useState(false)
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

  const vice = isViceProduct(product)

  return (
    <article
      className={cn(
        'group relative flex min-w-0 items-stretch gap-3 rounded-3xl p-3 transition-shadow duration-200 sm:flex-col sm:gap-4 sm:p-4',
        vice
          ? 'bg-gradient-to-br from-[#2a0f3d] via-[#1a0b24] to-[#12071a] text-white ring-1 ring-[#ff6fa8]/70 shadow-lg shadow-[#ff6fa8]/20'
          : 'bg-card ring-1 ring-border/70 hover:ring-primary/25 hover:shadow-sm',
        animationDelay !== undefined && 'menu-card-enter',
      )}
      style={animationDelay === undefined ? undefined : { animationDelay: `${animationDelay}ms` }}
    >
      <div
        className={cn(
          'relative aspect-square w-[5.25rem] shrink-0 self-center overflow-hidden rounded-2xl sm:aspect-[16/9] sm:w-full',
          vice ? 'bg-black/30' : 'bg-cream',
        )}
      >
        {product.image && !imageFailed ? (
          <Image
            src={product.image}
            alt=""
            fill
            sizes="(min-width: 1280px) 320px, (min-width: 1024px) 360px, (min-width: 640px) 45vw, 84px"
            onError={() => setImageFailed(true)}
            className="scale-[0.92] object-contain transition-transform duration-500 group-hover:scale-[0.97]"
          />
        ) : (
          <span aria-hidden="true" className={cn('grid size-full place-items-center', vice ? 'text-white/40' : 'text-muted-foreground/45')}>
            <UtensilsCrossed className="size-7 sm:size-9" strokeWidth={1.6} />
          </span>
        )}
        {badgePromotion && (
          <span className="absolute left-1 top-1 rounded-full bg-primary px-1.5 py-px text-[9px] font-black text-primary-foreground shadow-sm sm:text-[10px]">
            {discountLabel(badgePromotion)}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col self-stretch py-0.5 pr-0.5 sm:min-h-32">
        {(vice || product.seasonalLabel || product.badge) && (
          <div className="mb-0.5 flex flex-wrap items-center gap-1">
            {vice && <span className="text-[8px] font-black uppercase tracking-[0.18em] text-[#ffd166] sm:text-[9px]">Grand Theft Yummy VI</span>}
            {product.seasonalLabel && (
              <span className="inline-flex max-w-full items-center gap-0.5 rounded-full bg-amber-500 px-1.5 py-px text-[8px] font-extrabold uppercase tracking-wide text-white sm:text-[10px]">
                <Sparkles className="size-2 shrink-0" aria-hidden="true" />
                <span className="truncate">{product.seasonalLabel}</span>
              </span>
            )}
            {product.badge && (
              <span className="rounded-full bg-primary/10 px-1.5 py-px text-[8px] font-extrabold uppercase tracking-wide text-primary sm:text-[10px]">
                {product.badge}
              </span>
            )}
          </div>
        )}
        <h3
          className={cn(
            'line-clamp-2 text-[17px] font-extrabold leading-[1.15] tracking-tight sm:text-xl',
            vice && 'bg-gradient-to-r from-[#ff6fa8] via-[#ff8a3d] to-[#ffd166] bg-clip-text font-black uppercase italic text-transparent',
          )}
        >
          <button
            type="button"
            onClick={() => openProduct(product)}
            className="text-left after:absolute after:inset-0 after:rounded-[1.75rem] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary"
          >
            {product.name}
          </button>
        </h3>
        {description && (
          <p className={cn('mt-1 line-clamp-2 text-xs leading-snug', vice ? 'text-white/65' : 'text-muted-foreground')}>{description}</p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 tabular-nums [&>span]:whitespace-nowrap [&>s]:whitespace-nowrap">
            {hasPriceRange && <span className={cn('text-xs font-semibold', vice ? 'text-white/60' : 'text-muted-foreground')}>od</span>}
            {promotion ? (
              <>
                <span className="text-base font-extrabold tracking-tight text-primary sm:text-lg">
                  {formatPrice(Math.round(product.price * (100 - Number(promotion.discount_percent))) / 100)}
                </span>
                <s className={cn('text-xs font-medium', vice ? 'text-white/50' : 'text-muted-foreground')}>
                  <span className="sr-only">Cena regularna </span>
                  {formatPrice(product.price)}
                </s>
              </>
            ) : (
              <span className="text-base font-extrabold tracking-tight sm:text-lg">{formatPrice(product.price)}</span>
            )}
          </p>
          <button
            type="button"
            onClick={handleAdd}
            className={cn(
              'relative z-10 grid size-11 shrink-0 place-items-center rounded-full transition-transform hover:scale-105 active:scale-95',
              vice ? 'bg-gradient-to-br from-[#ff6fa8] to-[#ff8a3d] text-white shadow-[#ff6fa8]/40' : 'bg-primary text-primary-foreground shadow-primary/30',
            )}
          >
            <Plus className="size-5" strokeWidth={2.75} aria-hidden="true" />
            <span className="sr-only">{hasOptions ? `Wybierz opcje: ${product.name}` : `Dodaj ${product.name} do koszyka`}</span>
          </button>
        </div>
      </div>
    </article>
  )
}
