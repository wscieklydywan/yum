import type { DeliveryZone, PackagingPrices } from './order-settings'
import type { VatLetter } from './vat'
import { isOpenPastMidnight, midnightAfter } from './business-day'

export type DayHours = { open: string; close: string; closed: boolean }

export type RestaurantSettings = {
  kitchenOpen: boolean
  barOpen: boolean
  dayOpen: boolean
  dayOpenedAt: string | null
  /** When the last business day was closed. */
  dayClosedAt: string | null
  /** The day was left open and closed automatically at midnight – the reports still need attention. */
  dayAutoClosed: boolean
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
  /** VAT letter stamped on packaging items when they are added to an order. */
  packagingVat: VatLetter
  /** VAT letter of the "Dostawa" receipt line. */
  deliveryVat: VatLetter
  /** Online ordering forced on outside opening hours until this moment (ISO). */
  orderingOverrideUntil: string | null
  cashPaymentEnabled: boolean
  /** Card terminal – also covers BLIK paid on the terminal. */
  cardPaymentEnabled: boolean
}

export type CustomerPaymentMethod = 'cash' | 'card'

export const paymentMethodEnabled = (settings: Pick<RestaurantSettings, 'cashPaymentEnabled' | 'cardPaymentEnabled'>, method: CustomerPaymentMethod) =>
  method === 'cash' ? settings.cashPaymentEnabled : settings.cardPaymentEnabled

export type RestaurantStatus = RestaurantSettings & {
  withinHours: boolean
  overrideActive: boolean
  acceptingOrders: boolean
  reason: string | null
  /** Blocks online orders for a later hour too (staff paused kitchen and bar). */
  preorderReason: string | null
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

export function computeStatus(stored: RestaurantSettings, date = new Date()): RestaurantStatus {
  // A day left open past midnight is closed automatically, even before that is written to the database.
  const settings = isOpenPastMidnight(stored.dayOpen, stored.dayOpenedAt, date)
    ? { ...stored, dayOpen: false, dayClosedAt: midnightAfter(new Date(stored.dayOpenedAt!)).toISOString(), dayAutoClosed: true, orderingOverrideUntil: null }
    : stored
  const closeBefore = settings.closeBeforeMinutes ?? 0
  const regularHours = !settings.autoHours || isWithinHours(settings.openingHours, date, closeBefore)
  const overrideActive = !regularHours && settings.dayOpen && !!settings.orderingOverrideUntil && new Date(settings.orderingOverrideUntil).getTime() > date.getTime()
  const withinHours = regularHours || overrideActive
  const todayHours = settings.openingHours[warsawClock(date).weekday] ?? null
  // Whether staff has opened the business day never shows up for customers – only opening hours do.
  let reason: string | null = null
  const stationsOff = settings.dayOpen && !settings.kitchenOpen && !settings.barOpen
  if (!withinHours) reason = closedReason(settings.openingHours, date)
  else if (stationsOff) reason = 'Kuchnia i bar są chwilowo wyłączone.'
  const preorderReason = stationsOff ? 'Kuchnia i bar są chwilowo wyłączone. Spróbuj za chwilę.' : null
  return { ...settings, withinHours, overrideActive, todayHours, acceptingOrders: settings.dayOpen && reason === null, reason, preorderReason }
}

const WEEKDAYS_ON = ['w poniedziałek', 'we wtorek', 'w środę', 'w czwartek', 'w piątek', 'w sobotę', 'w niedzielę'] as const

/** Next regular opening (today if it has not opened yet), looking up to a week ahead. */
export function nextOpening(hours: DayHours[], date = new Date()) {
  const { weekday, minutes } = warsawClock(date)
  for (let offset = 0; offset < 7; offset++) {
    const index = (weekday + offset) % 7
    const day = hours[index]
    if (!day || day.closed) continue
    if (offset === 0 && minutes >= toMinutes(day.open)) continue
    return { day: offset === 0 ? 'dziś' : offset === 1 ? 'jutro' : WEEKDAYS_ON[index], time: day.open }
  }
  return null
}

function closedReason(hours: DayHours[], date: Date) {
  const next = nextOpening(hours, date)
  if (!next) return 'Lokal jest nieczynny w najbliższych dniach.'
  return `Lokal jest teraz zamknięty – otwieramy ${next.day} o ${next.time}. Możesz już teraz zamówić na wybraną godzinę po ${next.time}.`
}

export type Station = 'kitchen' | 'cashier'

export const stationOpen = (status: Pick<RestaurantSettings, 'kitchenOpen' | 'barOpen'>, station: Station) =>
  station === 'kitchen' ? status.kitchenOpen : status.barOpen

export const stationLabel = (station: Station) => station === 'kitchen' ? 'Kuchnia' : 'Bar'
