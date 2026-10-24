export type PromotionScope = 'all' | 'categories' | 'products'
/**
 * `online` = online without a known fulfilment (menu badges, banners) – pickup-only promotions still show.
 * `online_delivery` / `online_pickup` = a concrete online order; pickup-only promotions skip deliveries.
 */
export type PromotionChannel = 'online' | 'online_delivery' | 'online_pickup' | 'in_store' | 'in_store_delivery'

export const onlineChannel = (pickup: boolean): PromotionChannel => (pickup ? 'online_pickup' : 'online_delivery')
/** Orders entered on the bar: deliveries get their own channel so pickup-only promotions skip them too. */
export const inStoreChannel = (delivery: boolean): PromotionChannel => (delivery ? 'in_store_delivery' : 'in_store')
const isInStore = (channel?: PromotionChannel) => channel === 'in_store' || channel === 'in_store_delivery'
const isDelivery = (channel?: PromotionChannel) => channel === 'online_delivery' || channel === 'in_store_delivery'
/** percent = every matching item cheaper; nth_item = after buying `buy_quantity` items the next one gets a special price. */
export type PromotionKind = 'percent' | 'nth_item'

export type Promotion = {
  id: string
  title: string
  description: string
  kind: PromotionKind
  discount_percent: number
  /** nth_item: how many full-price items unlock the reward (1 = "second item for …"). */
  buy_quantity: number
  /** nth_item: fixed price of the reward item (0 = free). Null = use discount_percent on the reward item. */
  reward_price: number | null
  excluded_product_ids: string[]
  scope: PromotionScope
  category_ids: string[]
  product_ids: string[]
  /** ISO weekdays: 1 = Monday … 7 = Sunday. Empty = every day. */
  days: number[]
  start_time: string | null
  end_time: string | null
  valid_from: string | null
  valid_to: string | null
  online: boolean
  /** No delivery orders at all – neither online nor entered on the bar. */
  online_pickup_only: boolean
  in_store: boolean
  active: boolean
  sort: number
}

/** `amount` is the line total; `quantity` (default 1) lets nth-item promotions count individual pieces. */
export type PromotionLine = { productId: string; category?: string | null; amount: number; quantity?: number }
/** `count` = how many pieces got the reward (nth_item) or the percentage discount. */
export type AppliedPromotion = { promotion: Promotion; amount: number; count?: number }

export const PROMOTION_COLUMNS = 'id, title, description, kind, discount_percent, buy_quantity, reward_price, excluded_product_ids, scope, category_ids, product_ids, days, start_time, end_time, valid_from, valid_to, online, online_pickup_only, in_store, active, sort'

export const WEEKDAYS = [
  { day: 1, short: 'Pn', long: 'poniedziałek', every: 'W każdy poniedziałek' },
  { day: 2, short: 'Wt', long: 'wtorek', every: 'W każdy wtorek' },
  { day: 3, short: 'Śr', long: 'środa', every: 'W każdą środę' },
  { day: 4, short: 'Cz', long: 'czwartek', every: 'W każdy czwartek' },
  { day: 5, short: 'Pt', long: 'piątek', every: 'W każdy piątek' },
  { day: 6, short: 'Sb', long: 'sobota', every: 'W każdą sobotę' },
  { day: 7, short: 'Nd', long: 'niedziela', every: 'W każdą niedzielę' },
] as const

const warsawFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Warsaw',
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const WEEKDAY_INDEX: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

function warsawClock(date: Date) {
  const parts = Object.fromEntries(warsawFormat.formatToParts(date).map((part) => [part.type, part.value]))
  return {
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 1,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
  }
}

const toMinutes = (time: string | null) => {
  if (!time) return null
  const [hours, minutes] = time.split(':').map(Number)
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null
}

export const shortTime = (time: string | null) => time?.slice(0, 5) ?? ''

/** True when the promotion is switched on and its schedule covers this moment (Polish time). */
export function isPromotionRunning(promotion: Promotion, date: Date = new Date(), channel?: PromotionChannel) {
  if (!promotion.active) return false
  if (isInStore(channel) && !promotion.in_store) return false
  if (channel && !isInStore(channel) && !promotion.online) return false
  if (isDelivery(channel) && promotion.online_pickup_only) return false
  return matchesSchedule(promotion, date)
}

export function matchesSchedule(promotion: Promotion, date: Date = new Date()) {
  const clock = warsawClock(date)
  if (promotion.valid_from && clock.ymd < promotion.valid_from) return false
  if (promotion.valid_to && clock.ymd > promotion.valid_to) return false
  if (promotion.days.length && !promotion.days.includes(clock.weekday)) return false
  const start = toMinutes(promotion.start_time)
  const end = toMinutes(promotion.end_time)
  if (start === null && end === null) return true
  const from = start ?? 0
  const to = end ?? 24 * 60
  return from < to ? clock.minutes >= from && clock.minutes < to : clock.minutes >= from || clock.minutes < to
}

export function promotionAppliesTo(promotion: Promotion, item: { productId: string; category?: string | null }) {
  if (promotion.excluded_product_ids?.includes(item.productId)) return false
  if (promotion.scope === 'all') return true
  if (promotion.scope === 'products') return promotion.product_ids.includes(item.productId)
  return !!item.category && promotion.category_ids.includes(item.category)
}

const isBundle = (promotion: Pick<Promotion, 'kind'>) => promotion.kind === 'nth_item'

/** The best running percentage promotion for a single product (highest percentage wins, promotions never stack). */
export function bestPromotionFor(promotions: Promotion[], item: { productId: string; category?: string | null }, channel: PromotionChannel, date: Date = new Date()) {
  let best: Promotion | null = null
  for (const promotion of promotions) {
    if (isBundle(promotion) || !isPromotionRunning(promotion, date, channel) || !promotionAppliesTo(promotion, item)) continue
    if (!best || Number(promotion.discount_percent) > Number(best.discount_percent)) best = promotion
  }
  return best
}

/** A running "N-th item" promotion the product takes part in – used for menu badges. */
export function bundlePromotionFor(promotions: Promotion[], item: { productId: string; category?: string | null }, channel: PromotionChannel, date: Date = new Date()) {
  return promotions.find((promotion) => isBundle(promotion) && isPromotionRunning(promotion, date, channel) && promotionAppliesTo(promotion, item)) ?? null
}

const round = (value: number) => Math.round(value * 100) / 100

function rewardDiscount(promotion: Promotion, unitPrice: number) {
  if (promotion.reward_price !== null && promotion.reward_price !== undefined) return Math.max(0, unitPrice - Number(promotion.reward_price))
  return (unitPrice * Number(promotion.discount_percent)) / 100
}

/**
 * Splits the order into single pieces and prices them:
 * 1. "N-th item" promotions take groups of (buy_quantity + 1) matching pieces, most expensive first;
 *    the cheapest piece of each group gets the reward price.
 * 2. Remaining pieces get the best percentage promotion – or `fallbackPercent` (e.g. fan status) when it is better.
 * Promotions never stack on the same piece.
 */
export function allocatePromotions(lines: PromotionLine[], promotions: Promotion[], channel: PromotionChannel, date: Date = new Date(), fallbackPercent = 0) {
  const running = promotions.filter((promotion) => isPromotionRunning(promotion, date, channel))
  const units: { line: PromotionLine; price: number; used: boolean }[] = []
  for (const line of lines) {
    if (line.amount <= 0) continue
    const quantity = Math.max(1, Math.floor(line.quantity ?? 1))
    for (let index = 0; index < quantity; index++) units.push({ line, price: line.amount / quantity, used: false })
  }

  const byPromotion = new Map<string, AppliedPromotion>()
  const add = (promotion: Promotion, amount: number) => {
    const entry = byPromotion.get(promotion.id) ?? { promotion, amount: 0, count: 0 }
    entry.amount += amount
    entry.count = (entry.count ?? 0) + 1
    byPromotion.set(promotion.id, entry)
  }

  for (const promotion of running.filter(isBundle)) {
    const size = Math.max(1, promotion.buy_quantity) + 1
    const eligible = units.filter((unit) => !unit.used && promotionAppliesTo(promotion, unit.line)).sort((a, b) => b.price - a.price)
    for (let start = 0; start + size <= eligible.length; start += size) {
      const group = eligible.slice(start, start + size)
      const amount = rewardDiscount(promotion, group[size - 1].price)
      const fallbackAmount = (group.reduce((sum, unit) => sum + unit.price, 0) * fallbackPercent) / 100
      if (amount <= 0 || fallbackAmount >= amount) continue
      for (const unit of group) unit.used = true
      add(promotion, amount)
    }
  }

  let fallbackAmount = 0
  for (const unit of units) {
    if (unit.used) continue
    const promotion = bestPromotionFor(running, unit.line, channel, date)
    const percent = promotion ? Number(promotion.discount_percent) : 0
    if (fallbackPercent > percent) fallbackAmount += (unit.price * fallbackPercent) / 100
    else if (promotion) add(promotion, (unit.price * percent) / 100)
  }

  const applied = [...byPromotion.values()].map((entry) => ({ ...entry, amount: round(entry.amount) }))
  return { applied, promotionAmount: round(applied.reduce((sum, entry) => sum + entry.amount, 0)), fallbackAmount: round(fallbackAmount) }
}

export function promotionDiscount(lines: PromotionLine[], promotions: Promotion[], channel: PromotionChannel, date: Date = new Date()) {
  const { applied, promotionAmount } = allocatePromotions(lines, promotions, channel, date)
  return { discount: promotionAmount, applied }
}

const formatZl = (value: number) => `${Number(value).toLocaleString('pl-PL', { maximumFractionDigits: 2 })} zł`

type LabelFields = Pick<Promotion, 'discount_percent'> & Partial<Pick<Promotion, 'kind' | 'buy_quantity' | 'reward_price'>>

/** Short badge text: "-20%", "2. za 10 zł", "3. gratis". */
export function discountLabel(promotion: LabelFields) {
  if (promotion.kind !== 'nth_item') return `-${Number(promotion.discount_percent).toLocaleString('pl-PL')}%`
  const nth = `${(promotion.buy_quantity ?? 1) + 1}.`
  if (promotion.reward_price === null || promotion.reward_price === undefined) return `${nth} -${Number(promotion.discount_percent).toLocaleString('pl-PL')}%`
  return Number(promotion.reward_price) === 0 ? `${nth} gratis` : `${nth} za ${formatZl(Number(promotion.reward_price))}`
}

/** Receipt line, e.g. "Promocja Drugi burger za 10 zł" – skips the badge when the title already says it. */
export function promotionReceiptLabel({ promotion }: AppliedPromotion) {
  const label = discountLabel(promotion)
  const reward = promotion.kind === 'nth_item' && promotion.reward_price !== null ? formatZl(Number(promotion.reward_price)) : label
  const title = promotion.title.toLocaleLowerCase('pl-PL').includes(reward.toLocaleLowerCase('pl-PL')) ? promotion.title : `${promotion.title} ${label}`
  return `Promocja ${title}`
}

/** Full sentence describing an N-th item rule, e.g. "Kupując 1 szt., kolejna za 10 zł". */
export function describeReward(promotion: LabelFields) {
  if (promotion.kind !== 'nth_item') return `${discountLabel(promotion)} na każdą sztukę`
  const buy = promotion.buy_quantity ?? 1
  const reward = promotion.reward_price === null || promotion.reward_price === undefined
    ? `taniej o ${Number(promotion.discount_percent).toLocaleString('pl-PL')}%`
    : Number(promotion.reward_price) === 0 ? 'gratis' : `za ${formatZl(Number(promotion.reward_price))}`
  return `Kupując ${buy} szt., ${buy + 1}. sztuka ${reward} (tańsza w grupie)`
}

export function describeDays(days: number[]) {
  const sorted = [...new Set(days)].sort()
  if (!sorted.length || sorted.length === 7) return 'Codziennie'
  if (sorted.length === 1) return WEEKDAYS[sorted[0] - 1]?.every ?? 'Codziennie'
  if (sorted.join() === '1,2,3,4,5') return 'Od poniedziałku do piątku'
  if (sorted.join() === '6,7') return 'W weekendy'
  const contiguous = sorted.every((day, index) => index === 0 || day === sorted[index - 1] + 1)
  if (contiguous && sorted.length > 2) return `${WEEKDAYS[sorted[0] - 1].short}–${WEEKDAYS[sorted.at(-1)! - 1].short}`
  return sorted.map((day) => WEEKDAYS[day - 1].short).join(', ')
}

export function describeSchedule(promotion: Pick<Promotion, 'days' | 'start_time' | 'end_time'>) {
  const days = describeDays(promotion.days)
  if (!promotion.start_time && !promotion.end_time) return `${days}, cały dzień`
  return `${days}, ${shortTime(promotion.start_time) || '00:00'}–${shortTime(promotion.end_time) || '24:00'}`
}

const shortList = (labels: string[]) => labels.length > 3 ? `${labels.slice(0, 3).join(', ')} +${labels.length - 3}` : labels.join(', ')

export function describeScope(promotion: Pick<Promotion, 'scope' | 'category_ids' | 'product_ids'> & Partial<Pick<Promotion, 'excluded_product_ids'>>, names?: { categories?: Map<string, string>; products?: Map<string, string> }) {
  const excluded = promotion.scope === 'products' || !names?.products ? [] : (promotion.excluded_product_ids ?? []).map((id) => names.products!.get(id) ?? id)
  const suffix = excluded.length ? ` (bez: ${shortList(excluded)})` : ''
  if (promotion.scope === 'all') return `Całe menu${suffix}`
  const ids = promotion.scope === 'categories' ? promotion.category_ids : promotion.product_ids
  const lookup = promotion.scope === 'categories' ? names?.categories : names?.products
  const labels = ids.map((id) => lookup?.get(id) ?? id)
  if (!labels.length) return promotion.scope === 'categories' ? 'Wybrane kategorie' : 'Wybrane produkty'
  return `${shortList(labels)}${suffix}`
}

/** "Online (tylko odbiór) · Na barze" */
export function describeChannels(promotion: Pick<Promotion, 'online' | 'online_pickup_only' | 'in_store'>) {
  const channels = [promotion.online && 'Online', promotion.in_store && 'Na miejscu'].filter(Boolean).join(' · ') || '—'
  return promotion.online_pickup_only ? `${channels} (bez dostawy)` : channels
}

/** Order note fragment shown on the bar ("Promocja …" is hidden from the kitchen). */
export const promotionNote = (applied: AppliedPromotion[]) =>
  applied.map(({ promotion }) => `Promocja ${promotion.title} ${discountLabel(promotion)}`).join(' · ')

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const ids = (value: unknown) => Array.isArray(value) ? [...new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0 && entry.length <= 80))].slice(0, 200) : []

export type PromotionInput = Omit<Promotion, 'id' | 'active' | 'sort'> & { active?: boolean }

export function parsePromotionInput(raw: unknown): Parsed<PromotionInput> {
  const body = (raw ?? {}) as Record<string, unknown>
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (title.length < 2 || title.length > 60) return { ok: false, error: 'Nazwa promocji musi mieć od 2 do 60 znaków.' }
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 200) : ''
  const kind: PromotionKind = body.kind === 'nth_item' ? 'nth_item' : 'percent'
  const number = (value: unknown) => Math.round(Number(String(value ?? '').replace(',', '.')) * 100) / 100
  const hasRewardPrice = kind === 'nth_item' && body.reward_price !== null && body.reward_price !== undefined && body.reward_price !== ''
  const reward_price = hasRewardPrice ? number(body.reward_price) : null
  const percent = reward_price !== null ? 0 : number(body.discount_percent)
  if (reward_price !== null) {
    if (!Number.isFinite(reward_price) || reward_price < 0 || reward_price > 999) return { ok: false, error: 'Cena nagrody musi wynosić od 0 do 999 zł.' }
  } else if (!Number.isFinite(percent) || percent <= 0 || percent > 90) {
    return { ok: false, error: 'Rabat musi wynosić od 1 do 90%.' }
  }
  const buy_quantity = kind === 'nth_item' ? Math.floor(Number(body.buy_quantity)) : 1
  if (!Number.isInteger(buy_quantity) || buy_quantity < 1 || buy_quantity > 9) return { ok: false, error: 'Liczba sztuk do kupienia: od 1 do 9.' }
  const scope = body.scope === 'categories' || body.scope === 'products' ? body.scope : 'all'
  const category_ids = scope === 'categories' ? ids(body.category_ids) : []
  const product_ids = scope === 'products' ? ids(body.product_ids) : []
  const excluded_product_ids = scope === 'products' ? [] : ids(body.excluded_product_ids)
  if (scope === 'categories' && !category_ids.length) return { ok: false, error: 'Wybierz przynajmniej jedną kategorię.' }
  if (scope === 'products' && !product_ids.length) return { ok: false, error: 'Wybierz przynajmniej jeden produkt.' }
  const days = Array.isArray(body.days) ? [...new Set(body.days.map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7))].sort() : []
  const start_time = typeof body.start_time === 'string' && body.start_time ? body.start_time.slice(0, 5) : null
  const end_time = typeof body.end_time === 'string' && body.end_time ? body.end_time.slice(0, 5) : null
  if ((start_time && !TIME.test(start_time)) || (end_time && !TIME.test(end_time))) return { ok: false, error: 'Nieprawidłowa godzina.' }
  if (start_time && end_time && start_time === end_time) return { ok: false, error: 'Godzina rozpoczęcia i zakończenia nie mogą być takie same.' }
  const valid_from = typeof body.valid_from === 'string' && DATE.test(body.valid_from) ? body.valid_from : null
  const valid_to = typeof body.valid_to === 'string' && DATE.test(body.valid_to) ? body.valid_to : null
  if (valid_from && valid_to && valid_from > valid_to) return { ok: false, error: 'Data końca jest przed datą początku.' }
  const online = body.online !== false
  const in_store = body.in_store !== false
  if (!online && !in_store) return { ok: false, error: 'Promocja musi działać online albo na miejscu.' }
  const online_pickup_only = body.online_pickup_only === true
  return {
    ok: true,
    value: {
      title, description, kind, discount_percent: percent, buy_quantity, reward_price, excluded_product_ids, scope, category_ids, product_ids, days,
      start_time, end_time, valid_from, valid_to, online, online_pickup_only, in_store,
      ...(typeof body.active === 'boolean' ? { active: body.active } : {}),
    },
  }
}

export const normalizePromotion = (row: Promotion): Promotion => ({
  ...row,
  kind: row.kind === 'nth_item' ? 'nth_item' : 'percent',
  discount_percent: Number(row.discount_percent),
  buy_quantity: Number(row.buy_quantity ?? 1) || 1,
  reward_price: row.reward_price === null || row.reward_price === undefined ? null : Number(row.reward_price),
  excluded_product_ids: row.excluded_product_ids ?? [],
  online_pickup_only: Boolean(row.online_pickup_only),
  days: (row.days ?? []).map(Number),
  category_ids: row.category_ids ?? [],
  product_ids: row.product_ids ?? [],
})
