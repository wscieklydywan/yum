import type { DeliveryZone, PackagingPrices } from './order-settings'

export type DayHours = { open: string; close: string; closed: boolean }

export type RestaurantSettings = {
  kitchenOpen: boolean
  barOpen: boolean
  dayOpen: boolean
  dayOpenedAt: string | null
  autoHours: boolean
  /** Online ordering stops this many minutes before closing time. */
  closeBeforeMinutes: number
  openingHours: DayHours[]
  /** Minimum value of products in an online order (before packaging, discount and delivery). */
  minOrderOnline: number
  deliveryZones: DeliveryZone[]
  /** Products value from which delivery is free; null when delivery is always paid. */
  freeDeliveryFrom: number | null
  packagingPrices: PackagingPrices
  /** Online ordering forced on outside opening hours until this moment (ISO). */
  orderingOverrideUntil: string | null
}

export type RestaurantStatus = RestaurantSettings & {
  withinHours: boolean
  overrideActive: boolean
  acceptingOrders: boolean
  reason: string | null
  todayHours: DayHours | null
}

/** Monday first, matching the order of `opening_hours`. */
export const WEEKDAYS = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'] as const

export const DEFAULT_HOURS: DayHours[] = WEEKDAYS.map(() => ({ open: '11:00', close: '22:00', closed: false }))

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export const isValidTime = (value: unknown): value is string => typeof value === 'string' && TIME_PATTERN.test(value)

const toMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

export function parseOpeningHours(raw: unknown): DayHours[] | null {
  if (!Array.isArray(raw) || raw.length !== 7) return null
  const result: DayHours[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return null
    const { open, close, closed } = entry as Record<string, unknown>
    if (!isValidTime(open) || !isValidTime(close) || typeof closed !== 'boolean') return null
    result.push({ open, close, closed })
  }
  return result
}

/** Weekday (0 = Monday) and minutes since midnight in the restaurant's timezone. */
const WARSAW_FORMAT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

function warsawClock(date: Date) {
  const parts = WARSAW_FORMAT.formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'))
  return { weekday, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

export const MAX_CLOSE_BEFORE_MINUTES = 180

/** Minutes after the day's midnight at which online ordering stops (can exceed 1440 for after-midnight closing). */
export function orderingCutoff(day: DayHours, closeBeforeMinutes = 0) {
  const open = toMinutes(day.open)
  const close = toMinutes(day.close)
  const end = close <= open ? close + 24 * 60 : close
  return Math.max(open, end - closeBeforeMinutes)
}

export const formatClock = (minutes: number) => {
  const normalized = ((minutes % 1440) + 1440) % 1440
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`
}

/** Supports closing after midnight (e.g. 12:00–02:00) by also checking yesterday's overflow. */
export function isWithinHours(hours: DayHours[], date = new Date(), closeBeforeMinutes = 0) {
  const { weekday, minutes } = warsawClock(date)
  const today = hours[weekday]
  if (today && !today.closed && minutes >= toMinutes(today.open) && minutes < orderingCutoff(today, closeBeforeMinutes)) return true
  const yesterday = hours[(weekday + 6) % 7]
  if (yesterday && !yesterday.closed && minutes + 24 * 60 < orderingCutoff(yesterday, closeBeforeMinutes) && minutes + 24 * 60 >= toMinutes(yesterday.open)) return true
  return false
}

export const MAX_OVERRIDE_MINUTES = 24 * 60

/** Next moment (minute precision) at which regular ordering hours start, capped at 24h ahead. */
export function nextOpeningAt(hours: DayHours[], closeBeforeMinutes = 0, from = new Date()) {
  const start = Math.ceil(from.getTime() / 60_000) * 60_000
  for (let minute = 1; minute <= MAX_OVERRIDE_MINUTES; minute++) {
    const candidate = new Date(start + minute * 60_000)
    if (isWithinHours(hours, candidate, closeBeforeMinutes)) return candidate
  }
  return new Date(start + MAX_OVERRIDE_MINUTES * 60_000)
}

export function computeStatus(settings: RestaurantSettings, date = new Date()): RestaurantStatus {
  const closeBefore = settings.closeBeforeMinutes ?? 0
  const regularHours = !settings.autoHours || isWithinHours(settings.openingHours, date, closeBefore)
  const overrideActive = !regularHours && settings.dayOpen && !!settings.orderingOverrideUntil && new Date(settings.orderingOverrideUntil).getTime() > date.getTime()
  const withinHours = regularHours || overrideActive
  const todayHours = settings.openingHours[warsawClock(date).weekday] ?? null
  let reason: string | null = null
  if (!settings.dayOpen) reason = 'Lokal jeszcze nie rozpoczął dnia. Zamówienia online są wstrzymane.'
  else if (!withinHours) reason = todayHours && !todayHours.closed ? `Przyjmujemy zamówienia w godzinach ${todayHours.open}–${formatClock(orderingCutoff(todayHours, closeBefore))}.` : 'Dziś lokal jest nieczynny.'
  else if (!settings.kitchenOpen && !settings.barOpen) reason = 'Kuchnia i bar są chwilowo wyłączone.'
  return { ...settings, withinHours, overrideActive, todayHours, acceptingOrders: reason === null, reason }
}

export type Station = 'kitchen' | 'cashier'

export const stationOpen = (status: Pick<RestaurantSettings, 'kitchenOpen' | 'barOpen'>, station: Station) =>
  station === 'kitchen' ? status.kitchenOpen : status.barOpen

export const stationLabel = (station: Station) => station === 'kitchen' ? 'Kuchnia' : 'Bar'
