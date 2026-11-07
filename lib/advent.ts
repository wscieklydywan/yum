import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'

export type AdventMode = 'off' | 'teaser' | 'live'
export type AdventKind = 'stars' | 'food' | 'discount' | 'none'
import type { AdventColor } from '@/lib/advent-colors'
export { ADVENT_COLORS, adventDefaultColor, isAdventColor, type AdventColor } from '@/lib/advent-colors'

export type AdventWindow = {
  day: number
  color: AdventColor | null
  openable: boolean
  missed: boolean
  claimed: boolean
  title: string | null
  kind: AdventKind | null
  stars: number | null
  code: string | null
}

export type AdventCalendar = {
  mode: AdventMode
  starts_on: string
  days: number
  today: number
  started: boolean
  ended: boolean
  allow_late: boolean
  teaser_text: string
  show_home_slide: boolean
  show_bubble: boolean
  show_club_banner: boolean
  logged_in: boolean
  windows: AdventWindow[]
}

export type AdventOpenResult = {
  day: number
  kind: AdventKind
  title: string
  description: string
  stars: number
  code: string | null
  expires_at: string | null
  points: number
}

export const ADVENT_KEY = 'advent-calendar'
export const ADVENT_ADMIN_KEY = '/api/workshop/advent'
export const ADVENT_DEFAULT_DAYS = 24

export async function fetchAdventCalendar() {
  const { data, error } = await createClient().rpc('advent_calendar')
  if (error) throw error
  return data as AdventCalendar
}

export async function openAdventWindow(day: number) {
  const { data, error } = await createClient().rpc('advent_open', { p_day: day })
  if (error) throw new Error(adventErrorMessages[error.message] ?? 'Nie udało się otworzyć okienka. Spróbuj ponownie.')
  return data as AdventOpenResult
}

export const adventErrorMessages: Record<string, string> = {
  not_authenticated: 'Zaloguj się do Yummy Club, żeby otworzyć okienko.',
  advent_inactive: 'Kalendarz jeszcze nie wystartował.',
  window_locked: 'To okienko jest jeszcze zamknięte – cierpliwości!',
  window_missed: 'To okienko już minęło. Wróć jutro po kolejne!',
  already_opened: 'To okienko jest już otwarte.',
  profile_missing: 'Okienka otwierają klienci Yummy Club.',
}

/** „1 grudnia” z daty w formacie RRRR-MM-DD. */
export function adventDateLabel(startsOn: string | undefined, offsetDays = 0) {
  if (!startsOn) return '1 grudnia'
  const [year, month, day] = startsOn.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + offsetDays, 12))
  return new Intl.DateTimeFormat('pl-PL', { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(date)
}

export const isAdventVisible = (data: AdventCalendar | undefined): data is AdventCalendar => !!data && data.mode !== 'off'

/** Wspólny stan kalendarza (strona, bąbelek, Yummy Club). Odświeżany co minutę, żeby okienko „dziś” zmieniało się o północy. */
export function useAdventCalendar() {
  return useSWR<AdventCalendar>(ADVENT_KEY, fetchAdventCalendar, { revalidateOnFocus: true, refreshInterval: 60_000, shouldRetryOnError: false })
}
