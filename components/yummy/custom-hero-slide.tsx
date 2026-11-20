'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CalendarDays, Sparkles } from 'lucide-react'
import { HeroCtaArrow, HeroCtaRow, heroCtaClass, heroSlideContentClass } from './hero-slide-cta'
import { useCart } from '@/components/cart/cart-context'
import { formatPrice } from '@/lib/menu'
import { cn } from '@/lib/utils'
import { isViceSet } from '@/lib/vice'
import { untilLabel, type PublicCustomSlide, type SlideTheme } from '@/lib/home-slides'
import { useLiveOrderable } from './use-live-orderable'
import { PromoHeroSlide } from './promo-hero-slide'

export const CUSTOM_SLIDE_THEMES: Record<SlideTheme, { root: string; ring1: string; ring2: string; badge: string; button: string; arrow: string; muted: string; tone: 'light' | 'dark' }> = {
  yellow: { root: 'bg-[#f6c234] text-[#2a1a0c]', ring1: 'bg-[#ffd95c]', ring2: 'bg-[#ffe68f]', badge: 'bg-[#2a1a0c] text-[#f6c234]', button: 'bg-[#2a1a0c] text-[#f6c234] hover:bg-[#45291a]', arrow: 'bg-[#f6c234] text-[#2a1a0c]', muted: 'text-[#2a1a0c]/75', tone: 'dark' },
  cream: { root: 'bg-[#f7efe3] text-[#2a1a0c]', ring1: 'bg-[#efe2cd]', ring2: 'bg-[#e8d6b9]', badge: 'bg-[#c8331f] text-white', button: 'bg-[#c8331f] text-white hover:bg-[#a82a19]', arrow: 'bg-white text-[#c8331f]', muted: 'text-[#2a1a0c]/70', tone: 'dark' },
  red: { root: 'bg-[#c8331f] text-white', ring1: 'bg-[#d64a33]', ring2: 'bg-[#e0604a]', badge: 'bg-[#f6c234] text-[#2a1a0c]', button: 'bg-[#f6c234] text-[#2a1a0c] hover:bg-[#ffd95c]', arrow: 'bg-[#2a1a0c] text-[#f6c234]', muted: 'text-white/80', tone: 'light' },
  dark: { root: 'bg-[#1d1410] text-white', ring1: 'bg-[#2a1d17]', ring2: 'bg-[#36261e]', badge: 'bg-[#f6c234] text-[#2a1a0c]', button: 'bg-[#f6c234] text-[#2a1a0c] hover:bg-[#ffd95c]', arrow: 'bg-[#2a1a0c] text-[#f6c234]', muted: 'text-white/75', tone: 'light' },
}

export function CustomHeroSlide({ data, priority = false }: { data: PublicCustomSlide; priority?: boolean }) {
  if (data.promotion && !(data.imageMode === 'cover' && data.image)) return <PromoHeroSlide data={data} promotion={data.promotion} priority={priority} />
  return <PlainCustomSlide data={data} priority={priority} />
}

function PlainCustomSlide({ data, priority }: { data: PublicCustomSlide; priority: boolean }) {
  const { openProduct, addLine, setOpen } = useCart()
  const theme = CUSTOM_SLIDE_THEMES[data.theme]
  const product = useLiveOrderable(data.product)

  const order = () => {
    if (!product) return
    if (!isViceSet(product)) return openProduct(product)
    addLine({ productId: product.id, name: product.name, image: product.image, unitPrice: product.price, quantity: 1, details: [], category: product.category })
    setOpen(true)
  }
  const external = data.href?.startsWith('https://')
  const cover = data.imageMode === 'cover' && Boolean(data.image)

  return (
    <div className={cn(heroSlideContentClass, cover ? 'bg-[#1a0b24] text-white' : theme.root)}>
      {cover && data.image && (
        <>
          {data.imageMobile ? (
            <>
              <Image src={data.imageMobile} alt={product ? product.name : data.title} fill priority={priority} sizes="100vw" className="object-cover object-right sm:hidden" />
              <Image src={data.image} alt="" aria-hidden="true" fill priority={priority} sizes="100vw" className="hidden object-cover object-center sm:block" />
            </>
          ) : (
            <>
              {/* Without a phone graphic the banner is zoomed out from the bottom-right corner, so the product sits further from the text; the top fade hides the seam. */}
              <Image src={data.image} alt={product ? product.name : data.title} fill priority={priority} sizes="100vw" className="origin-bottom-right scale-[0.84] object-cover object-right sm:scale-100 sm:object-center" />
              <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[42%] bg-gradient-to-b from-[#1a0b24] from-35% to-transparent sm:hidden" />
            </>
          )}
          <div aria-hidden="true" className={cn('absolute inset-0 bg-gradient-to-r to-transparent sm:from-[#1a0b24]/95 sm:via-[#1a0b24]/35', data.imageMobile ? 'from-[#1a0b24]/80 via-[#1a0b24]/30 via-45%' : 'from-[#1a0b24]/95 via-[#1a0b24]/55')} />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#1a0b24]/60 to-transparent" />
        </>
      )}
      {!cover && data.image && (
        <>
          <div aria-hidden="true" className={cn('absolute -right-28 top-1/2 size-[20rem] -translate-y-1/2 rounded-full sm:-right-16 sm:size-[40rem] md:right-0 md:size-[46rem]', theme.ring1)} />
          <div aria-hidden="true" className={cn('absolute -right-16 top-1/2 size-[14rem] -translate-y-1/2 rounded-full sm:-right-10 sm:size-[28rem] md:right-24 md:size-[32rem]', theme.ring2)} />
          <div className="absolute right-4 top-1/2 aspect-square w-[40%] max-w-[11rem] -translate-y-1/2 overflow-hidden rounded-full shadow-[0_18px_36px_-12px_rgba(0,0,0,0.55)] ring-[3px] ring-white/90 sm:hidden">
            <Image src={data.imageMobile || data.image} alt={product ? product.name : data.title} fill priority={priority} sizes="40vw" className="object-cover" />
          </div>
          <div className="absolute right-[-4%] top-1/2 hidden aspect-square w-[52%] -translate-y-1/2 sm:block md:right-[2%] md:w-[46%]">
            <Image src={data.image} alt="" aria-hidden="true" fill priority={priority} sizes="(min-width: 768px) 46vw, 52vw" className="rounded-full object-cover shadow-[0_30px_60px_-20px_rgba(0,0,0,0.5)] ring-4 ring-black/10" />
          </div>
        </>
      )}

      <div className={cn('relative', cover ? 'max-w-[62%] drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] sm:max-w-md md:max-w-xl' : data.image ? 'max-w-[55%] sm:max-w-md md:max-w-xl' : 'max-w-2xl')}>
        {data.badge && (
          <p className={cn('flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] sm:px-3 sm:py-1.5 sm:text-xs', theme.badge)}>
            <Sparkles className="size-3 sm:size-3.5" aria-hidden="true" />
            {data.badge}
          </p>
        )}
        <h2 className="mt-2.5 text-[1.375rem] font-extrabold leading-[1.05] text-balance sm:mt-5 sm:text-7xl sm:font-black sm:tracking-tight lg:text-8xl">{data.title}</h2>
        {data.text && <p className={cn('mt-1.5 line-clamp-2 text-[11.5px] leading-snug sm:mt-6 sm:line-clamp-3 sm:text-lg sm:leading-relaxed', cover ? 'text-white/85' : theme.muted)}>{data.text}</p>}

        {data.until && (
          <p className={cn('mt-2 hidden items-center gap-1.5 text-sm font-semibold sm:mt-5 sm:flex', cover ? 'text-white/85' : theme.muted)}>
            <CalendarDays className="size-4" aria-hidden="true" />
            {`Tylko do ${untilLabel(data.until)}`}
          </p>
        )}

        <HeroCtaRow price={product ? formatPrice(product.price) : undefined}>
          {product ? (
            <button type="button" onClick={order} disabled={product.disabled} className={cn(heroCtaClass, theme.button)}>
              {product.disabled ? 'Kuchnia zamknięta' : data.ctaLabel || 'Zamów teraz'}
              <HeroCtaArrow className={theme.arrow} />
            </button>
          ) : data.href ? (
            <Link href={data.href} className={cn(heroCtaClass, theme.button)} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
              {data.ctaLabel || 'Sprawdź'}
              <HeroCtaArrow className={theme.arrow} />
            </Link>
          ) : null}
        </HeroCtaRow>
      </div>
    </div>
  )
}
