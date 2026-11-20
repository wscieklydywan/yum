/**
 * Kafelki sekcji „Aktualnie na czasie” w Yummy Club – kolejność, własne teksty/tła kafelków wbudowanych
 * oraz własne kafelki dodawane w warsztacie (Marketing → Strona główna).
 */

export const BUILTIN_CLUB_TILES = ['advent', 'wheel', 'halloween'] as const
export type BuiltinClubTileId = (typeof BUILTIN_CLUB_TILES)[number]
export type CustomClubTileKey = `tile:${string}`
export type ClubTileKey = BuiltinClubTileId | CustomClubTileKey

export const BUILTIN_CLUB_TILE_LABELS: Record<BuiltinClubTileId, { title: string; hint: string }> = {
  advent: { title: 'Kalendarz adwentowy', hint: 'Pojawia się tylko, gdy kalendarz jest aktywny.' },
  wheel: { title: 'Koło fortuny', hint: 'Kafelek z codziennym zakręceniem.' },
  halloween: { title: 'Dyniowe Łowy', hint: 'Gra Halloween i jej wyniki po zakończeniu.' },
}

export const CLUB_TILE_THEMES = ['red', 'purple', 'dark', 'gold', 'green'] as const
export type ClubTileTheme = (typeof CLUB_TILE_THEMES)[number]
export const CLUB_TILE_THEME_LABELS: Record<ClubTileTheme, string> = { red: 'Czerwony', purple: 'Fioletowy', dark: 'Ciemny', gold: 'Złoty', green: 'Zielony' }

/** Puste pole = tekst domyślny kafelka. */
export type ClubTileOverride = { eyebrow: string; title: string; text: string; image_url: string | null }

export type CustomClubTile = {
  id: string
  eyebrow: string
  title: string
  text: string
  cta_label: string
  href: string | null
  image_url: string | null
  theme: ClubTileTheme
  hidden: boolean
}

export type ClubTilesConfig = {
  order: ClubTileKey[]
  overrides: Partial<Record<BuiltinClubTileId, ClubTileOverride>>
  custom: CustomClubTile[]
}

export const DEFAULT_CLUB_TILES: ClubTilesConfig = { order: [...BUILTIN_CLUB_TILES], overrides: {}, custom: [] }

export const MAX_CUSTOM_CLUB_TILES = 8
export const CLUB_TILE_IMAGE_ASPECT = 2
export const TILE_LIMITS = { eyebrow: 24, title: 40, text: 120, cta: 24, href: 300 } as const

export const customTileKey = (id: string): CustomClubTileKey => `tile:${id}`
export const customTileIdFromKey = (key: string) => (key.startsWith('tile:') ? key.slice(5) : null)
export const isBuiltinClubTile = (value: unknown): value is BuiltinClubTileId =>
  typeof value === 'string' && (BUILTIN_CLUB_TILES as readonly string[]).includes(value)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isSafeHref = (href: string) => /^\/(?!\/)[^\s]*$/.test(href) || /^https:\/\/[^\s]+$/.test(href)
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const image = (value: unknown) => {
  const url = text(value, 500)
  return url && /^https:\/\//.test(url) ? url : null
}

/** Sanitizes anything (stored JSON or a workshop request) into a valid config. */
export function normalizeClubTiles(raw: unknown): ClubTilesConfig {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

  const custom: CustomClubTile[] = []
  for (const item of Array.isArray(source.custom) ? source.custom : []) {
    if (!item || typeof item !== 'object' || custom.length >= MAX_CUSTOM_CLUB_TILES) continue
    const tile = item as Record<string, unknown>
    const id = text(tile.id, 36)
    const title = text(tile.title, TILE_LIMITS.title)
    if (!UUID.test(id) || !title || custom.some((existing) => existing.id === id)) continue
    const href = text(tile.href, TILE_LIMITS.href)
    custom.push({
      id,
      title,
      eyebrow: text(tile.eyebrow, TILE_LIMITS.eyebrow),
      text: text(tile.text, TILE_LIMITS.text),
      cta_label: text(tile.cta_label, TILE_LIMITS.cta),
      href: href && isSafeHref(href) ? href : null,
      image_url: image(tile.image_url),
      theme: (CLUB_TILE_THEMES as readonly unknown[]).includes(tile.theme) ? (tile.theme as ClubTileTheme) : 'red',
      hidden: tile.hidden === true,
    })
  }

  const overrides: ClubTilesConfig['overrides'] = {}
  const rawOverrides = source.overrides && typeof source.overrides === 'object' ? (source.overrides as Record<string, unknown>) : {}
  for (const id of BUILTIN_CLUB_TILES) {
    const value = rawOverrides[id]
    if (!value || typeof value !== 'object') continue
    const entry = value as Record<string, unknown>
    const override = {
      eyebrow: text(entry.eyebrow, TILE_LIMITS.eyebrow),
      title: text(entry.title, TILE_LIMITS.title),
      text: text(entry.text, TILE_LIMITS.text),
      image_url: image(entry.image_url),
    }
    if (override.eyebrow || override.title || override.text || override.image_url) overrides[id] = override
  }

  const valid = new Set<string>([...BUILTIN_CLUB_TILES, ...custom.map((tile) => customTileKey(tile.id))])
  const saved = Array.isArray(source.order) ? source.order.filter((key): key is ClubTileKey => typeof key === 'string' && valid.has(key)) : []
  const unique = [...new Set(saved)]
  const order = [...unique, ...([...valid] as ClubTileKey[]).filter((key) => !unique.includes(key))]

  return { order, overrides, custom }
}

/** The config lives in `home_slides_settings.club_hidden_slides` as one `tiles:<json>` entry, next to the `feed:` flags. */
const STORED_PREFIX = 'tiles:'
export function clubTilesFromStored(raw: unknown): ClubTilesConfig {
  const entry = Array.isArray(raw) ? raw.find((item): item is string => typeof item === 'string' && item.startsWith(STORED_PREFIX)) : undefined
  if (!entry) return DEFAULT_CLUB_TILES
  try {
    return normalizeClubTiles(JSON.parse(entry.slice(STORED_PREFIX.length)))
  } catch {
    return DEFAULT_CLUB_TILES
  }
}
export const clubTilesToStored = (config: ClubTilesConfig) => [`${STORED_PREFIX}${JSON.stringify(normalizeClubTiles(config))}`]
