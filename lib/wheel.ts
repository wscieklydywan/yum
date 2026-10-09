import {
  Beef,
  CakeSlice,
  Candy,
  Clover,
  Coffee,
  Coins,
  Crown,
  CupSoda,
  Drumstick,
  Flame,
  Frown,
  Gift,
  Hamburger,
  Heart,
  IceCreamCone,
  PartyPopper,
  Percent,
  Popcorn,
  Sparkles,
  Star,
  Tag,
  Ticket,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react'

export const WHEEL_REWARD_TYPES = ['points', 'free_item', 'discount_percent', 'discount_amount', 'nothing'] as const
export type WheelRewardType = (typeof WHEEL_REWARD_TYPES)[number]

export const WHEEL_REWARD_LABELS: Record<WheelRewardType, string> = {
  points: 'Punkty',
  free_item: 'Darmowa pozycja z menu',
  discount_percent: 'Rabat procentowy',
  discount_amount: 'Rabat kwotowy',
  nothing: 'Brak nagrody',
}

export const WHEEL_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  gift: { icon: Gift, label: 'Prezent' },
  crown: { icon: Crown, label: 'Korona' },
  tag: { icon: Tag, label: 'Metka' },
  percent: { icon: Percent, label: 'Procent' },
  ticket: { icon: Ticket, label: 'Bilet' },
  coins: { icon: Coins, label: 'Monety' },
  star: { icon: Star, label: 'Gwiazda' },
  sparkles: { icon: Sparkles, label: 'Iskry' },
  trophy: { icon: Trophy, label: 'Puchar' },
  party: { icon: PartyPopper, label: 'Konfetti' },
  heart: { icon: Heart, label: 'Serce' },
  flame: { icon: Flame, label: 'Płomień' },
  zap: { icon: Zap, label: 'Błyskawica' },
  clover: { icon: Clover, label: 'Koniczyna' },
  burger: { icon: Hamburger, label: 'Burger' },
  beef: { icon: Beef, label: 'Mięso' },
  drumstick: { icon: Drumstick, label: 'Kurczak' },
  soda: { icon: CupSoda, label: 'Napój' },
  coffee: { icon: Coffee, label: 'Kawa' },
  icecream: { icon: IceCreamCone, label: 'Lody' },
  cake: { icon: CakeSlice, label: 'Ciasto' },
  candy: { icon: Candy, label: 'Cukierek' },
  popcorn: { icon: Popcorn, label: 'Przekąska' },
  frown: { icon: Frown, label: 'Pudło' },
}

export function wheelIcon(name: string) {
  return (WHEEL_ICONS[name] ?? WHEEL_ICONS.gift).icon
}

export type WheelPrize = {
  id: string
  sort: number
  label: string
  description: string
  reward_type: WheelRewardType
  points: number
  product_id: string | null
  product_name: string
  discount_value: number
  coupon_hours: number
  visual: 'image' | 'icon'
  image: string
  icon: string
}

export type WheelPrizeAdmin = WheelPrize & { chance: number; active: boolean }

export const WHEEL_PUBLIC_FIELDS =
  'id, sort, label, description, reward_type, points, product_id, product_name, discount_value, coupon_hours, visual, image, icon'

export const WHEEL_PRIZES_KEY = '/api/wheel'
export const MIN_WHEEL_SEGMENTS = 2
export const MAX_WHEEL_SEGMENTS = 12

const seed = (id: string, sort: number, label: string, description: string, points: number, visual: 'image' | 'icon', image: string, icon: string): WheelPrize => ({
  id, sort, label, description, reward_type: 'points', points, product_id: null, product_name: '', discount_value: 0, coupon_hours: 24, visual, image, icon,
})

export const DEFAULT_WHEEL_PRIZES: WheelPrize[] = [
  seed('seed-0', 0, 'Burger', 'Burger klasyczny', 150, 'image', '/images/classic.webp', 'gift'),
  seed('seed-1', 1, 'Frytki', 'Porcja frytek', 30, 'image', '/images/fries.webp', 'gift'),
  seed('seed-2', 2, 'Korona', 'Główna nagroda', 300, 'icon', '', 'crown'),
  seed('seed-3', 3, 'Napój', 'Napój 0,5 l', 20, 'image', '/images/cola.webp', 'gift'),
  seed('seed-4', 4, 'Prezent', 'Niespodzianka od Yummy', 50, 'icon', '', 'gift'),
  seed('seed-5', 5, 'Kupon', 'Drobny bonus', 10, 'icon', '', 'tag'),
]

const money = (value: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value)

export function formatChance(value: number) {
  return `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 3 }).format(value)}%`
}

export function parseChance(value: string) {
  const parsed = Number(value.replace(',', '.').replace(/[^\d.]/g, ''))
  return Number.isFinite(parsed) ? Math.round(parsed * 1000) / 1000 : NaN
}

export function rewardSummary(prize: Pick<WheelPrize, 'reward_type' | 'points' | 'product_name' | 'discount_value'>) {
  switch (prize.reward_type) {
    case 'points':
      return `+${prize.points} pkt`
    case 'free_item':
      return prize.product_name ? `Gratis: ${prize.product_name}` : 'Darmowa pozycja'
    case 'discount_percent':
      return `-${new Intl.NumberFormat('pl-PL').format(prize.discount_value)}%`
    case 'discount_amount':
      return `-${money(prize.discount_value)}`
    default:
      return 'Bez nagrody'
  }
}

export function formatCouponDiscount(type: 'percent' | 'amount', value: number) {
  return type === 'percent' ? `Rabat ${new Intl.NumberFormat('pl-PL').format(value)}%` : `Rabat ${money(value)}`
}
