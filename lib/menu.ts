export type Category = 'burgery' | 'zestawy' | 'dodatki' | 'napoje'

export type Option = { id: string; label: string; price: number }

export type Product = {
  id: string
  name: string
  description: string
  price: number
  image: string
  category: Category
  badge?: 'Bestseller' | 'Nowość' | 'Ostry'
  rating?: number
  reviews?: number
  sizes?: Option[]
  extras?: Option[]
  variantLabel?: string
}

export const categories: { id: Category; label: string }[] = [
  { id: 'burgery', label: 'Burgery' },
  { id: 'zestawy', label: 'Zestawy' },
  { id: 'dodatki', label: 'Frytki i dodatki' },
  { id: 'napoje', label: 'Napoje' },
]

const burgerSizes: Option[] = [
  { id: 'standard', label: 'Standard', price: 0 },
  { id: 'double', label: 'Podwójne mięso', price: 8 },
  { id: 'triple', label: 'Potrójne mięso', price: 14 },
]

const burgerExtras: Option[] = [
  { id: 'bacon', label: 'Dodatkowy bekon', price: 5 },
  { id: 'cheese', label: 'Ser cheddar', price: 3 },
  { id: 'jalapeno', label: 'Jalapeño', price: 2 },
  { id: 'onion', label: 'Chrupiąca cebulka', price: 2 },
]

const sideSizes: Option[] = [
  { id: 'small', label: 'Małe', price: 0 },
  { id: 'medium', label: 'Średnie', price: 2 },
  { id: 'large', label: 'Duże', price: 4 },
]

export const products: Product[] = [
  {
    id: 'bbq-bacon',
    name: 'BBQ Bacon',
    description:
      'Soczysta wołowina, chrupiący bekon, ser cheddar, karmelizowana cebula, sałata, pomidor, autorski sos BBQ.',
    price: 34.9,
    image: '/images/bbq-bacon.webp',
    category: 'burgery',
    badge: 'Bestseller',
    rating: 4.9,
    reviews: 812,
    sizes: burgerSizes,
    extras: burgerExtras,
  },
  {
    id: 'zacny',
    name: 'Zacny',
    description:
      '100% wołowiny, ser cheddar, bekon, ogórki, chrupiąca cebulka, autorski sos Yummy.',
    price: 34,
    image: '/images/zacny.webp',
    category: 'burgery',
    badge: 'Bestseller',
    rating: 4.9,
    reviews: 821,
    sizes: burgerSizes,
    extras: burgerExtras,
  },
  {
    id: 'classic',
    name: 'Yummy Classic',
    description: 'Wołowina, cheddar, sałata, pomidor, czerwona cebula, autorski sos.',
    price: 28,
    image: '/images/classic.webp',
    category: 'burgery',
    rating: 4.8,
    reviews: 640,
    sizes: burgerSizes,
    extras: burgerExtras,
  },
  {
    id: 'spicy-jalapeno',
    name: 'Spicy Jalapeño',
    description: 'Wołowina, pepper jack, świeże jalapeño, ostry sos chipotle. Ostry charakter, wyjątkowy smak.',
    price: 34.9,
    image: '/images/spicy-jalapeno.webp',
    category: 'burgery',
    badge: 'Ostry',
    rating: 4.7,
    reviews: 318,
    sizes: burgerSizes,
    extras: burgerExtras,
  },
  {
    id: 'truflowy',
    name: 'Truflowy Deluxe',
    description: '100% wołowiny, ser cheddar, rukola, majonez truflowy, prażona cebulka.',
    price: 36,
    image: '/images/truflowy.webp',
    category: 'burgery',
    badge: 'Nowość',
    rating: 4.8,
    reviews: 124,
    sizes: burgerSizes,
    extras: burgerExtras,
  },
  {
    id: 'zestaw',
    name: 'Zestaw Yummy',
    description: 'Dowolny burger + frytki średnie + napój 0,5 l. Wszystko, czego potrzebujesz.',
    price: 44.9,
    image: '/images/combo.webp',
    category: 'zestawy',
    badge: 'Bestseller',
    sizes: [
      { id: 'standard', label: 'Standard', price: 0 },
      { id: 'xl', label: 'XL – duże frytki i napój', price: 4 },
    ],
    extras: burgerExtras,
  },
  {
    id: 'zestaw-dwoch',
    name: 'Zestaw dla dwóch',
    description: '2 burgery Classic, duże frytki, krążki cebulowe i 2 napoje 0,5 l.',
    price: 84.9,
    image: '/images/combo.webp',
    category: 'zestawy',
  },
  {
    id: 'frytki',
    name: 'Frytki klasyczne',
    description: 'Złociste, chrupiące, z odrobiną soli morskiej.',
    price: 8,
    image: '/images/fries.webp',
    category: 'dodatki',
    sizes: sideSizes,
  },
  {
    id: 'onion-rings',
    name: 'Onion Rings',
    description: '8 sztuk chrupiących krążków cebulowych w panierce.',
    price: 14,
    image: '/images/onion-rings.webp',
    category: 'dodatki',
    variantLabel: '8 szt.',
  },
  {
    id: 'nuggets',
    name: 'Nuggetsy',
    description: '6 sztuk soczystych nuggetsów z kurczaka z sosem do wyboru.',
    price: 16.9,
    image: '/images/nuggets.webp',
    category: 'dodatki',
    variantLabel: '6 szt.',
  },
  {
    id: 'cola',
    name: 'Coca-Cola',
    description: 'Orzeźwiająca, mocno schłodzona, z lodem.',
    price: 8,
    image: '/images/cola.webp',
    category: 'napoje',
    variantLabel: '0,5 l',
  },
  {
    id: 'cola-zero',
    name: 'Coca-Cola Zero',
    description: 'Ten sam smak, zero cukru.',
    price: 8,
    image: '/images/cola.webp',
    category: 'napoje',
    variantLabel: '0,5 l',
  },
]

export const formatPrice = (value: number) =>
  `${value.toFixed(2).replace('.', ',')} zł`

export const DELIVERY_FEE = 8
export const FREE_DELIVERY_FROM = 80
