'use client'

import Image from 'next/image'
import { Flame, Plus, Sparkles, Star, TreePalm } from 'lucide-react'
import { isViceProduct } from '@/lib/vice'
import { toast } from 'sonner'
import { useCart } from '@/components/cart/cart-context'
import { formatPrice, type Product } from '@/lib/menu'
import { hasConfigurator } from '@/lib/menu-config'
import { cn } from '@/lib/utils'
import { bestPromotionFor, bundlePromotionFor, discountLabel } from '@/lib/promotions'
import { usePromotions } from '@/lib/use-promotions'

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

export function SeasonalBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-[11rem] items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white',
        className,
      )}
    >
      <Sparkles className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  )
}

export function ProductCard({ product, animationDelay }: { product: Product; animationDelay?: number }) {
  const { openProduct, addLine } = useCart()
  const { promotions, now } = usePromotions()
  const promotion = now ? bestPromotionFor(promotions, { productId: product.id, category: product.category }, 'online', now) : null
  const bundle = now ? bundlePromotionFor(promotions, { productId: product.id, category: product.category }, 'online', now) : null
  const badgePromotion = bundle ?? promotion
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

  const vice = isViceProduct(product)

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl p-1.5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl sm:rounded-3xl sm:p-2',
        vice
          ? 'bg-gradient-to-b from-[#2a0f3d] via-[#1a0b24] to-[#12071a] text-white ring-2 ring-[#ff6fa8] shadow-[#ff6fa8]/25 hover:shadow-[#ff6fa8]/40'
          : 'bg-card ring-1 ring-border/70 hover:shadow-foreground/10',
        animationDelay !== undefined && 'menu-card-enter',
      )}
      style={animationDelay === undefined ? undefined : { animationDelay: `${animationDelay}ms` }}
    >
      <button
        type="button"
        onClick={() => openProduct(product)}
        className={cn('relative aspect-[4/3] overflow-hidden rounded-xl sm:rounded-2xl', vice ? 'bg-black/30' : 'bg-cream')}
        aria-label={`Szczegóły: ${product.name}`}
      >
        <Image
          src={product.image || '/placeholder.svg'}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-contain transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {(product.seasonalLabel || product.badge) && (
          <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
            {product.seasonalLabel && <SeasonalBadge label={product.seasonalLabel} className="shadow-sm" />}
            {product.badge && <ProductBadge badge={product.badge} className="shadow-sm" />}
          </div>
        )}
        {vice && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-6">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#ffd166] sm:text-xs">Grand Theft Yummy VI</span>
            {product.pinned && <TreePalm className="size-4 text-[#4dd0e1]" aria-hidden="true" />}
          </div>
        )}
        {badgePromotion && (
          <span className="absolute right-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[11px] font-black text-primary-foreground shadow-sm">
            {discountLabel(badgePromotion)}
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col px-1.5 pb-1 pt-2.5 sm:px-3 sm:pb-2 sm:pt-4">
        <div className="flex items-start justify-between gap-3">
          <h3
            className={cn(
              'text-balance text-sm font-black leading-tight tracking-tight sm:text-lg',
              vice && 'bg-gradient-to-r from-[#ff6fa8] via-[#ff8a3d] to-[#ffd166] bg-clip-text font-black uppercase italic tracking-tight text-transparent',
            )}
          >
            {product.name}
          </h3>
          {product.rating && (
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold">
              <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
              {product.rating.toFixed(1).replace('.', ',')}
            </span>
          )}
        </div>
        {product.description?.trim() && (
          <p className={cn('mt-1 line-clamp-2 min-h-[2lh] text-[11px] leading-snug sm:mt-1.5 sm:text-sm', vice ? 'text-white/70' : 'text-muted-foreground')}>{product.description}</p>
        )}

        <div className={cn('mt-auto flex items-center justify-between gap-2 border-t pt-2.5 sm:pt-3', vice ? 'border-white/10' : 'border-dashed border-border')}>
          <p className="flex min-w-0 flex-wrap items-baseline whitespace-nowrap text-base font-black tracking-tight sm:text-xl">
            {new Set(product.variants?.map((variant) => variant.price)).size > 1 && (
              <span className="mr-1 text-xs font-medium text-muted-foreground sm:text-sm">od</span>
            )}
            {promotion ? (
              <>
                <span className="text-primary">{formatPrice(Math.round(product.price * (100 - Number(promotion.discount_percent))) / 100)}</span>
                <s className="ml-1.5 text-xs font-medium text-muted-foreground sm:text-sm"><span className="sr-only">Cena regularna </span>{formatPrice(product.price)}</s>
              </>
            ) : formatPrice(product.price)}
          </p>
          <button
            type="button"
            onClick={handleAdd}
            className={cn(
              'flex h-9 shrink-0 items-center justify-center gap-1 rounded-full px-2.5 text-sm font-bold shadow-md transition-transform hover:scale-105 active:scale-95 sm:h-10 sm:px-4',
              vice ? 'bg-gradient-to-br from-[#ff6fa8] to-[#ff8a3d] text-white shadow-[#ff6fa8]/40' : 'bg-primary text-primary-foreground shadow-primary/30',
            )}
          >
            <Plus className="size-4 stroke-[3]" aria-hidden="true" />
            <span className="hidden sm:inline" aria-hidden="true">Dodaj</span>
            <span className="sr-only">Dodaj {product.name} do koszyka</span>
          </button>
        </div>
      </div>
    </article>
  )
}
