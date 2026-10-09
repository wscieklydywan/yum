import { RESTAURANT, distanceKm, formatDistance } from '@/lib/restaurant'
import { deliveryFeeFor, deliveryRadius, formatKm, type DeliveryZone } from '@/lib/order-settings'

export type DeliveryZoneResult =
  | { ok: true; distanceKm: number; fee: number; resolvedAddress: string }
  | { ok: false; reason: 'not_found' | 'out_of_range' | 'unavailable'; message: string; distanceKm?: number }

type NominatimResult = { lat: string; lon: string; place_rank: number; display_name: string }

// Street-level (26) or more precise; anything coarser (city, district) would measure from the town centre.
const MIN_PLACE_RANK = 26

export async function checkDeliveryZone(street: string, city: string, zones: DeliveryZone[]): Promise<DeliveryZoneResult> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    countrycodes: 'pl',
    limit: '1',
    'accept-language': 'pl',
    street: street.trim().slice(0, 180),
    city: city.trim().slice(0, 100),
  })

  let results: NominatimResult[]
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': 'YummyRybnik-Orders/1.0 (zamowienia yummy rybnik)' },
      next: { revalidate: 60 * 60 * 24 },
      signal: AbortSignal.timeout(6000),
    })
    if (!response.ok) throw new Error(`Geocoding failed: ${response.status}`)
    results = (await response.json()) as NominatimResult[]
  } catch (error) {
    console.error('[delivery-zone] geocoding error', error)
    return {
      ok: false,
      reason: 'unavailable',
      message: 'Nie udało się teraz sprawdzić adresu. Spróbuj ponownie za chwilę lub zadzwoń do nas.',
    }
  }

  const match = results[0]
  if (!match || match.place_rank < MIN_PLACE_RANK) {
    return {
      ok: false,
      reason: 'not_found',
      message: 'Nie znaleźliśmy tego adresu. Sprawdź nazwę ulicy, numer i miasto.',
    }
  }

  const distance = distanceKm(RESTAURANT.coordinates, { lat: Number(match.lat), lon: Number(match.lon) })
  const rounded = Math.round(distance * 10) / 10
  const fee = deliveryFeeFor(zones, rounded)
  if (fee === null) {
    return {
      ok: false,
      reason: 'out_of_range',
      distanceKm: rounded,
      message: `Ten adres jest ${formatDistance(rounded)} od lokalu. Dowozimy w promieniu ${formatKm(deliveryRadius(zones))} km – wybierz odbiór osobisty.`,
    }
  }

  return { ok: true, distanceKm: rounded, fee, resolvedAddress: match.display_name }
}
