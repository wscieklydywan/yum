export type AboutImage = { src: string; alt: string; width: number; height: number }
export type AboutValue = { title: string; text: string }

export type AboutContent = {
  eyebrow: string
  title: string
  lead: string
  hero: AboutImage
  heroBadgeValue: string
  heroBadgeText: string
  storyTitle: string
  storyParagraphs: string[]
  terrace: AboutImage
  oldLogo: AboutImage
  oldLogoLabel: string
  oldLogoCaption: string
  valuesTitle: string
  values: AboutValue[]
  thanksTitle: string
  thanksParagraphs: string[]
  burger: AboutImage
  shake: AboutImage
  quote: string
  quoteAuthor: string
  ctaTitle: string
  ctaText: string
}

export type AboutImageKey = 'hero' | 'terrace' | 'oldLogo' | 'burger' | 'shake'

/** Each photo slot with the crop the public layout expects; the editor can still switch to any other aspect. */
export const ABOUT_IMAGE_SLOTS: { key: AboutImageKey; label: string; aspect: number; maxWidth: number }[] = [
  { key: 'hero', label: 'Duże zdjęcie na górze', aspect: 21 / 9, maxWidth: 2000 },
  { key: 'terrace', label: 'Zdjęcie przy historii', aspect: 4 / 5, maxWidth: 1200 },
  { key: 'oldLogo', label: 'Pierwsze logo', aspect: 1, maxWidth: 480 },
  { key: 'burger', label: 'Burger', aspect: 4 / 5, maxWidth: 1000 },
  { key: 'shake', label: 'Shake', aspect: 3 / 4, maxWidth: 800 },
]

export const ABOUT_VALUES_COUNT = 3
export const ABOUT_MAX_PARAGRAPHS = 6

export const DEFAULT_ABOUT: AboutContent = {
  eyebrow: 'O nas',
  title: 'Wraca się tu po ulubione jedzenie. I dla ludzi.',
  lead: 'Są takie miejsca, do których wraca się po ulubione jedzenie. I takie, do których wraca się również dla ludzi. Chcemy, żeby Yummy było jednym i drugim.',
  hero: {
    src: '/images/about-interior.webp',
    alt: 'Wnętrze Yummy: czerwono-biała lada z hokerami, szachownica na podłodze i tablice z menu',
    width: 1256,
    height: 952,
  },
  heroBadgeValue: '2019',
  heroBadgeText: 'tu zaczyna się nasza historia',
  storyTitle: 'Z pasji do pyszności',
  storyParagraphs: [
    'Nasza historia rozpoczęła się w 2019 roku. To właśnie wtedy z pasji do tworzenia pyszności i fascynacji klimatem amerykańskich dinerów narodziło się Yummy.',
    'Chcieliśmy stworzyć miejsce, w którym dobre jedzenie łączy się ze swobodną, przyjazną atmosferą.',
    'Dziś jesteśmy **burgerownią z Rybnika-Niedobczyc**.',
  ],
  terrace: {
    src: '/images/about-terrace.webp',
    alt: 'Ogródek przed Yummy: drewniane stoły, parasol i girlandy z żarówek w słoneczny dzień',
    width: 1000,
    height: 1205,
  },
  oldLogo: { src: '/images/about-old-logo.webp', alt: 'Pierwsze logo Yummy Slow Food Restaurant', width: 480, height: 476 },
  oldLogoLabel: 'Od 2019',
  oldLogoCaption: 'Nasze pierwsze logo',
  valuesTitle: 'Yummy to więcej niż burgery',
  values: [
    { title: 'Porządne burgery', text: 'Uwielbiamy eksperymentować ze smakami i mamy słabość do porządnych burgerów.' },
    { title: 'Nie tylko burgery', text: "Shake'i, słodkości, sezonowe nowości i pomysły, którymi lubimy Was zaskakiwać!" },
    { title: 'Ludzie', text: 'Za każdym zamówieniem stoją ludzie, którzy każdego dnia tworzą wyjątkowy charakter naszej restauracji.' },
  ],
  thanksTitle: 'To dzięki Wam',
  thanksParagraphs: [
    'Najbardziej cieszy nas jednak to, że do nas wracacie. Macie swoich ulubieńców, dzielicie się opiniami i pomagacie nam się rozwijać.',
    'To dzięki Wam Yummy jest czymś więcej niż kolejną burgerownią.',
  ],
  burger: {
    src: '/images/about-burger.webp',
    alt: 'Burger z wołowiną, cheddarem, bekonem, sałatą i panierowanym serem',
    width: 1000,
    height: 1249,
  },
  shake: { src: '/images/about-shake-real.webp', alt: 'Shake z bitą śmietaną, karmelem i kawałkami czekolady', width: 720, height: 960 },
  quote: 'Jeśli jesteś z nami od dawna: dziękujemy, że jesteś częścią naszej historii! A jeśli dopiero nas poznajesz, mamy nadzieję, że zostaniesz na dłużej.',
  quoteAuthor: 'Ekipa Yummy',
  ctaTitle: 'Wpadnij do nas',
  ctaText: 'Zamów online albo śledź nas w social mediach.',
}

const TEXT_LIMITS = {
  eyebrow: 40,
  title: 160,
  lead: 500,
  heroBadgeValue: 12,
  heroBadgeText: 60,
  storyTitle: 80,
  oldLogoLabel: 30,
  oldLogoCaption: 60,
  valuesTitle: 80,
  thanksTitle: 80,
  quote: 400,
  quoteAuthor: 60,
  ctaTitle: 60,
  ctaText: 160,
} as const satisfies Partial<Record<keyof AboutContent, number>>

export const ABOUT_TEXT_LIMITS: Record<keyof typeof TEXT_LIMITS, number> = TEXT_LIMITS
export const ABOUT_PARAGRAPH_LIMIT = 600
export const ABOUT_VALUE_TITLE_LIMIT = 40
export const ABOUT_VALUE_TEXT_LIMIT = 200
export const ABOUT_ALT_LIMIT = 200

const str = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

function isAllowedImageSrc(src: string, storageOrigin: string | null) {
  if (/^\/images\/[\w-]+\.(webp|png|jpe?g)$/.test(src)) return true
  return Boolean(storageOrigin) && src.startsWith(`${storageOrigin}/storage/v1/object/public/menu-images/about/`) && src.length <= 500
}

function parseImage(raw: unknown, fallback: AboutImage, storageOrigin: string | null, strict: boolean): AboutImage | string {
  const image = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const src = str(image.src, 500)
  if (!isAllowedImageSrc(src, storageOrigin)) return strict ? 'Niepoprawny adres zdjęcia.' : fallback
  const width = Math.round(Number(image.width))
  const height = Math.round(Number(image.height))
  const validSize = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 && width <= 4000 && height <= 4000
  return {
    src,
    alt: str(image.alt, ABOUT_ALT_LIMIT),
    width: validSize ? width : fallback.width,
    height: validSize ? height : fallback.height,
  }
}

function parseParagraphs(raw: unknown) {
  return (Array.isArray(raw) ? raw : [])
    .map((paragraph) => str(paragraph, ABOUT_PARAGRAPH_LIMIT))
    .filter(Boolean)
    .slice(0, ABOUT_MAX_PARAGRAPHS)
}

/**
 * Normalizes stored or submitted content. `strict` (workshop save) reports the first problem;
 * lenient mode (public read) silently falls back to defaults so the page always renders.
 */
export function parseAboutContent(raw: unknown, storageOrigin: string | null, strict = false): AboutContent | string {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const text = {} as Record<keyof typeof TEXT_LIMITS, string>
  for (const [key, max] of Object.entries(TEXT_LIMITS) as [keyof typeof TEXT_LIMITS, number][]) {
    text[key] = str(body[key], max) || (strict ? '' : DEFAULT_ABOUT[key])
  }
  if (strict && !text.title) return 'Nagłówek strony nie może być pusty.'

  const images = {} as Record<AboutImageKey, AboutImage>
  for (const { key, label } of ABOUT_IMAGE_SLOTS) {
    const parsed = parseImage(body[key], DEFAULT_ABOUT[key], storageOrigin, strict)
    if (typeof parsed === 'string') return `${label}: ${parsed.toLowerCase()}`
    images[key] = parsed
  }

  const rawValues = Array.isArray(body.values) ? body.values : []
  const values = DEFAULT_ABOUT.values.map((fallback, index) => {
    const value = (rawValues[index] && typeof rawValues[index] === 'object' ? rawValues[index] : {}) as Record<string, unknown>
    return {
      title: str(value.title, ABOUT_VALUE_TITLE_LIMIT) || (strict ? '' : fallback.title),
      text: str(value.text, ABOUT_VALUE_TEXT_LIMIT) || (strict ? '' : fallback.text),
    }
  })
  if (strict && values.some((value) => !value.title)) return 'Każdy z trzech wyróżników musi mieć tytuł.'

  const storyParagraphs = parseParagraphs(body.storyParagraphs)
  const thanksParagraphs = parseParagraphs(body.thanksParagraphs)

  return {
    ...text,
    ...images,
    values,
    storyParagraphs: storyParagraphs.length || strict ? storyParagraphs : DEFAULT_ABOUT.storyParagraphs,
    thanksParagraphs: thanksParagraphs.length || strict ? thanksParagraphs : DEFAULT_ABOUT.thanksParagraphs,
  }
}

/** Splits `**bold**` markup into plain and bold segments so editors can emphasize a phrase without HTML. */
export function splitBold(text: string): { text: string; bold: boolean }[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) => (part.startsWith('**') && part.endsWith('**') && part.length > 4 ? { text: part.slice(2, -2), bold: true } : { text: part, bold: false }))
}
