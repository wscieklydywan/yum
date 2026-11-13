'use client'

import Image from 'next/image'
import { ArrowRight, CalendarDays, Crown } from 'lucide-react'
import { useCart } from '@/components/cart/cart-context'
import { formatPrice } from '@/lib/menu'
import { untilLabel, type PublicHomeSlides } from '@/lib/home-slides'
import { useLiveOrderable } from './use-live-orderable'

type BurgerWeek = NonNullable<PublicHomeSlides['burgerWeek']>

export function BurgerWeekSlide({ data, priority = false }: { data: BurgerWeek; priority?: boolean }) {
  const { openProduct } = useCart()
  const product = useLiveOrderable(data.product)!
  const description = data.text || product.description

  return (
    <div className="relative grid min-h-[250px] items-center overflow-hidden bg-[#f6c234] px-5 pb-6 pt-8 text-[#2a1a0c] sm:min-h-[620px] sm:px-10 sm:py-16 md:min-h-[680px] lg:px-16">
      <div aria-hidden="true" className="absolute -right-24 top-1/2 size-[22rem] -translate-y-1/2 rounded-full bg-[#ffd95c] sm:-right-16 sm:size-[40rem] md:right-0 md:size-[46rem]" />
      <div aria-hidden="true" className="absolute -right-10 top-1/2 size-[15rem] -translate-y-1/2 rounded-full bg-[#ffe68f] sm:size-[28rem] md:right-24 md:size-[32rem]" />

      <div className="absolute right-[-18%] top-1/2 aspect-square w-[62%] -translate-y-1/2 sm:right-[-4%] sm:w-[52%] md:right-[2%] md:w-[46%]">
        <Image
          src={product.image || '/placeholder.svg'}
          alt={`Burger tygodnia: ${product.name}`}
          fill
          priority={priority}
          sizes="(min-width: 768px) 46vw, 62vw"
          className="rounded-full object-cover shadow-[0_30px_60px_-20px_rgba(90,50,0,0.55)] ring-4 ring-[#2a1a0c]/10"
        />
      </div>

      <div className="relative max-w-[58%] sm:max-w-md md:max-w-xl">
        <p className="flex w-fit items-center gap-1.5 rounded-full bg-[#2a1a0c] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#f6c234] sm:px-3 sm:py-1.5 sm:text-xs">
          <Crown className="size-3 sm:size-3.5" aria-hidden="true" />
          {data.title}
        </p>
        <h2 className="mt-2 text-[1.75rem] font-extrabold leading-[1.02] text-balance sm:mt-5 sm:text-7xl sm:font-black sm:tracking-tight lg:text-8xl">
          {product.name}
        </h2>
        {description && (
          <p className="mt-1.5 line-clamp-2 text-xs text-[#2a1a0c]/80 sm:mt-6 sm:line-clamp-3 sm:text-lg">{description}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 sm:mt-8">
          <button
            type="button"
            onClick={() => openProduct(product)}
            disabled={product.disabled}
            className="inline-flex items-center gap-2 rounded-full bg-[#2a1a0c] px-4 py-2 text-xs font-bold text-[#f6c234] transition-colors hover:bg-[#45291a] disabled:cursor-not-allowed disabled:opacity-60 sm:px-7 sm:py-3.5 sm:text-base"
          >
            {product.disabled ? 'Kuchnia zamknięta' : 'Zamów teraz'}
            <ArrowRight className="size-3.5 sm:size-5" aria-hidden="true" />
          </button>
          <span className="flex items-baseline gap-2">
            {product.regularPrice !== undefined && product.regularPrice > product.price && (
              <s className="text-sm font-bold text-[#2a1a0c]/60 sm:text-xl">
                <span className="sr-only">Cena regularna: </span>
                {formatPrice(product.regularPrice)}
              </s>
            )}
            <span className="text-lg font-black sm:text-3xl">{formatPrice(product.price)}</span>
          </span>
        </div>
        {data.until && (
          <p className="mt-2 hidden items-center gap-1.5 text-sm font-semibold text-[#2a1a0c]/70 sm:mt-5 sm:flex">
            <CalendarDays className="size-4" aria-hidden="true" />
            {`Tylko do ${untilLabel(data.until)}`}
          </p>
        )}
      </div>
    </div>
  )
}
