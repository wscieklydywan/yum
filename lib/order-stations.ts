import type { SupabaseClient } from '@supabase/supabase-js'

export type Station = 'kitchen' | 'cashier'

const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl-PL')

const stripDecorations = (value: string) =>
  normalize(value)
    .replace(/\s*\(zestaw\)$/, '')
    .replace(/^zestaw:\s*/, '')
    .replace(/^(darmow[aey]|gratis)\s+/, '')
    .trim()

/** Generic names used by sets, codes and wheel prizes, mapped to the menu product that decides their station. */
const ALIASES: [RegExp, string][] = [
  [/frytk/, 'frytki cienkie'],
  [/^woda$/, 'woda mineralna niegazowana'],
  [/^nap[oó]j$/, 'pepsi'],
  [/^kawa$/, 'lungo'],
  [/^milkshake klasyczny$/, 'milkshake'],
  [/^(sos )?(barbeque|bbq)$/, 'bbq'],
]

const isStation = (value: unknown): value is Station => value === 'kitchen' || value === 'cashier'

export type StationResolver = (name: string, fallback?: Station) => Station

/**
 * Station for an order line known only by name (set parts, promo-code gifts, wheel prizes, workshop additions).
 * The menu editor is the only source: first the menu product with that name, then the modifier group offering
 * an option with that name (e.g. a sauce), then the caller's fallback.
 */
export async function loadStationResolver(admin: SupabaseClient): Promise<StationResolver> {
  const [products, groups, options] = await Promise.all([
    admin.from('menu_products').select('name, station'),
    admin.from('menu_modifier_groups').select('id, station').eq('active', true),
    admin.from('menu_modifier_options').select('group_id, name, stations').eq('active', true),
  ])
  const byProduct = new Map<string, Station>()
  for (const row of (products.data ?? []) as { name: string | null; station: string | null }[]) {
    if (row.name && isStation(row.station)) byProduct.set(normalize(row.name), row.station)
  }
  const groupStation = new Map<string, Station>()
  for (const row of (groups.data ?? []) as { id: string; station: string | null }[]) {
    if (isStation(row.station)) groupStation.set(row.id, row.station)
  }
  const byOption = new Map<string, Station>()
  for (const row of (options.data ?? []) as { group_id: string; name: string | null; stations: string[] | null }[]) {
    const own = row.stations?.length === 1 ? row.stations[0] : null
    const station = isStation(own) ? own : groupStation.get(row.group_id)
    if (row.name && station && !row.name.includes('+') && !byOption.has(normalize(row.name))) byOption.set(normalize(row.name), station)
  }

  return (name, fallback) => {
    const plain = stripDecorations(name)
    const candidates = [normalize(name), plain, plain.replace(/^sos /, ''), ...ALIASES.filter(([pattern]) => pattern.test(plain)).map(([, target]) => target)]
    for (const candidate of candidates) {
      const station = byProduct.get(candidate)
      if (station) return station
    }
    for (const candidate of candidates) {
      const station = byOption.get(candidate)
      if (station) return station
    }
    return fallback ?? 'kitchen'
  }
}
