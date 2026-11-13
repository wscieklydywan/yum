'use client'

import type { ReactNode } from 'react'
import useSWR from 'swr'
import { HeroCarousel, type HeroSlide } from './hero-carousel'
import { HalloweenHeroSlide } from './halloween-promo'
import { AdventHeroSlide } from './advent-hero-slide'
import { BurgerWeekSlide } from './burger-week-slide'
import { isAdventVisible, useAdventCalendar } from '@/lib/advent'
import { fetchHalloweenPublic, HALLOWEEN_PUBLIC_KEY } from '@/lib/halloween'
import { CustomHeroSlide, CUSTOM_SLIDE_THEMES } from './custom-hero-slide'
import { customSlideKey, fetchHomeSlides, HOME_SLIDES_PUBLIC_KEY, type HomeSlideId, type PublicHomeSlides } from '@/lib/home-slides'

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
    const key = customSlideKey(slide.id)
    available[key] = { id: key, label: slide.title, content: <CustomHeroSlide data={slide} priority={priorityId === key} />, tone: CUSTOM_SLIDE_THEMES[slide.theme].tone }
  }

  // The club slider mirrors the home page and can additionally hide slides of its own.
  const hidden = variant === 'club' ? [...config.hidden, ...(config.clubHidden ?? [])] : config.hidden
  const slides = config.order.filter((id) => !hidden.includes(id)).flatMap((id) => available[id] ?? [])
  const fallback = available.burgers ?? { id: 'burgers', label: 'Burgery Yummy', content: null }
  return <HeroCarousel slides={slides.length > 0 ? slides : [fallback]} ready={ready} />
}
