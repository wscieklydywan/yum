'use client'

import { useEffect, useState, type ReactNode } from 'react'
import useSWR from 'swr'
import { isPromotionRunning, msUntilScheduleChange, type Promotion } from '@/lib/promotions'
import { HeroCarousel, type HeroSlide } from './hero-carousel'
import { HalloweenHeroSlide } from './halloween-promo'
import { AdventHeroSlide } from './advent-hero-slide'
import { BurgerWeekSlide } from './burger-week-slide'
import { isAdventVisible, useAdventCalendar } from '@/lib/advent'
import { fetchHalloweenPublic, HALLOWEEN_PUBLIC_KEY } from '@/lib/halloween'
import { CustomHeroSlide, CUSTOM_SLIDE_THEMES } from './custom-hero-slide'
import { customSlideKey, fetchHomeSlides, HOME_SLIDES_PUBLIC_KEY, type HomeSlideId, type PublicCustomSlide, type PublicHomeSlides } from '@/lib/home-slides'
import { useImageTones, useIsDesktop } from '@/lib/image-tone'

/** The image actually shown full-bleed behind the slide on this viewport, if any. */
function slideCoverUrl(slide: PublicCustomSlide, isDesktop: boolean) {
  if (slide.imageMode !== 'cover' || !slide.image) return null
  return isDesktop ? slide.image : (slide.imageMobile ?? slide.image)
}

/**
 * Current time, updated only at the exact moment one of the promotions starts or ends
 * (a single timer, no polling) and when the tab becomes visible again after sleep.
 * Null until mounted so the first render matches the server.
 */
function usePromotionClock(promotions: Promotion[]) {
  const [now, setNow] = useState<Date | null>(null)
  const scheduleKey = promotions.map((p) => `${p.id}:${p.active}:${p.start_time}:${p.end_time}:${p.valid_from}:${p.valid_to}:${p.days.join('')}`).join('|')
  useEffect(() => {
    if (promotions.length === 0) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = () => {
      const current = new Date()
      setNow(current)
      clearTimeout(timer)
      const waits = promotions.map((promotion) => msUntilScheduleChange(promotion, current)).filter((ms): ms is number => ms !== null)
      if (waits.length > 0) timer = setTimeout(tick, Math.max(1000, Math.min(...waits) + 1000))
    }
    const onVisible = () => document.visibilityState === 'visible' && tick()
    tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scheduleKey captures every field the timer depends on
  }, [scheduleKey])
  return now
}

/**
 * Kolejność i widoczność slajdów ustawia się w warsztacie (Marketing → Strona główna).
 * Konfiguracja przychodzi gotowa z serwera (z cache strony), więc przeglądarka nie odpytuje jej ponownie ani cyklicznie.
 * Zapis w warsztacie unieważnia cache, a kolejne wejście lub odświeżenie dostaje już nową wersję.
 */
export function HomeHeroCarousel({
  burgerSlide,
  initialConfig,
  priorityId,
  variant = 'home',
}: {
  burgerSlide: ReactNode
  initialConfig: PublicHomeSlides
  priorityId: string
  variant?: 'home' | 'club'
}) {
  const { data, isLoading: halloweenLoading } = useSWR(HALLOWEEN_PUBLIC_KEY, fetchHalloweenPublic, { revalidateOnFocus: false, shouldRetryOnError: false })
  const { data: advent, isLoading: adventLoading } = useAdventCalendar()
  const { data: config = initialConfig } = useSWR(HOME_SLIDES_PUBLIC_KEY, fetchHomeSlides, {
    fallbackData: initialConfig,
    revalidateOnMount: false,
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })
  const ready = !halloweenLoading && !adventLoading
  const now = usePromotionClock((config.custom ?? []).flatMap((slide) => (slide.promotion ? [slide.promotion] : [])))
  const isDesktop = useIsDesktop()
  const coverTones = useImageTones((config.custom ?? []).flatMap((slide) => slideCoverUrl(slide, isDesktop) ?? []))

  const available: Partial<Record<HomeSlideId, HeroSlide>> = {}
  if (burgerSlide) available.burgers = { id: 'burgers', label: 'Burgery Yummy', content: burgerSlide }
  if (config.burgerWeek) {
    available.burger_week = { id: 'burger_week', label: `${config.burgerWeek.title}: ${config.burgerWeek.product.name}`, content: <BurgerWeekSlide data={config.burgerWeek} priority={priorityId === 'burger_week'} />, tone: 'dark' }
  }
  if (isAdventVisible(advent) && advent.show_home_slide && !(advent.mode === 'live' && advent.ended)) {
    available.advent = { id: 'advent', label: 'Kalendarz adwentowy', content: <AdventHeroSlide data={advent} /> }
  }
  if (data?.showcase) available.halloween = { id: 'halloween', label: 'Dyniowe Łowy – gra Halloween', content: <HalloweenHeroSlide /> }
  for (const slide of config.custom ?? []) {
    if (slide.promotion && now && !isPromotionRunning(slide.promotion, now)) continue
    const key = customSlideKey(slide.id)
    const coverUrl = slideCoverUrl(slide, isDesktop)
    // Full-bleed graphics pick the bar colour from the image itself; until it is analysed, white bars suit the dark cover backdrop.
    const tone = coverUrl ? (coverTones[coverUrl] ?? 'light') : CUSTOM_SLIDE_THEMES[slide.theme].tone
    available[key] = { id: key, label: slide.title, content: <CustomHeroSlide data={slide} priority={priorityId === key} />, tone }
  }

  // The club slider mirrors the home page and can additionally hide slides of its own.
  const hidden = variant === 'club' ? [...config.hidden, ...(config.clubHidden ?? [])] : config.hidden
  const slides = config.order.filter((id) => !hidden.includes(id)).flatMap((id) => available[id] ?? [])
  const fallback = available.burgers ?? { id: 'burgers', label: 'Burgery Yummy', content: null }
  return <HeroCarousel slides={slides.length > 0 ? slides : [fallback]} ready={ready} />
}
