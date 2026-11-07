import { RESTAURANT } from '@/lib/restaurant'
import { tiers } from '@/lib/loyalty'
import { describeStarRate, type LoyaltyRate } from '@/lib/loyalty-rate'
import { formatKm } from '@/lib/order-settings'
import { openingHoursSchema, openingHoursText } from '@/lib/opening-hours-format'
import type { DayHours } from '@/lib/restaurant-status'

export const SITE_URL = 'https://www.yummyrybnik.pl'
export const SITE_NAME = 'Yummy Rybnik'
export const SITE_TAGLINE = 'Good Burgers, Better Days'
export const PHONE = '+48537776907'
export const PHONE_DISPLAY = '+48 537 776 907'
export const OG_IMAGE = '/og-image.jpg'

export const SITE_DESCRIPTION =
  'Najlepsze burgery w Rybniku: soczysta wołowina i autorskie sosy. Zamów online z dostawą do 10 km lub odbierz przy ul. Andersa 7.'

export const SITE_KEYWORDS = [
  'Yummy Rybnik',
  'Yummy',
  'yummyrybnik.pl',
  'burgery Rybnik',
  'najlepsze burgery w Rybniku',
  'najlepsze burgery Rybnik',
  'burger Rybnik',
  'smash burger Rybnik',
  'jedzenie Rybnik',
  'najlepsze jedzenie w Rybniku',
  'jedzenie na dowóz Rybnik',
  'dostawa jedzenia Rybnik',
  'fast food Rybnik',
  'frytki Rybnik',
  'restauracja Rybnik',
  'zamów burgera online Rybnik',
  'Yummy Club',
  'Andersa 7 Rybnik',
]

/** Live values from Warsztat that public texts depend on (see lib/public-info.ts). */
export type SiteFacts = {
  openingHours: DayHours[] | null
  radiusKm: number
  rate: LoyaltyRate
  wheelEnabled: boolean
}

const maxTierPercent = Math.max(...tiers.map((tier) => tier.percent))

export function buildFaq(facts: SiteFacts) {
  return [
  {
    q: 'Gdzie Was znajdę?',
    a: `Na Andersa 7 w Rybniku. Wpadnij na burgera na miejscu, odbierz zamówienie po drodze albo zamów z dostawą – jak Ci wygodniej.`,
  },
  {
    q: 'Dowozicie do mnie?',
    a: `Jeździmy do ${formatKm(facts.radiusKm)} km od lokalu, więc pewnie tak. Wpisz adres w koszyku – od razu zobaczysz, czy dojedziemy, a potem śledzisz kuriera na żywo.`,
  },
  {
    q: 'Jak najszybciej zamówić?',
    a: 'Przez tę stronę: wrzucasz burgery, frytki i napoje do koszyka, wybierasz dostawę albo odbiór i gotowe. Możesz też zamówić na konkretną godzinę, np. na przerwę w pracy.',
  },
  {
    q: 'Zamawiałem kiedyś przez inną stronę albo aplikację – to dalej działa?',
    a: 'Nie, stare systemy zamówień i dawną aplikację wyłączyliśmy. Wszystko – menu, ceny, promocje i Yummy Club – jest teraz tylko na yummyrybnik.pl.',
  },
  {
    q: 'Kiedy jesteście otwarci?',
    a: facts.openingHours
      ? `${openingHoursText(facts.openingHours)}. Jeśli coś się zmienia, zobaczysz to od razu przy zamówieniu.`
      : 'Aktualne godziny zobaczysz od razu przy zamówieniu.',
  },
  {
    q: 'Co daje Yummy Club?',
    a: `${describeStarRate(facts.rate)} – Stars wymieniasz na darmowe jedzenie, a na wyższych poziomach masz stały rabat do -${maxTierPercent}%${facts.wheelEnabled ? ' i codziennie darmowe zakręcenie kołem fortuny' : ''}. Konto jest za darmo i zakładasz je w minutę.`,
  },
  ]
}

export function absoluteUrl(path = '/') {
  if (/^https?:\/\//.test(path)) return path
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

/** Serialises JSON-LD safely for a <script> tag (prevents `</script>` breakouts). */
export function jsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

type MenuItemInput = { name: string; description?: string; price: number; image?: string; category: string; available?: boolean }

const CATEGORY_LABELS: Record<string, string> = {
  burgery: 'Burgery',
  zestawy: 'Zestawy',
  dodatki: 'Frytki i dodatki',
  napoje: 'Napoje',
}

export function restaurantSchema(menu: MenuItemInput[], facts: SiteFacts) {
  const sections = Object.entries(CATEGORY_LABELS)
    .map(([id, label]) => ({
      '@type': 'MenuSection',
      name: label,
      hasMenuItem: menu
        .filter((item) => item.category === id && item.available !== false)
        .map((item) => ({
          '@type': 'MenuItem',
          name: item.name,
          ...(item.description ? { description: item.description } : {}),
          ...(item.image ? { image: absoluteUrl(item.image) } : {}),
          offers: { '@type': 'Offer', price: item.price.toFixed(2), priceCurrency: 'PLN' },
        })),
    }))
    .filter((section) => section.hasMenuItem.length > 0)

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        alternateName: ['Yummy', 'Yummy Burgers Rybnik', 'yummyrybnik.pl'],
        inLanguage: 'pl-PL',
        publisher: { '@id': `${SITE_URL}/#restaurant` },
      },
      {
        '@type': ['Restaurant', 'FastFoodRestaurant'],
        '@id': `${SITE_URL}/#restaurant`,
        name: SITE_NAME,
        alternateName: 'Yummy',
        slogan: SITE_TAGLINE,
        description: SITE_DESCRIPTION,
        url: SITE_URL,
        image: [absoluteUrl(OG_IMAGE), absoluteUrl('/images/hero-burger.webp')],
        logo: absoluteUrl('/icon.png'),
        telephone: PHONE,
        priceRange: '$$',
        currenciesAccepted: 'PLN',
        paymentAccepted: 'Gotówka, Karta, BLIK',
        servesCuisine: ['Burgery', 'Kuchnia amerykańska', 'Fast food'],
        acceptsReservations: false,
        address: {
          '@type': 'PostalAddress',
          streetAddress: `ul. ${RESTAURANT.street}`,
          postalCode: RESTAURANT.postcode,
          addressLocality: RESTAURANT.city,
          addressRegion: 'śląskie',
          addressCountry: 'PL',
        },
        geo: { '@type': 'GeoCoordinates', latitude: RESTAURANT.coordinates.lat, longitude: RESTAURANT.coordinates.lon },
        hasMap: RESTAURANT.mapsUrl,
        areaServed: {
          '@type': 'GeoCircle',
          geoMidpoint: { '@type': 'GeoCoordinates', latitude: RESTAURANT.coordinates.lat, longitude: RESTAURANT.coordinates.lon },
          geoRadius: facts.radiusKm * 1000,
        },
        ...(facts.openingHours ? { openingHoursSpecification: openingHoursSchema(facts.openingHours) } : {}),
        hasMenu: {
          '@type': 'Menu',
          '@id': `${SITE_URL}/#menu`,
          name: 'Menu Yummy Rybnik',
          url: `${SITE_URL}/#menu`,
          inLanguage: 'pl-PL',
          ...(sections.length ? { hasMenuSection: sections } : {}),
        },
        potentialAction: {
          '@type': 'OrderAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${SITE_URL}/#menu`,
            inLanguage: 'pl-PL',
            actionPlatform: ['http://schema.org/DesktopWebPlatform', 'http://schema.org/MobileWebPlatform'],
          },
          deliveryMethod: ['http://purl.org/goodrelations/v1#DeliveryModeOwnFleet', 'http://purl.org/goodrelations/v1#DeliveryModePickUp'],
        },
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE_URL}/#faq`,
        mainEntity: buildFaq(facts).map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
  }
}
