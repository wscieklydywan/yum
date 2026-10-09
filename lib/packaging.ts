export const PACKAGING = {
  burger: { name: 'Opakowanie na burgera', short: 'Burger', price: 0.6 },
  box: { name: 'Opakowanie box', short: 'Box', price: 0.7 },
  wrap: { name: 'Opakowanie na wrapa', short: 'Wrap', price: 0.7 },
  foil: { name: 'Folia aluminiowa', short: 'Folia', price: 1 },
  bag: { name: 'Duża torba', short: 'Torba', price: 1 },
} as const

export type PackagingKind = keyof typeof PACKAGING
export type PackagingCounts = Partial<Record<PackagingKind, number>>

export const PACKAGING_KINDS = Object.keys(PACKAGING) as PackagingKind[]
export const MAX_PACKAGING = 50

type PackagingProduct = { name: string; category: string; description?: string }

/** Packaging one unit of a menu product needs when it leaves the restaurant. */
export function packagingForProduct(product: PackagingProduct): PackagingCounts {
  const name = product.name.toLocaleLowerCase('pl-PL')
  const text = `${name} ${product.description ?? ''}`.toLocaleLowerCase('pl-PL')
  // Nuggets only need the order bag – checked before "junior" because their description mentions Chicko Junior.
  if (/nugget/.test(name)) return {}
  // Junior burgers go in foil only – no burger box.
  if (/\bjunior\b/.test(text)) return { foil: 1 }
  if (/\bbox\b/.test(name)) return { box: 1 }
  if (product.category === 'wrapy') return { wrap: 1 }
  if (/\bdublet\b/.test(name)) return { burger: 2 }
  if (product.category === 'burgery' || product.category === 'vege' || name === 'chicko') return { burger: 1 }
  return {}
}

export const needsPackaging = (type: string) => type === 'Dostawa' || type === 'Odbiór osobisty'

/** Automatic packaging for takeaway and delivery: one per burger/box/wrap, foil for juniors and one large bag per order. */
export function autoPackaging(lines: { product: PackagingProduct; quantity: number }[], type: string, { bag = true }: { bag?: boolean } = {}): PackagingCounts {
  if (!needsPackaging(type)) return {}
  const counts: PackagingCounts = {}
  for (const { product, quantity } of lines) {
    for (const [kind, perUnit] of Object.entries(packagingForProduct(product)) as [PackagingKind, number][]) {
      counts[kind] = (counts[kind] ?? 0) + perUnit * quantity
    }
  }
  if (bag && lines.length > 0) counts.bag = 1
  return counts
}

/** Prices come from the workshop settings; the constants above are only the fallback. */
export type PackagingPriceList = Partial<Record<PackagingKind, number>>
export const packagingPrice = (kind: PackagingKind, prices?: PackagingPriceList) => prices?.[kind] ?? PACKAGING[kind].price

export const packagingTotal = (counts: PackagingCounts, prices?: PackagingPriceList) =>
  Math.round(PACKAGING_KINDS.reduce((sum, kind) => sum + packagingPrice(kind, prices) * (counts[kind] ?? 0), 0) * 100) / 100

export const packagingCount = (counts: PackagingCounts) => PACKAGING_KINDS.reduce((sum, kind) => sum + (counts[kind] ?? 0), 0)

/** Validates packaging counts sent by the bar. Returns null when the payload is malformed. */
export function parsePackaging(raw: unknown): PackagingCounts | null {
  if (raw === undefined || raw === null) return {}
  if (typeof raw !== 'object' || Array.isArray(raw)) return null
  const counts: PackagingCounts = {}
  for (const [kind, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(kind in PACKAGING)) return null
    if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > MAX_PACKAGING) return null
    if (value) counts[kind as PackagingKind] = value as number
  }
  return counts
}

export type PackagingItem = { quantity: number; name: string; unitPrice: number; station: 'cashier'; done: true; packaging: PackagingKind }

/** Order items for packaging. They are pre-ticked so they never hold an order back at a station. */
export const packagingItems = (counts: PackagingCounts, prices?: PackagingPriceList): PackagingItem[] =>
  PACKAGING_KINDS.flatMap((kind) => (counts[kind] ?? 0) > 0
    ? [{ quantity: counts[kind]!, name: PACKAGING[kind].name, unitPrice: packagingPrice(kind, prices), station: 'cashier' as const, done: true as const, packaging: kind }]
    : [])
