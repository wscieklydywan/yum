import { PACKAGING, PACKAGING_KINDS, type PackagingKind } from './packaging'

/** Fee zones are contiguous: each zone starts where the previous one ends (the first one at 0 km). */
export type DeliveryZone = { upToKm: number; fee: number }
export type PackagingPrices = Record<PackagingKind, number>

export const DEFAULT_MIN_ORDER = 40
export const MAX_MIN_ORDER = 1000
export const MAX_ZONES = 10
export const MAX_ZONE_KM = 50
export const MAX_ZONE_FEE = 200
export const MAX_PACKAGING_PRICE = 50

export const DEFAULT_DELIVERY_ZONES: DeliveryZone[] = [
  { upToKm: 2, fee: 8 },
  { upToKm: 4, fee: 10 },
  { upToKm: 6, fee: 15 },
  { upToKm: 10, fee: 20 },
]

export const DEFAULT_PACKAGING_PRICES = Object.fromEntries(PACKAGING_KINDS.map((kind) => [kind, PACKAGING[kind].price])) as PackagingPrices

const isMoney = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max && Math.round(value * 100) === value * 100

export function parseMinOrder(raw: unknown): number | null {
  const value = typeof raw === 'string' ? Number(raw) : raw
  return isMoney(value, MAX_MIN_ORDER) ? value : null
}

/** Zones must have strictly increasing distances; returns null when the payload is malformed. */
export function parseDeliveryZones(raw: unknown): DeliveryZone[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_ZONES) return null
  const zones: DeliveryZone[] = []
  let previous = 0
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return null
    const { upToKm, fee } = entry as Record<string, unknown>
    if (typeof upToKm !== 'number' || !Number.isFinite(upToKm) || upToKm <= previous || upToKm > MAX_ZONE_KM || Math.round(upToKm * 10) !== upToKm * 10) return null
    if (!isMoney(fee, MAX_ZONE_FEE)) return null
    zones.push({ upToKm, fee })
    previous = upToKm
  }
  return zones
}

export function parsePackagingPrices(raw: unknown): PackagingPrices | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const source = raw as Record<string, unknown>
  const prices = { ...DEFAULT_PACKAGING_PRICES }
  for (const kind of PACKAGING_KINDS) {
    if (source[kind] === undefined) continue
    if (!isMoney(source[kind], MAX_PACKAGING_PRICE)) return null
    prices[kind] = source[kind] as number
  }
  return prices
}

/** `null` = delivery is never free; `undefined` = malformed value. */
export function parseFreeDeliveryFrom(raw: unknown): number | null | undefined {
  if (raw === null) return null
  return parseMinOrder(raw) ?? undefined
}

/** Delivery fee after applying the optional free-delivery threshold (compared with the value of products). */
export function applyFreeDelivery(fee: number, productsValue: number, freeDeliveryFrom: number | null) {
  return freeDeliveryFrom !== null && productsValue >= freeDeliveryFrom ? 0 : fee
}

export const deliveryRadius = (zones: DeliveryZone[]) => zones[zones.length - 1]?.upToKm ?? 0

/** Fee for a distance, or null when the address is beyond the last zone. */
export function deliveryFeeFor(zones: DeliveryZone[], distanceKm: number): number | null {
  return zones.find((zone) => distanceKm <= zone.upToKm)?.fee ?? null
}

export const zoneStart = (zones: DeliveryZone[], index: number) => (index === 0 ? 0 : zones[index - 1].upToKm)

export const formatKm = (km: number) => km.toLocaleString('pl-PL', { maximumFractionDigits: 1 })

export const formatZoneRange = (zones: DeliveryZone[], index: number) => `${formatKm(zoneStart(zones, index))}–${formatKm(zones[index].upToKm)} km`
