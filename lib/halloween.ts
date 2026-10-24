import { createClient } from '@/lib/supabase/client'

export const HALLOWEEN_STATE_KEY = 'halloween-state'
export const HALLOWEEN_LEADERBOARD_KEY = 'halloween-leaderboard'
export const HALLOWEEN_ENDS_LABEL = '1 listopada'

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

export const podiumPrizes = [
  { place: 1, title: 'Zestaw dla dwóch + 500 Stars', short: 'Zestaw dla dwóch', menuValue: 106.96, stars: 500 },
  { place: 2, title: 'Burger gratis + 300 Stars', short: 'Burger gratis', menuValue: 31.99, stars: 300 },
  { place: 3, title: 'Frytki i napój + 150 Stars', short: 'Frytki i napój', menuValue: 21.49, stars: 150 },
] as const

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
