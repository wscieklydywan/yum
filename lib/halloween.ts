import { createClient } from '@/lib/supabase/client'

export const HALLOWEEN_STATE_KEY = 'halloween-state'
export const HALLOWEEN_LEADERBOARD_KEY = 'halloween-leaderboard'
export const HALLOWEEN_RESULTS_KEY = '/api/club/halloween-results'
export const HALLOWEEN_ENDS_LABEL = '1 listopada'

/** Ostatni dzień gry w formacie „1 listopada” (koniec o północy liczy się jako dzień wcześniej). */
export function halloweenEndsLabel(endsAt?: string | null) {
  if (!endsAt) return HALLOWEEN_ENDS_LABEL
  const lastMoment = new Date(new Date(endsAt).getTime() - 1)
  if (Number.isNaN(lastMoment.getTime())) return HALLOWEEN_ENDS_LABEL
  return new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', day: 'numeric', month: 'long' }).format(lastMoment)
}

export type HalloweenWinner = { place: number; name: string; score: number; prize: string; me: boolean }

export type HalloweenMyPrize = {
  place: number
  score: number
  prize: string
  stars: number
  code: string | null
  expires_at: string | null
  redeemed: boolean
  expired: boolean
}

export type HalloweenResults = {
  ended: boolean
  finalized: boolean
  ends_at: string
  players: number
  my_rank: { rank: number; score: number } | null
  winners: HalloweenWinner[]
  mine: HalloweenMyPrize | null
}

export type HalloweenPrize = { place: number; title: string; short: string }

export type HalloweenPublic = {
  active: boolean
  ended: boolean
  finalized: boolean
  starts_at: string
  ends_at: string
  showcase_until: string
  showcase: boolean
  runner_up_stars: number
  prizes: HalloweenPrize[]
  winners: Omit<HalloweenWinner, 'me'>[]
}

export const HALLOWEEN_PUBLIC_KEY = 'halloween-public'

export async function fetchHalloweenPublic() {
  const { data, error } = await createClient().rpc('halloween_public')
  if (error) throw error
  return data as HalloweenPublic
}

export async function fetchHalloweenResults() {
  const response = await fetch(HALLOWEEN_RESULTS_KEY, { cache: 'no-store' })
  if (!response.ok) throw new Error('Nie udało się wczytać wyników.')
  return (await response.json()) as HalloweenResults
}

export const prizeLabel = (prize: string) => prize.replace(/^Halloween \d+\. miejsce: /, '')

export type HalloweenState = {
  active: boolean
  ends_at: string
  games_left: number
  daily_games: number
  stars_today: number
  daily_star_cap: number
  points_per_star: number
  max_stars_per_game: number
  best_score: number
}

export type LeaderboardEntry = { rank: number; name: string; score: number; me?: boolean }

export type HalloweenLeaderboard = {
  top: LeaderboardEntry[]
  me: LeaderboardEntry | null
  players: number
}

export type GameFinishResult = {
  stars: number
  points: number
  flagged: boolean
  best_score: number
  score: number
}

export const podiumPrizes: HalloweenPrize[] = [
  { place: 1, title: 'Zestaw dla dwóch', short: 'Zestaw dla dwóch' },
  { place: 2, title: 'Burger SERTASTIC gratis', short: 'Burger gratis' },
  { place: 3, title: 'Frytki i napój gratis', short: 'Frytki i napój' },
]

export const RUNNER_UP_STARS = 20
export const RUNNER_UP_LAST_PLACE = 10

export const gameErrorMessages: Record<string, string> = {
  daily_limit: 'Wykorzystałeś dzisiejsze gry. Wróć jutro!',
  event_inactive: 'Halloweenowe łowy są już zamknięte.',
  game_finished: 'Ta gra została już zapisana.',
  not_authenticated: 'Zaloguj się ponownie, aby grać.',
}

export async function fetchHalloweenState() {
  const { data, error } = await createClient().rpc('halloween_state')
  if (error) throw error
  return data as HalloweenState
}

export async function fetchHalloweenLeaderboard() {
  const { data, error } = await createClient().rpc('halloween_leaderboard')
  if (error) throw error
  return data as HalloweenLeaderboard
}
