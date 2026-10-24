import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'
import type { HalloweenAdminData, HalloweenSettings } from '@/lib/loyalty-economics'

const COLUMNS = 'starts_at, ends_at, daily_games, points_per_star, max_stars_per_game, daily_star_cap'

function warsawDayStartIso() {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date())
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Warsaw', timeZoneName: 'longOffset' })
    .formatToParts(new Date())
    .find((part) => part.type === 'timeZoneName')?.value.replace('GMT', '') || '+00:00'
  return new Date(`${day}T00:00:00${offset}`).toISOString()
}

async function load(): Promise<HalloweenAdminData | null> {
  const admin = createAdminClient()
  const [settings, stats] = await Promise.all([
    admin.from('halloween_settings').select(COLUMNS).eq('id', 1).single<HalloweenSettings>(),
    admin.rpc('halloween_stats', { p_from: warsawDayStartIso() }),
  ])
  if (settings.error || stats.error) return null
  return { settings: settings.data, stats: stats.data as HalloweenAdminData['stats'] }
}

export async function GET() {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const data = await load()
  if (!data) return NextResponse.json({ error: 'Nie udało się wczytać ustawień gry.' }, { status: 503 })
  return NextResponse.json(data)
}

const intInRange = (value: unknown, min: number, max: number) => {
  const number = Number(value)
  return Number.isInteger(number) && number >= min && number <= max ? number : null
}

export async function PATCH(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = (await request.json().catch(() => null)) as Partial<HalloweenSettings> | null
  if (!body) return NextResponse.json({ error: 'Nieprawidłowe dane.' }, { status: 400 })

  const startsAt = new Date(String(body.starts_at))
  const endsAt = new Date(String(body.ends_at))
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    return NextResponse.json({ error: 'Koniec wydarzenia musi być po jego starcie.' }, { status: 400 })
  }
  const dailyGames = intInRange(body.daily_games, 1, 50)
  const pointsPerStar = intInRange(body.points_per_star, 1, 100000)
  const maxStars = intInRange(body.max_stars_per_game, 0, 1000)
  const dailyCap = intInRange(body.daily_star_cap, 0, 10000)
  if (dailyGames === null) return NextResponse.json({ error: 'Gry dziennie: 1–50.' }, { status: 400 })
  if (pointsPerStar === null) return NextResponse.json({ error: 'Wynik za 1 Star: 1–100 000.' }, { status: 400 })
  if (maxStars === null) return NextResponse.json({ error: 'Maks. Stars za grę: 0–1000.' }, { status: 400 })
  if (dailyCap === null) return NextResponse.json({ error: 'Dzienny limit Stars: 0–10 000.' }, { status: 400 })

  const { error } = await createAdminClient()
    .from('halloween_settings')
    .update({
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      daily_games: dailyGames,
      points_per_star: pointsPerStar,
      max_stars_per_game: maxStars,
      daily_star_cap: dailyCap,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
  if (error) return NextResponse.json({ error: 'Nie udało się zapisać ustawień gry.' }, { status: 503 })

  const data = await load()
  if (!data) return NextResponse.json({ error: 'Zapisano, ale nie udało się odświeżyć danych.' }, { status: 503 })
  return NextResponse.json(data)
}
