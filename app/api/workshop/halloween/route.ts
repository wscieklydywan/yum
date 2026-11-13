import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'
import type { HalloweenAdminData, HalloweenPrizeConfig, HalloweenSettings } from '@/lib/loyalty-economics'

const COLUMNS = 'starts_at, ends_at, daily_games, points_per_star, max_stars_per_game, daily_star_cap, prizes, runner_up_stars, showcase_until'

function parsePrizes(value: unknown): HalloweenPrizeConfig[] | null {
  if (!Array.isArray(value) || value.length !== 3) return null
  const prizes: HalloweenPrizeConfig[] = []
  for (const [index, raw] of value.entries()) {
    const prize = raw as Partial<HalloweenPrizeConfig> | null
    const title = String(prize?.title ?? '').trim().slice(0, 80)
    const short = String(prize?.short ?? '').trim().slice(0, 40) || title.slice(0, 40)
    if (!title || !Array.isArray(prize?.items)) return null
    const items = prize.items
      .map((item) => ({ name: String(item?.name ?? '').trim().slice(0, 80), quantity: Number(item?.quantity) }))
      .filter((item) => item.name)
    if (items.length === 0 || items.length > 10 || items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10)) return null
    prizes.push({ place: index + 1, title, short, items })
  }
  return prizes
}

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
  const prizes = parsePrizes(body.prizes)
  if (!prizes) return NextResponse.json({ error: 'Każda nagroda (1–3) potrzebuje nazwy i co najmniej jednej pozycji z menu (ilość 1–10).' }, { status: 400 })
  const runnerUpStars = intInRange(body.runner_up_stars, 0, 1000)
  if (runnerUpStars === null) return NextResponse.json({ error: 'Stars za miejsca 4–10: 0–1000.' }, { status: 400 })
  const showcaseUntil = new Date(String(body.showcase_until))
  if (Number.isNaN(showcaseUntil.getTime()) || showcaseUntil < endsAt) {
    return NextResponse.json({ error: 'Slajd na stronie głównej musi być widoczny co najmniej do końca gry.' }, { status: 400 })
  }

  const { error } = await createAdminClient()
    .from('halloween_settings')
    .update({
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      daily_games: dailyGames,
      points_per_star: pointsPerStar,
      max_stars_per_game: maxStars,
      daily_star_cap: dailyCap,
      prizes,
      runner_up_stars: runnerUpStars,
      showcase_until: showcaseUntil.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
  if (error) return NextResponse.json({ error: 'Nie udało się zapisać ustawień gry.' }, { status: 503 })

  const data = await load()
  if (!data) return NextResponse.json({ error: 'Zapisano, ale nie udało się odświeżyć danych.' }, { status: 503 })
  return NextResponse.json(data)
}
