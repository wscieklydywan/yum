import type { Product } from './menu'

export const HOME_SLIDE_IDS = ['burgers', 'burger_week', 'advent', 'halloween'] as const
export type HomeSlideId = (typeof HOME_SLIDE_IDS)[number]

export const HOME_SLIDE_LABELS: Record<HomeSlideId, string> = {
  burgers: 'Burgery Yummy',
  burger_week: 'Burger tygodnia',
  advent: 'Kalendarz adwentowy',
  halloween: 'Gra Halloween',
}

export const isHomeSlideId = (value: unknown): value is HomeSlideId =>
  typeof value === 'string' && (HOME_SLIDE_IDS as readonly string[]).includes(value)

/** Keeps known ids once, in the saved order, and appends any slide missing from it. */
export function normalizeSlideOrder(raw: unknown): HomeSlideId[] {
  const saved = Array.isArray(raw) ? raw.filter(isHomeSlideId) : []
  const unique = [...new Set(saved)]
  return [...unique, ...HOME_SLIDE_IDS.filter((id) => !unique.includes(id))]
}

export type BurgerWeekSettings = {
  enabled: boolean
  product_id: string | null
  title: string
  text: string
  until: string | null
}

export type HomeSlidesSettings = {
  order: HomeSlideId[]
  hidden: HomeSlideId[]
  burger_week: BurgerWeekSettings
}

export type PublicHomeSlides = {
  order: HomeSlideId[]
  hidden: HomeSlideId[]
  burgerWeek: { title: string; text: string; until: string | null; product: Product & { disabled?: boolean } } | null
}

export const DEFAULT_HOME_SLIDES: PublicHomeSlides = { order: [...HOME_SLIDE_IDS], hidden: [], burgerWeek: null }

export const HOME_SLIDES_PUBLIC_KEY = '/api/home-slides'

export async function fetchHomeSlides(url: string): Promise<PublicHomeSlides> {
  const response = await fetch(url)
  if (!response.ok) return DEFAULT_HOME_SLIDES
  return response.json()
}

/** "do 12 listopada" for an ISO date; time zone independent. */
export function untilLabel(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(Date.UTC(year, month - 1, day))
}

/** Last day still counts – the slide disappears the day after `until` (Polish time). */
export function isBurgerWeekExpired(until: string | null, now = new Date()) {
  if (!until) return false
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(now)
  return today > until
}
