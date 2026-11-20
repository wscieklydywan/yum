import type { Product } from './menu'
import type { Promotion } from './promotions'
import { DEFAULT_CLUB_TILES, type ClubTilesConfig } from './club-tiles'

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

/** Elementy sekcji „Na czasie” w Yummy Club, sterowane niezależnie od slidera strony głównej. */
export const CLUB_FEED_IDS = ['slider', 'wheel', 'advent', 'halloween'] as const
export type ClubFeedId = (typeof CLUB_FEED_IDS)[number]
export const CLUB_FEED_LABELS: Record<ClubFeedId, { title: string; hint: string }> = {
  slider: { title: 'Slider', hint: 'Duży slider na górze sekcji (slajdy wybierasz ikoną telefonu wyżej).' },
  wheel: { title: 'Koło fortuny', hint: 'Kafelek z codziennym zakręceniem.' },
  advent: { title: 'Kalendarz adwentowy', hint: 'Pojawia się tylko, gdy kalendarz jest aktywny.' },
  halloween: { title: 'Dyniowe Łowy', hint: 'Gra Halloween i jej wyniki po zakończeniu.' },
}
const FEED_PREFIX = 'feed:'
const isClubFeedId = (value: unknown): value is ClubFeedId => typeof value === 'string' && (CLUB_FEED_IDS as readonly string[]).includes(value)

export function normalizeClubFeed(raw: unknown): ClubFeedId[] {
  return [...new Set(Array.isArray(raw) ? raw.filter(isClubFeedId) : [])]
}
/** Feed visibility is stored next to the club slide ids, as `feed:<id>`, in the same column. */
export const clubFeedFromStored = (raw: unknown): ClubFeedId[] =>
  normalizeClubFeed(Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string' && id.startsWith(FEED_PREFIX)).map((id) => id.slice(FEED_PREFIX.length)) : [])
export const clubFeedToStored = (ids: ClubFeedId[]) => ids.map((id) => `${FEED_PREFIX}${id}`)

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
/** Optional phone-only banner; the phone slide is roughly 4:3. */
export const MOBILE_COVER_IMAGE_ASPECT = 4 / 3

/** Do czego przypisana jest grafika slajdu. */
export const SLIDE_KINDS = ['dish', 'seasonal', 'burger_week', 'promo', 'event', 'other'] as const
export type SlideKind = (typeof SLIDE_KINDS)[number]
export const SLIDE_KIND_LABELS: Record<SlideKind, string> = {
  dish: 'Danie z menu',
  seasonal: 'Sezonowe',
  burger_week: 'Burger tygodnia',
  promo: 'Promocja',
  event: 'Wydarzenie',
  other: 'Inne',
}
export const SLIDE_KIND_HINTS: Record<SlideKind, string> = {
  dish: 'Grafika konkretnego dania z karty.',
  seasonal: 'Danie lub oferta sezonowa, dostępna przez określony czas.',
  burger_week: 'Burger tygodnia — możesz wymieniać grafikę co tydzień.',
  promo: 'Rabat, zestaw lub kod promocyjny.',
  event: 'Wydarzenie, otwarcie, koncert, mecz.',
  other: 'Ogłoszenie, informacja, cokolwiek innego.',
}
/** Rodzaje, przy których grafikę podpina się pod danie z menu. */
export const PRODUCT_SLIDE_KINDS: readonly SlideKind[] = ['dish', 'seasonal', 'burger_week']
export const isSlideKind = (value: unknown): value is SlideKind => typeof value === 'string' && (SLIDE_KINDS as readonly string[]).includes(value)

export type CustomSlide = {
  id: string
  kind: SlideKind
  badge: string
  title: string
  text: string
  image_url: string | null
  image_mobile_url: string | null
  image_mode: SlideImageMode
  product_id: string | null
  cta_label: string
  cta_href: string | null
  theme: SlideTheme
  until: string | null
  /** Linked promotion: the slide shows only while it is running and uses the promotion template. */
  promotion_id: string | null
}

export type BurgerWeekSettings = {
  enabled: boolean
  product_id: string | null
  title: string
  text: string
  until: string | null
  /** Special price while the slide is active; null = menu price. */
  price: number | null
  /** contain = whole photo visible, cover = photo fills the circle (cropped). */
  image_fit: BurgerImageFit
  /** Focus point used when the photo is cropped. */
  image_position: BurgerImagePosition
}

export const BURGER_IMAGE_FITS = ['contain', 'cover'] as const
export type BurgerImageFit = (typeof BURGER_IMAGE_FITS)[number]
export const BURGER_IMAGE_POSITIONS = ['top', 'center', 'bottom'] as const
export type BurgerImagePosition = (typeof BURGER_IMAGE_POSITIONS)[number]

export type HomeSlidesSettings = {
  order: HomeSlideId[]
  hidden: HomeSlideId[]
  /** Slides hidden only in the Yummy Club app. */
  club_hidden: HomeSlideId[]
  /** Tiles of the „Na czasie” section hidden in the Yummy Club app. */
  club_feed_hidden: ClubFeedId[]
  /** Order, text overrides and custom tiles of the „Aktualnie na czasie” rail. */
  club_tiles: ClubTilesConfig
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
  imageMobile: string | null
  theme: SlideTheme
  until: string | null
  ctaLabel: string
  href: string | null
  product: (Product & { disabled?: boolean }) | null
  promotion: Promotion | null
}

export type PublicHomeSlides = {
  order: HomeSlideId[]
  hidden: HomeSlideId[]
  clubHidden: HomeSlideId[]
  clubFeedHidden: ClubFeedId[]
  clubTiles: ClubTilesConfig
  burgerWeek: { title: string; text: string; until: string | null; imageFit?: BurgerImageFit; imagePosition?: BurgerImagePosition; product: Product & { disabled?: boolean } } | null
  custom: PublicCustomSlide[]
}

export const DEFAULT_HOME_SLIDES: PublicHomeSlides = { order: [...HOME_SLIDE_IDS], hidden: [], clubHidden: [], clubFeedHidden: [], clubTiles: DEFAULT_CLUB_TILES, burgerWeek: null, custom: [] }

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
