'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, CalendarDays, Sparkles } from 'lucide-react'
import { useCart } from '@/components/cart/cart-context'
import { formatPrice } from '@/lib/menu'
import { cn } from '@/lib/utils'
import { isViceSet } from '@/lib/vice'
import { untilLabel, type PublicCustomSlide, type SlideTheme } from '@/lib/home-slides'
import { useLiveOrderable } from './use-live-orderable'

export const CUSTOM_SLIDE_THEMES: Record<SlideTheme, { root: string; ring1: string; ring2: string; badge: string; button: string; muted: string; tone: 'light' | 'dark' }> = {
  yellow: { root: 'bg-[#f6c234] text-[#2a1a0c]', ring1: 'bg-[#ffd95c]', ring2: 'bg-[#ffe68f]', badge: 'bg-[#2a1a0c] text-[#f6c234]', button: 'bg-[#2a1a0c] text-[#f6c234] hover:bg-[#45291a]', muted: 'text-[#2a1a0c]/75', tone: 'dark' },
  cream: { root: 'bg-[#f7efe3] text-[#2a1a0c]', ring1: 'bg-[#efe2cd]', ring2: 'bg-[#e8d6b9]', badge: 'bg-[#c8331f] text-white', button: 'bg-[#c8331f] text-white hover:bg-[#a82a19]', muted: 'text-[#2a1a0c]/70', tone: 'dark' },
  red: { root: 'bg-[#c8331f] text-white', ring1: 'bg-[#d64a33]', ring2: 'bg-[#e0604a]', badge: 'bg-[#f6c234] text-[#2a1a0c]', button: 'bg-[#f6c234] text-[#2a1a0c] hover:bg-[#ffd95c]', muted: 'text-white/80', tone: 'light' },
  dark: { root: 'bg-[#1d1410] text-white', ring1: 'bg-[#2a1d17]', ring2: 'bg-[#36261e]', badge: 'bg-[#f6c234] text-[#2a1a0c]', button: 'bg-[#f6c234] text-[#2a1a0c] hover:bg-[#ffd95c]', muted: 'text-white/75', tone: 'light' },
}

const buttonClass = 'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:px-7 sm:py-3.5 sm:text-base'

export function CustomHeroSlide({ data, priority = false }: { data: PublicCustomSlide; priority?: boolean }) {
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
    <div className={cn('relative grid min-h-[250px] items-center overflow-hidden px-5 pb-6 pt-8 sm:min-h-[620px] sm:px-10 sm:py-16 md:min-h-[680px] lg:px-16', cover ? 'bg-[#1a0b24] text-white' : theme.root)}>
      {cover && data.image && (
        <>
          <Image src={data.image} alt={product ? product.name : data.title} fill priority={priority} sizes="100vw" className="object-cover object-[72%_50%] sm:object-center" />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#1a0b24]/95 via-[#1a0b24]/55 to-transparent sm:via-[#1a0b24]/35" />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#1a0b24]/60 to-transparent" />
        </>
      )}
      {!cover && data.image && (
        <>
          <div aria-hidden="true" className={cn('absolute -right-24 top-1/2 size-[22rem] -translate-y-1/2 rounded-full sm:-right-16 sm:size-[40rem] md:right-0 md:size-[46rem]', theme.ring1)} />
          <div aria-hidden="true" className={cn('absolute -right-10 top-1/2 size-[15rem] -translate-y-1/2 rounded-full sm:size-[28rem] md:right-24 md:size-[32rem]', theme.ring2)} />
          <div className="absolute right-[-18%] top-1/2 aspect-square w-[62%] -translate-y-1/2 sm:right-[-4%] sm:w-[52%] md:right-[2%] md:w-[46%]">
            <Image src={data.image} alt={product ? product.name : data.title} fill priority={priority} sizes="(min-width: 768px) 46vw, 62vw" className="rounded-full object-cover shadow-[0_30px_60px_-20px_rgba(0,0,0,0.5)] ring-4 ring-black/10" />
          </div>
        </>
      )}

      <div className={cn('relative', cover ? 'max-w-[62%] drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] sm:max-w-md md:max-w-xl' : data.image ? 'max-w-[58%] sm:max-w-md md:max-w-xl' : 'max-w-2xl')}>
        {data.badge && (
          <p className={cn('flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] sm:px-3 sm:py-1.5 sm:text-xs', theme.badge)}>
            <Sparkles className="size-3 sm:size-3.5" aria-hidden="true" />
            {data.badge}
          </p>
        )}
        <h2 className="mt-2 text-[1.75rem] font-extrabold leading-[1.02] text-balance sm:mt-5 sm:text-7xl sm:font-black sm:tracking-tight lg:text-8xl">{data.title}</h2>
        {data.text && <p className={cn('mt-1.5 line-clamp-2 text-xs sm:mt-6 sm:line-clamp-3 sm:text-lg', cover ? 'text-white/85' : theme.muted)}>{data.text}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 sm:mt-8">
          {product ? (
            <>
              <button type="button" onClick={order} disabled={product.disabled} className={cn(buttonClass, theme.button)}>
                {product.disabled ? 'Kuchnia zamknięta' : data.ctaLabel || 'Zamów teraz'}
                <ArrowRight className="size-3.5 sm:size-5" aria-hidden="true" />
              </button>
              <span className="text-lg font-black sm:text-3xl">{formatPrice(product.price)}</span>
            </>
          ) : data.href ? (
            <Link href={data.href} className={cn(buttonClass, theme.button)} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
              {data.ctaLabel || 'Sprawdź'}
              <ArrowRight className="size-3.5 sm:size-5" aria-hidden="true" />
            </Link>
          ) : null}
        </div>

        {data.until && (
          <p className={cn('mt-2 hidden items-center gap-1.5 text-sm font-semibold sm:mt-5 sm:flex', cover ? 'text-white/85' : theme.muted)}>
            <CalendarDays className="size-4" aria-hidden="true" />
            {`Tylko do ${untilLabel(data.until)}`}
          </p>
        )}
      </div>
    </div>
  )
}
