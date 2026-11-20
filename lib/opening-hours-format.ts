import type { DayHours } from './restaurant-status'

const SHORT_DAYS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz'] as const
const SCHEMA_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

export type HoursGroup = { from: number; to: number; hours: DayHours; days: string; time: string }

const sameHours = (a: DayHours, b: DayHours) => a.closed === b.closed && (a.closed || (a.open === b.open && a.close === b.close))

const displayClose = (close: string) => (close === '00:00' ? '24:00' : close)

/** Consecutive days with identical hours collapse into one row, e.g. "Pon – Czw: 12:00 – 22:00". */
export function groupOpeningHours(hours: DayHours[]): HoursGroup[] {
  const groups: { from: number; to: number; hours: DayHours }[] = []
  hours.forEach((day, index) => {
    const last = groups.at(-1)
    if (last && sameHours(last.hours, day)) last.to = index
    else groups.push({ from: index, to: index, hours: day })
  })
  return groups.map((group) => ({
    ...group,
    days:
      group.from === 0 && group.to === 6
        ? 'Codziennie'
        : group.from === group.to
          ? SHORT_DAYS[group.from]
          : `${SHORT_DAYS[group.from]} – ${SHORT_DAYS[group.to]}`,
    time: group.hours.closed ? 'nieczynne' : `${group.hours.open} – ${displayClose(group.hours.close)}`,
  }))
}

export const openingHoursText = (hours: DayHours[]) =>
  groupOpeningHours(hours).map((group) => `${group.days}: ${group.time}`).join(', ')

export function openingHoursSchema(hours: DayHours[]) {
  return groupOpeningHours(hours)
    .filter((group) => !group.hours.closed)
    .map((group) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: SCHEMA_DAYS.slice(group.from, group.to + 1),
      opens: group.hours.open,
      closes: group.hours.close === '00:00' ? '23:59' : group.hours.close,
    }))
}
