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

const tiers = [
  { name: 'Brązowy', min: 0, next: 500, color: 'text-[#c9825a]' },
  { name: 'Srebrny', min: 500, next: 1500, color: 'text-[#9aa1aa]' },
  { name: 'Złoty', min: 1500, next: null, color: 'text-[#e0a21f]' },
] as const

export function getTier(points: number) {
  const tier = [...tiers].reverse().find((item) => points >= item.min) ?? tiers[0]
  const progress = tier.next ? Math.min(100, Math.round(((points - tier.min) / (tier.next - tier.min)) * 100)) : 100
  return { ...tier, progress, missing: tier.next ? tier.next - points : 0 }
}

export function warsawDate(value: Date | string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date(value))
}

export function isFreeSpinAvailable(lastFreeSpinAt: string | null) {
  return !lastFreeSpinAt || warsawDate(lastFreeSpinAt) < warsawDate(new Date())
}

export const rewards = [
  { key: 'burger', name: 'Burger klasyczny', cost: 150, image: '/images/classic.webp' },
  { key: 'fries', name: 'Frytki', cost: 100, image: '/images/fries.webp' },
  { key: 'drink', name: 'Napój 0,5 l', cost: 100, image: '/images/cola.webp' },
  { key: 'combo', name: 'Zestaw Yummy', cost: 300, image: '/images/combo.webp' },
] as const

export type RewardKey = (typeof rewards)[number]['key']

export type PointTransaction = {
  id: number
  amount: number
  kind: 'spin' | 'spin_cost' | 'staff' | 'redeem' | 'promo'
  note: string | null
  created_at: string
}
