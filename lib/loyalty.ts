export const MAX_STAFF_POINTS = 1000

export const wheelSegments = [
  { label: 'Burger', prize: 150 },
  { label: 'Frytki', prize: 30 },
  { label: 'Korona', prize: 300 },
  { label: 'Napój', prize: 20 },
  { label: 'Prezent', prize: 50 },
  { label: 'Kupon', prize: 10 },
] as const

export type ClubTierName = 'Fan' | 'Srebrny Fan' | 'Złoty Fan'

/** Editable in Warsztat → Yummy Club; stored in restaurant_settings and read by private.club_tier_percent. */
export type ClubTierSettings = {
  silverMin: number
  goldMin: number
  silverPercent: number
  goldPercent: number
  perks: { fan: string[]; silver: string[]; gold: string[] }
}

export const DEFAULT_TIER_SETTINGS: ClubTierSettings = {
  silverMin: 1000,
  goldMin: 3000,
  silverPercent: 5,
  goldPercent: 10,
  perks: { fan: [], silver: [], gold: [] },
}

export const MAX_TIER_THRESHOLD = 1_000_000
export const MAX_TIER_PERCENT = 50
export const MAX_TIER_PERKS = 6
export const MAX_TIER_PERK_LENGTH = 80

export type ClubTier = { name: ClubTierName; min: number; next: number | null; percent: number; color: string; perks: string[] }

export function parsePerks(value: string | null | undefined) {
  return (value ?? '').split('\n').map((line) => line.trim()).filter(Boolean).slice(0, MAX_TIER_PERKS)
}

export function buildTiers(settings: ClubTierSettings = DEFAULT_TIER_SETTINGS): ClubTier[] {
  return [
    { name: 'Fan', min: 0, next: settings.silverMin, percent: 0, color: 'text-[#f0c8a8]', perks: settings.perks.fan },
    { name: 'Srebrny Fan', min: settings.silverMin, next: settings.goldMin, percent: settings.silverPercent, color: 'text-[#c7ccd3]', perks: settings.perks.silver },
    { name: 'Złoty Fan', min: settings.goldMin, next: null, percent: settings.goldPercent, color: 'text-[#f5b936]', perks: settings.perks.gold },
  ]
}

/** Fallback only – live thresholds come from the database. Progress counts only Stars earned from purchases. */
export const tiers = buildTiers()

export function getTier(statusPoints: number, list: ClubTier[] = tiers) {
  const index = Math.max(0, list.findLastIndex((item) => statusPoints >= item.min))
  const tier = list[index]
  const nextTier = list[index + 1] ?? null
  const progress = tier.next ? Math.min(100, Math.round(((statusPoints - tier.min) / (tier.next - tier.min)) * 100)) : 100
  return { ...tier, nextTier, progress, missing: tier.next ? tier.next - statusPoints : 0 }
}

export function warsawDate(value: Date | string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date(value))
}

export function isFreeSpinAvailable(lastFreeSpinAt: string | null) {
  return !lastFreeSpinAt || warsawDate(lastFreeSpinAt) < warsawDate(new Date())
}

/** Offline fallback only – the live catalog is `loyalty_rewards`, edited in Warsztat and served by /api/club/loyalty. `value` = menu price in zł. */
export const rewards = [
  { key: 'sauce', name: 'Sos do wyboru', note: 'Do każdego zamówienia', cost: 15, value: 2, image: '/images/ingredient-sauce.webp' },
  { key: 'double', name: 'Upgrade na DOUBLE', note: 'Do burgera z zamówienia', cost: 40, value: 6, image: '/images/bbq-bacon.webp' },
  { key: 'drink', name: 'Napój 0,5 l', note: 'Pepsi, 7UP, Mirinda lub woda', cost: 50, value: 8.5, image: '/images/cola.webp' },
  { key: 'fries', name: 'Frytki cienkie', note: 'Porcja frytek', cost: 70, value: 12.99, image: '/images/fries.webp' },
  { key: 'rings', name: 'Krążki cebulowe', note: 'Chrupiąca porcja', cost: 90, value: 14.99, image: '/images/onion-rings.webp' },
  { key: 'nuggets', name: 'Nuggetsy', note: 'Porcja nuggetsów', cost: 100, value: 15.99, image: '/images/nuggets.webp' },
  { key: 'burger', name: 'Burger SERTASTIC', note: 'Wersja SINGLE', cost: 300, value: 31.99, image: '/images/classic.webp' },
  { key: 'combo', name: 'Zestaw SERTASTIC', note: 'Burger + frytki + napój', cost: 450, value: 53.48, image: '/images/combo.webp' },
] as const

export type RewardKey = (typeof rewards)[number]['key']

export type PointTransaction = {
  id: number
  amount: number
  kind: 'spin' | 'spin_cost' | 'staff' | 'redeem' | 'promo' | 'purchase' | 'refund' | 'game' | 'payment'
  note: string | null
  created_at: string
}

export const POINT_KIND_LABELS: Record<PointTransaction['kind'], string> = {
  spin: 'Koło fortuny',
  spin_cost: 'Dodatkowe zakręcenie',
  staff: 'Punkty od obsługi',
  redeem: 'Odebrana nagroda',
  promo: 'Kod promocyjny',
  purchase: 'Stars za zakupy',
  refund: 'Zwrot zamówienia',
  game: 'Dyniowe Łowy',
  payment: 'Płatność Stars',
}
