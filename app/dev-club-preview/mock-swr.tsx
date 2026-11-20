'use client'

import type { ReactNode } from 'react'
import { SWRConfig } from 'swr'
import { ACTIVE_COUPONS_KEY } from '@/lib/coupons'
import { HALLOWEEN_RESULTS_KEY, HALLOWEEN_STATE_KEY } from '@/lib/halloween'

const soon = new Date(Date.now() + 20 * 3600 * 1000).toISOString()

export function MockSwr({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateIfStale: false,
        revalidateOnFocus: false,
        fallback: {
          [HALLOWEEN_STATE_KEY]: { active: false, ends_at: '2026-11-01T22:59:59+00:00', games_left: 0, daily_games: 3, stars_today: 0, daily_star_cap: 30, points_per_star: 10, max_stars_per_game: 10, best_score: 900 },
          [HALLOWEEN_RESULTS_KEY]: { ended: true, finalized: true, ends_at: '2026-11-01T22:59:59+00:00', players: 124, my_rank: { rank: 17, score: 900 }, winners: [{ place: 1, name: 'Kamil', score: 2620 }], mine: null },
          [ACTIVE_COUPONS_KEY]: [
            { id: 1, code: 'A3F9C1', reward: 'Frytki cienkie gratis', cost: 80, items: [], expires_at: soon, created_at: soon },
            { id: 2, code: 'B71E04', reward: 'Burger Classic za Stars', cost: 250, items: [], expires_at: soon, created_at: soon },
          ],
        },
      }}
    >
      {children}
    </SWRConfig>
  )
}
