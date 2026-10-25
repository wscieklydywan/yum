const HOUR = 60 * 60 * 1000
const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Warsaw', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })

function warsawOffset(date: Date) {
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second))
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/** Warsaw midnight starting the calendar day of the given moment. */
export function warsawMidnight(date = new Date()) {
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
  const guess = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))
  return new Date(guess - warsawOffset(new Date(guess - warsawOffset(new Date(guess)))))
}

/** The midnight that ends the calendar day of the given moment (DST-safe). */
export const midnightAfter = (date: Date) => warsawMidnight(new Date(warsawMidnight(date).getTime() + 36 * HOUR))

/** An open day left open past midnight counts as closed – it is closed automatically. */
export const isOpenPastMidnight = (dayOpen: boolean, dayOpenedAt: string | null, date = new Date()) =>
  dayOpen && !!dayOpenedAt && new Date(dayOpenedAt).getTime() < warsawMidnight(date).getTime()

/** Finished orders are locked once the day they belong to is closed. */
export function isFinishedOrderLocked(settings: { dayOpen: boolean; dayOpenedAt: string | null }, finishedAt: string | undefined) {
  if (!finishedAt || !settings.dayOpen || !settings.dayOpenedAt) return true
  return new Date(finishedAt).getTime() < new Date(settings.dayOpenedAt).getTime()
}
