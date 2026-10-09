export const RESTAURANT = {
  name: 'Yummy Rybnik',
  street: 'Generała Władysława Andersa 7',
  postcode: '44-270',
  city: 'Rybnik',
  fullAddress: 'Generała Władysława Andersa 7, 44-270 Rybnik',
  shortAddress: 'ul. Gen. W. Andersa 7, Rybnik',
  coordinates: { lat: 50.0592581, lon: 18.4894257 },
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Yummy+Rybnik%2C+Genera%C5%82a+W%C5%82adys%C5%82awa+Andersa+7%2C+44-270+Rybnik',
} as const

export const DELIVERY_RADIUS_KM = 10

export type Coordinates = { lat: number; lon: number }

export function distanceKm(from: Coordinates, to: Coordinates) {
  const earthRadiusKm = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(to.lat - from.lat)
  const dLon = toRad(to.lon - from.lon)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a))
}

export function formatDistance(km: number) {
  return `${km.toLocaleString('pl-PL', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km`
}
