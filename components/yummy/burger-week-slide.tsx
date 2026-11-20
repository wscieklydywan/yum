'use client'

import Image from 'next/image'
import { CalendarDays, Crown } from 'lucide-react'
import { HeroCtaArrow, HeroCtaRow, heroCtaClass, heroSlideContentClass } from './hero-slide-cta'
import { useCart } from '@/components/cart/cart-context'
import { formatPrice } from '@/lib/menu'
import { untilLabel, type PublicHomeSlides } from '@/lib/home-slides'
import { useLiveOrderable } from './use-live-orderable'

type BurgerWeek = NonNullable<PublicHomeSlides['burgerWeek']>

const POSITION_CLASS = { top: 'object-top', center: 'object-center', bottom: 'object-bottom' } as const

export function BurgerWeekSlide({ data, priority = false }: { data: BurgerWeek; priority?: boolean }) {
  const { openProduct } = useCart()
  const product = useLiveOrderable(data.product)!
  const description = data.text || product.description
  const fit = data.imageFit ?? 'contain'
  const position = data.imagePosition ?? 'center'

  return (
    <div className={`${heroSlideContentClass} bg-[#f6c234] text-[#2a1a0c]`}>
      <div aria-hidden="true" className="absolute -right-20 top-1/2 size-[17rem] -translate-y-1/2 rounded-full bg-[#ffd95c] sm:-right-16 sm:size-[40rem] md:right-0 md:size-[46rem]" />
      <div aria-hidden="true" className="absolute -right-6 top-1/2 size-[11.5rem] -translate-y-1/2 rounded-full bg-[#ffe68f] sm:-right-10 sm:size-[28rem] md:right-24 md:size-[32rem]" />

      <div className="absolute right-[2%] top-1/2 aspect-square w-[34%] max-w-[10.5rem] -translate-y-1/2 overflow-hidden rounded-full bg-white shadow-[0_24px_48px_-20px_rgba(90,50,0,0.55)] ring-4 ring-[#2a1a0c]/10 sm:right-[-2%] sm:w-[48%] sm:max-w-none md:right-[3%] md:w-[42%]">
        <Image
          src={product.image || '/placeholder.svg'}
          alt={`Burger tygodnia: ${product.name}`}
          fill
          priority={priority}
          sizes="(min-width: 768px) 42vw, 34vw"
          className={fit === 'contain' ? 'object-contain p-[9%]' : `object-cover ${POSITION_CLASS[position]}`}
        />
      </div>

      <div className="relative max-w-[62%] sm:max-w-md md:max-w-xl">
        <p className="flex w-fit items-center gap-1.5 rounded-full bg-[#2a1a0c] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#f6c234] sm:px-3 sm:py-1.5 sm:text-xs">
          <Crown className="size-3 sm:size-3.5" aria-hidden="true" />
          {data.title}
        </p>
        <h2 className="mt-2.5 text-[1.375rem] font-extrabold leading-[1.05] text-balance sm:mt-5 sm:text-7xl sm:font-black sm:tracking-tight lg:text-8xl">
          {product.name}
        </h2>
        {description && (
          <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-snug text-[#2a1a0c]/80 sm:mt-6 sm:line-clamp-3 sm:text-lg sm:leading-relaxed">{description}</p>
        )}
        {data.until && (
          <p className="mt-2 hidden items-center gap-1.5 text-sm font-semibold text-[#2a1a0c]/70 sm:mt-5 sm:flex">
            <CalendarDays className="size-4" aria-hidden="true" />
            {`Tylko do ${untilLabel(data.until)}`}
          </p>
        )}
        <HeroCtaRow
          price={
            <>
              {product.regularPrice !== undefined && product.regularPrice > product.price && (
                <s className="text-sm font-bold text-[#2a1a0c]/60 sm:text-xl">
                  <span className="sr-only">Cena regularna: </span>
                  {formatPrice(product.regularPrice)}
                </s>
              )}
              {formatPrice(product.price)}
            </>
          }
        >
          <button
            type="button"
            onClick={() => openProduct(product)}
            disabled={product.disabled}
            className={`${heroCtaClass} bg-[#2a1a0c] text-[#f6c234] hover:bg-[#45291a]`}
          >
            {product.disabled ? 'Kuchnia zamknięta' : 'Zamów teraz'}
            <HeroCtaArrow className="bg-[#f6c234] text-[#2a1a0c]" />
          </button>
        </HeroCtaRow>
      </div>
    </div>
  )
}
