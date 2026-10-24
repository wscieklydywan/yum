export const EXTRA_SPIN_COST = 50
export const MAX_STAFF_POINTS = 1000

export const wheelSegments = [
  { label: 'Burger', prize: 150 },
  { label: 'Frytki', prize: 30 },
  { label: 'Korona', prize: 300 },
  { label: 'Napój', prize: 20 },
  { label: 'Prezent', prize: 50 },
  { label: 'Kupon', prize: 10 },
] as const

/** Must match private.club_tier_percent in the database. Progress counts only Stars earned from purchases. */
export const tiers = [
  { name: 'Fan', min: 0, next: 100, percent: 0, color: 'text-[#f0c8a8]' },
  { name: 'Srebrny Fan', min: 100, next: 300, percent: 5, color: 'text-[#c7ccd3]' },
  { name: 'Złoty Fan', min: 300, next: null, percent: 10, color: 'text-[#f5b936]' },
] as const

export function getTier(statusPoints: number) {
  const index = Math.max(0, tiers.findLastIndex((item) => statusPoints >= item.min))
  const tier = tiers[index]
  const nextTier = tiers[index + 1] ?? null
  const progress = tier.next ? Math.min(100, Math.round(((statusPoints - tier.min) / (tier.next - tier.min)) * 100)) : 100
  return { ...tier, nextTier, progress, missing: tier.next ? tier.next - statusPoints : 0 }
}

export const tierPercent = (statusPoints: number) => getTier(statusPoints).percent

export function warsawDate(value: Date | string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date(value))
}

export function isFreeSpinAvailable(lastFreeSpinAt: string | null) {
  return !lastFreeSpinAt || warsawDate(lastFreeSpinAt) < warsawDate(new Date())
}

/** Must match public.redeem_reward in the database (supabase/migrations/20261027_rewards_catalog.sql). `value` = menu price in zł. */
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
  kind: 'spin' | 'spin_cost' | 'staff' | 'redeem' | 'promo' | 'purchase' | 'refund' | 'game'
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
}
