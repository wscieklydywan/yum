import { DELIVERY_RADIUS_KM, RESTAURANT } from '@/lib/restaurant'

export const SITE_URL = 'https://www.yummyrybnik.pl'
export const SITE_NAME = 'Yummy Rybnik'
export const SITE_TAGLINE = 'Good Burgers, Better Days'
export const PHONE = '+48537776907'
export const PHONE_DISPLAY = '+48 537 776 907'
export const OG_IMAGE = '/og-image.png'

export const SITE_DESCRIPTION =
  'Yummy Rybnik – najlepsze burgery w Rybniku. Soczysta wołowina, świeże dodatki i autorskie sosy. Zamów online na yummyrybnik.pl z dostawą do 10 km lub odbiorem osobistym przy ul. Andersa 7 i zbieraj punkty w Yummy Club.'

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

/** Opening hours shown in the footer; schema.org needs them per day. */
export const OPENING_HOURS = [
  { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'], opens: '11:00', closes: '22:00', label: 'Pon – Czw: 11:00 – 22:00' },
  { days: ['Friday', 'Saturday'], opens: '11:00', closes: '23:59', label: 'Pt – Sob: 11:00 – 24:00' },
  { days: ['Sunday'], opens: '12:00', closes: '21:00', label: 'Niedziela: 12:00 – 21:00' },
] as const

export const FAQ = [
  {
    q: 'Gdzie Was znajdę?',
    a: 'Na Andersa 7 w Rybniku. Wpadnij na burgera na miejscu, odbierz zamówienie po drodze albo zamów z dostawą – jak Ci wygodniej.',
  },
  {
    q: 'Dowozicie do mnie?',
    a: `Jeździmy do ${DELIVERY_RADIUS_KM} km od lokalu, więc pewnie tak. Wpisz adres w koszyku – od razu zobaczysz, czy dojedziemy, a potem śledzisz kuriera na żywo.`,
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
    a: `${OPENING_HOURS.map((h) => h.label).join(', ')}. Jeśli coś się zmienia, zobaczysz to od razu przy zamówieniu.`,
  },
  {
    q: 'Co daje Yummy Club?',
    a: 'Za każde zamówienie wpadają Ci punkty, które wymieniasz na darmowe jedzenie i rabaty. Konto jest za darmo i zakładasz je w minutę.',
  },
] as const

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

export function restaurantSchema(menu: MenuItemInput[] = []) {
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
          geoRadius: DELIVERY_RADIUS_KM * 1000,
        },
        openingHoursSpecification: OPENING_HOURS.map((h) => ({
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: h.days,
          opens: h.opens,
          closes: h.closes,
        })),
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
        mainEntity: FAQ.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
  }
}
