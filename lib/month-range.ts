const ZONE = 'Europe/Warsaw'

const partsFormat = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })

/** UTC instant of local midnight on the 1st of the given month in Warsaw (handles DST). */
function warsawMonthStart(year: number, monthIndex: number) {
  const guess = Date.UTC(year, monthIndex, 1)
  const parts = Object.fromEntries(partsFormat.formatToParts(new Date(guess)).map((part) => [part.type, part.value]))
  const asLocal = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second))
  return new Date(guess - (asLocal - guess))
}

/** "2026-10" for the month the instant falls into, in Warsaw time. */
export function monthIdOf(value: string | Date) {
  const parts = Object.fromEntries(partsFormat.formatToParts(new Date(value)).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}`
}

export function isMonthId(value: string | null): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

/** [1st of month 00:00, 1st of next month 00:00) in Warsaw, as ISO strings. */
export function monthRange(id: string) {
  const [year, month] = id.split('-').map(Number)
  return { from: warsawMonthStart(year, month - 1).toISOString(), to: warsawMonthStart(year, month).toISOString() }
}

/** Month ids from the given one up to the current month, newest first. */
export function monthIdsSince(firstId: string, now = new Date()) {
  const ids: string[] = []
  const [lastYear, lastMonth] = monthIdOf(now).split('-').map(Number)
  let [year, month] = firstId.split('-').map(Number)
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    ids.push(`${year}-${String(month).padStart(2, '0')}`)
    month += 1
    if (month > 12) { month = 1; year += 1 }
  }
  return ids.reverse()
}
