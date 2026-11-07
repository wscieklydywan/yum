'use client'

import type { ReactNode } from 'react'
import useSWR from 'swr'
import { HeroCarousel, type HeroSlide } from './hero-carousel'
import { HalloweenHeroSlide } from './halloween-promo'
import { AdventHeroSlide } from './advent-hero-slide'
import { BurgerWeekSlide } from './burger-week-slide'
import { isAdventVisible, useAdventCalendar } from '@/lib/advent'
import { fetchHalloweenPublic, HALLOWEEN_PUBLIC_KEY } from '@/lib/halloween'
import { DEFAULT_HOME_SLIDES, fetchHomeSlides, HOME_SLIDES_PUBLIC_KEY, type HomeSlideId } from '@/lib/home-slides'

/** Kolejność i widoczność slajdów ustawia się w warsztacie (Marketing → Strona główna). */
export function HomeHeroCarousel({ burgerSlide }: { burgerSlide: ReactNode }) {
  const { data, isLoading: halloweenLoading } = useSWR(HALLOWEEN_PUBLIC_KEY, fetchHalloweenPublic, { revalidateOnFocus: false, refreshInterval: 60_000, shouldRetryOnError: false })
  const { data: advent, isLoading: adventLoading } = useAdventCalendar()
  const { data: config = DEFAULT_HOME_SLIDES, isLoading: configLoading } = useSWR(HOME_SLIDES_PUBLIC_KEY, fetchHomeSlides, { revalidateOnFocus: false, refreshInterval: 60_000 })
  const ready = !halloweenLoading && !adventLoading && !configLoading

  const available: Partial<Record<HomeSlideId, HeroSlide>> = {
    burgers: { id: 'burgers', label: 'Burgery Yummy', content: burgerSlide },
  }
  if (config.burgerWeek) {
    available.burger_week = { id: 'burger_week', label: `${config.burgerWeek.title}: ${config.burgerWeek.product.name}`, content: <BurgerWeekSlide data={config.burgerWeek} />, tone: 'dark' }
  }
  if (isAdventVisible(advent) && advent.show_home_slide && !(advent.mode === 'live' && advent.ended)) {
    available.advent = { id: 'advent', label: 'Kalendarz adwentowy', content: <AdventHeroSlide data={advent} /> }
  }
  if (data?.showcase) available.halloween = { id: 'halloween', label: 'Dyniowe Łowy – gra Halloween', content: <HalloweenHeroSlide /> }

  const slides = config.order.filter((id) => !config.hidden.includes(id)).flatMap((id) => available[id] ?? [])
  return <HeroCarousel slides={slides.length > 0 ? slides : [available.burgers!]} ready={ready} />
}
