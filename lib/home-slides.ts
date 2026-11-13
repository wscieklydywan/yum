import type { Product } from './menu'

export const HOME_SLIDE_IDS = ['burgers', 'burger_week', 'advent', 'halloween'] as const
export type BuiltinSlideId = (typeof HOME_SLIDE_IDS)[number]
export type CustomSlideKey = `custom:${string}`
export type HomeSlideId = BuiltinSlideId | CustomSlideKey

export const HOME_SLIDE_LABELS: Record<BuiltinSlideId, string> = {
  burgers: 'Burgery Yummy',
  burger_week: 'Burger tygodnia',
  advent: 'Kalendarz adwentowy',
  halloween: 'Gra Halloween',
}

export const isBuiltinSlideId = (value: unknown): value is BuiltinSlideId =>
  typeof value === 'string' && (HOME_SLIDE_IDS as readonly string[]).includes(value)

export const customSlideKey = (id: string): CustomSlideKey => `custom:${id}`
export const customSlideIdFromKey = (key: string) => (key.startsWith('custom:') ? key.slice(7) : null)

/** Keeps known ids once, in the saved order, and appends any slide missing from it (new custom slides go last). */
export function normalizeSlideOrder(raw: unknown, customIds: string[] = []): HomeSlideId[] {
  const valid = new Set<string>([...HOME_SLIDE_IDS, ...customIds.map(customSlideKey)])
  const saved = Array.isArray(raw) ? raw.filter((id): id is HomeSlideId => typeof id === 'string' && valid.has(id)) : []
  const unique = [...new Set(saved)]
  return [...unique, ...([...valid] as HomeSlideId[]).filter((id) => !unique.includes(id))]
}

export function normalizeHidden(raw: unknown, customIds: string[] = []): HomeSlideId[] {
  const valid = new Set<string>([...HOME_SLIDE_IDS, ...customIds.map(customSlideKey)])
  return [...new Set(Array.isArray(raw) ? raw.filter((id): id is HomeSlideId => typeof id === 'string' && valid.has(id)) : [])]
}

export const SLIDE_THEMES = ['yellow', 'dark', 'red', 'cream'] as const
export type SlideTheme = (typeof SLIDE_THEMES)[number]
export const SLIDE_THEME_LABELS: Record<SlideTheme, string> = { yellow: 'Żółty', dark: 'Ciemny', red: 'Czerwony', cream: 'Kremowy' }
export const isSlideTheme = (value: unknown): value is SlideTheme => typeof value === 'string' && (SLIDE_THEMES as readonly string[]).includes(value)

/** circle = zdjęcie w kole obok tekstu, cover = gotowa grafika na cały slajd (baner). */
export const SLIDE_IMAGE_MODES = ['circle', 'cover'] as const
export type SlideImageMode = (typeof SLIDE_IMAGE_MODES)[number]
export const isSlideImageMode = (value: unknown): value is SlideImageMode => typeof value === 'string' && (SLIDE_IMAGE_MODES as readonly string[]).includes(value)
/** Proporcje grafiki na cały slajd (szeroki baner). */
export const COVER_IMAGE_ASPECT = 21 / 9

export type CustomSlide = {
  id: string
  badge: string
  title: string
  text: string
  image_url: string | null
  image_mode: SlideImageMode
  product_id: string | null
  cta_label: string
  cta_href: string | null
  theme: SlideTheme
  until: string | null
}

export type BurgerWeekSettings = {
  enabled: boolean
  product_id: string | null
  title: string
  text: string
  until: string | null
  /** Special price while the slide is active; null = menu price. */
  price: number | null
}

export type HomeSlidesSettings = {
  order: HomeSlideId[]
  hidden: HomeSlideId[]
  /** Slides hidden only in the Yummy Club app. */
  club_hidden: HomeSlideId[]
  burger_week: BurgerWeekSettings
  custom: CustomSlide[]
}

export type PublicCustomSlide = {
  id: string
  badge: string
  title: string
  text: string
  image: string | null
  imageMode: SlideImageMode
  theme: SlideTheme
  until: string | null
  ctaLabel: string
  href: string | null
  product: (Product & { disabled?: boolean }) | null
}

export type PublicHomeSlides = {
  order: HomeSlideId[]
  hidden: HomeSlideId[]
  clubHidden: HomeSlideId[]
  burgerWeek: { title: string; text: string; until: string | null; product: Product & { disabled?: boolean } } | null
  custom: PublicCustomSlide[]
}

export const DEFAULT_HOME_SLIDES: PublicHomeSlides = { order: [...HOME_SLIDE_IDS], hidden: [], clubHidden: [], burgerWeek: null, custom: [] }

export const HOME_SLIDES_PUBLIC_KEY = '/api/home-slides'

export async function fetchHomeSlides(url: string): Promise<PublicHomeSlides> {
  const response = await fetch(url)
  if (!response.ok) return DEFAULT_HOME_SLIDES
  const body = await response.json()
  return { ...DEFAULT_HOME_SLIDES, ...body }
}

/** Only in-app paths or https links – never javascript: or other schemes. */
export const isSafeSlideHref = (href: string) => /^\/(?!\/)[^\s]*$/.test(href) || /^https:\/\/[^\s]+$/.test(href)

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

export const isSlideExpired = isBurgerWeekExpired

/** Date part (Polish time) of an ISO timestamp, e.g. a seasonal dish end date. */
export function warsawDate(iso: string) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(new Date(iso))
}
