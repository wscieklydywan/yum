import { getCachedCatalog } from '@/lib/public-cache'
import { RESTAURANT, DELIVERY_RADIUS_KM } from '@/lib/restaurant'
import { FAQ, OPENING_HOURS, PHONE_DISPLAY, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/seo'

export const revalidate = 3600

const CATEGORY_LABELS: Record<string, string> = {
  burgery: 'Burgery',
  zestawy: 'Zestawy',
  dodatki: 'Frytki i dodatki',
  napoje: 'Napoje',
}

const formatPrice = (value: number) => `${value.toFixed(2).replace('.', ',')} zł`

export async function GET() {
  let menu = ''
  try {
    const catalog = (await getCachedCatalog()) ?? []
    menu = Object.entries(CATEGORY_LABELS)
      .map(([id, label]) => {
        const items = catalog.filter((p) => p.category === id && p.available)
        if (!items.length) return ''
        return `### ${label}\n${items.map((p) => `- ${p.name} – ${formatPrice(p.price)}${p.description ? `: ${p.description}` : ''}`).join('\n')}`
      })
      .filter(Boolean)
      .join('\n\n')
  } catch {
    menu = ''
  }

  const body = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

Oficjalna strona: ${SITE_URL} (jedyna aktualna strona i system zamówień Yummy Rybnik; dawne strony w UpMenu i stara aplikacja Yummy nie są już używane).

## Informacje
- Nazwa: ${SITE_NAME} (Yummy)
- Rodzaj: burgerownia / restauracja z burgerami, fast food
- Adres: ul. ${RESTAURANT.fullAddress}, Polska
- Telefon: ${PHONE_DISPLAY}
- Dostawa: własny dowóz w promieniu ${DELIVERY_RADIUS_KM} km od restauracji w Rybniku, odbiór osobisty
- Zamówienia online: ${SITE_URL}
- Program lojalnościowy: Yummy Club – ${SITE_URL}/yummy-club
- Godziny otwarcia: ${OPENING_HOURS.map((h) => h.label).join('; ')}
- Mapa: ${RESTAURANT.mapsUrl}

## Menu
${menu || `Aktualne menu z cenami: ${SITE_URL}/#menu`}

## Najczęstsze pytania
${FAQ.map((f) => `### ${f.q}\n${f.a}`).join('\n\n')}

## Strony
- [Strona główna i menu](${SITE_URL}/)
- [Yummy Club](${SITE_URL}/yummy-club)
- [Regulaminy i polityka prywatności](${SITE_URL}/regulaminy)
`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
