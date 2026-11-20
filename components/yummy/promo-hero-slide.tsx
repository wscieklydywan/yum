'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Clock, Percent } from 'lucide-react'
import { HeroCtaArrow, HeroCtaRow, heroCtaClass, heroSlideContentClass } from './hero-slide-cta'
import { CUSTOM_SLIDE_THEMES } from './custom-hero-slide'
import { cn } from '@/lib/utils'
import { describeSchedule, discountLabel, promotionBadgeLines, type Promotion } from '@/lib/promotions'
import { untilLabel, type PublicCustomSlide } from '@/lib/home-slides'

/** Ready-made layout for a slide linked to a promotion: huge reward line, stamp badge and the running hours. */
export function PromoHeroSlide({ data, promotion, priority = false }: { data: PublicCustomSlide; promotion: Promotion; priority?: boolean }) {
  const theme = CUSTOM_SLIDE_THEMES[data.theme]
  const headline = promotion.headline || discountLabel(promotion)
  const stamp = promotionBadgeLines(promotion)
  const description = data.text || promotion.description
  const until = data.until ?? promotion.valid_to
  const href = data.href || '/menu'
  const external = href.startsWith('https://')

  return (
    <div className={cn(heroSlideContentClass, theme.root)}>
      <div aria-hidden="true" className="absolute inset-0 opacity-[0.08] [background-image:repeating-linear-gradient(135deg,currentColor_0_2px,transparent_2px_22px)]" />
      <div aria-hidden="true" className={cn('absolute -right-24 top-1/2 size-[19rem] -translate-y-1/2 rounded-full sm:-right-16 sm:size-[40rem] md:right-0 md:size-[46rem]', theme.ring1)} />
      <div aria-hidden="true" className={cn('absolute -right-10 top-1/2 size-[13rem] -translate-y-1/2 rounded-full sm:-right-10 sm:size-[28rem] md:right-24 md:size-[32rem]', theme.ring2)} />

      {data.image ? (
        <div className="absolute right-[4%] top-1/2 aspect-square w-[40%] max-w-[12rem] -translate-y-1/2 sm:right-[2%] sm:w-[44%] sm:max-w-none md:right-[6%] md:w-[38%]">
          {data.imageMobile ? (
            <>
              <Image src={data.imageMobile} alt={data.title} fill priority={priority} sizes="40vw" className="rounded-full object-cover shadow-[0_30px_60px_-20px_rgba(0,0,0,0.5)] ring-4 ring-black/10 sm:hidden" />
              <Image src={data.image} alt="" aria-hidden="true" fill priority={priority} sizes="(min-width: 768px) 38vw, 44vw" className="hidden rounded-full object-cover shadow-[0_30px_60px_-20px_rgba(0,0,0,0.5)] ring-4 ring-black/10 sm:block" />
            </>
          ) : (
            <Image src={data.image} alt={data.title} fill priority={priority} sizes="(min-width: 768px) 38vw, 44vw" className="rounded-full object-cover shadow-[0_30px_60px_-20px_rgba(0,0,0,0.5)] ring-4 ring-black/10" />
          )}
          <PromoStamp lines={stamp} className={cn('-left-3 -top-3 sm:-left-6 sm:top-2', theme.badge)} />
        </div>
      ) : (
        <div className="absolute right-[6%] top-1/2 aspect-square w-[34%] max-w-[10rem] -translate-y-1/2 sm:right-[8%] sm:w-[30%] sm:max-w-[22rem]">
          <PromoStamp lines={stamp} className={cn('inset-0 size-full', theme.badge)} large />
        </div>
      )}

      <div className="relative max-w-[58%] sm:max-w-md md:max-w-xl">
        <p className={cn('flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] sm:px-3 sm:py-1.5 sm:text-xs', theme.badge)}>
          <Percent className="size-3 sm:size-3.5" aria-hidden="true" />
          {data.badge || 'Promocja'}
        </p>
        <p className="mt-2.5 text-xs font-bold uppercase tracking-wide opacity-80 sm:mt-5 sm:text-base">{data.title || promotion.title}</p>
        <h2 className="mt-1 text-[1.5rem] font-black leading-[0.98] text-balance sm:mt-2 sm:text-7xl sm:tracking-tight lg:text-8xl">{headline}</h2>
        {description && <p className={cn('mt-1.5 line-clamp-2 text-[11.5px] leading-snug sm:mt-5 sm:line-clamp-3 sm:text-lg sm:leading-relaxed', theme.muted)}>{description}</p>}

        <p className={cn('mt-2 hidden items-center gap-1.5 text-sm font-semibold sm:mt-5 sm:flex', theme.muted)}>
          <Clock className="size-4" aria-hidden="true" />
          {describeSchedule(promotion)}
          {until && ` · do ${untilLabel(until)}`}
        </p>

        <HeroCtaRow>
          <Link href={href} className={cn(heroCtaClass, theme.button)} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {data.ctaLabel || 'Zamów z promocją'}
            <HeroCtaArrow className={theme.arrow} />
          </Link>
        </HeroCtaRow>
      </div>
    </div>
  )
}

function PromoStamp({ lines, className, large = false }: { lines: string[]; className?: string; large?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'absolute flex rotate-[-10deg] flex-col items-center justify-center rounded-full text-center font-black uppercase leading-none shadow-[0_14px_30px_-10px_rgba(0,0,0,0.55)] ring-4 ring-white/80',
        large ? 'gap-1 text-[1.6rem] sm:gap-2 sm:text-6xl' : 'size-16 gap-0.5 text-sm sm:size-32 sm:gap-1 sm:text-2xl',
        className,
      )}
    >
      {lines.map((line) => <span key={line}>{line}</span>)}
    </div>
  )
}
