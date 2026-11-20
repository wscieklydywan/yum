import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'
import { isAdventColor, type AdventColor } from '@/lib/advent-colors'
import type { AdventKind, AdventMode } from '@/lib/advent'

export type AdventSettings = {
  mode: AdventMode
  starts_on: string
  days: number
  allow_late: boolean
  coupon_valid_days: number
  teaser_text: string
  show_home_slide: boolean
  show_bubble: boolean
  show_club_banner: boolean
}

export type AdventDayConfig = {
  day: number
  kind: AdventKind
  title: string
  description: string
  stars: number
  items: AdventItem[]
  discount_type: 'percent' | 'amount' | null
  discount_value: number | null
  color: AdventColor | null
}

export type AdventItem = { product_id: string | null; name: string; quantity: number }

export type AdventStats = {
  opens: number
  players: number
  stars: number
  coupons: number
  coupons_used: number
  per_day: Record<string, number>
}

export type AdventAdminData = { settings: AdventSettings; days: AdventDayConfig[]; stats: AdventStats }

const SETTINGS_COLUMNS = 'mode, starts_on, days, allow_late, coupon_valid_days, teaser_text, show_home_slide, show_bubble, show_club_banner'
const DAY_COLUMNS = 'day, kind, title, description, stars, items, discount_type, discount_value, color'
const MODES: AdventMode[] = ['off', 'teaser', 'live']
const KINDS: AdventKind[] = ['stars', 'food', 'discount', 'none']

async function load(): Promise<AdventAdminData | null> {
  const admin = createAdminClient()
  const [settings, days, stats] = await Promise.all([
    admin.from('advent_settings').select(SETTINGS_COLUMNS).eq('id', 1).single<AdventSettings>(),
    admin.from('advent_days').select(DAY_COLUMNS).order('day'),
    admin.rpc('advent_stats'),
  ])
  if (settings.error || days.error || stats.error) return null
  return {
    settings: settings.data,
    days: (days.data ?? []).map((day) => ({ ...day, discount_value: day.discount_value === null ? null : Number(day.discount_value) })) as AdventDayConfig[],
    stats: stats.data as AdventStats,
  }
}

export async function GET() {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const data = await load()
  if (!data) return NextResponse.json({ error: 'Nie udało się wczytać kalendarza.' }, { status: 503 })
  return NextResponse.json(data)
}

const intInRange = (value: unknown, min: number, max: number) => {
  const number = Number(value)
  return Number.isInteger(number) && number >= min && number <= max ? number : null
}

function parseDay(raw: unknown, index: number, menu: Map<string, string>): AdventDayConfig | string {
  const value = (raw ?? {}) as Partial<AdventDayConfig>
  const day = index + 1
  const kind = KINDS.includes(value.kind as AdventKind) ? (value.kind as AdventKind) : null
  if (!kind) return `Dzień ${day}: wybierz rodzaj nagrody.`
  const title = String(value.title ?? '').trim().slice(0, 80)
  if (!title) return `Dzień ${day}: wpisz nazwę nagrody.`
  const description = String(value.description ?? '').trim().slice(0, 200)
  const color = isAdventColor(value.color) ? value.color : null
  const base = { day, kind, title, description, stars: 0, items: [], discount_type: null, discount_value: null, color } satisfies AdventDayConfig

  if (kind === 'stars') {
    const stars = intInRange(value.stars, 1, 1000)
    if (stars === null) return `Dzień ${day}: liczba Stars od 1 do 1000.`
    return { ...base, stars }
  }
  if (kind === 'food') {
    const rawItems = Array.isArray(value.items) ? value.items : []
    const items: AdventItem[] = []
    for (const item of rawItems) {
      const productId = String(item?.product_id ?? '')
      const name = menu.get(productId)
      if (!name) return `Dzień ${day}: wybierz pozycję z menu (jedna z pozycji nie istnieje w menu).`
      const quantity = Number(item?.quantity)
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) return `Dzień ${day}: ilość od 1 do 10.`
      items.push({ product_id: productId, name, quantity })
    }
    if (items.length === 0 || items.length > 10) return `Dzień ${day}: dodaj od 1 do 10 pozycji z menu.`
    return { ...base, items }
  }
  if (kind === 'discount') {
    const type = value.discount_type === 'amount' ? 'amount' : 'percent'
    const amount = Number(value.discount_value)
    const max = type === 'percent' ? 100 : 500
    if (!Number.isFinite(amount) || amount <= 0 || amount > max) {
      return `Dzień ${day}: rabat od 1 do ${max}${type === 'percent' ? '%' : ' zł'}.`
    }
    return { ...base, discount_type: type, discount_value: Math.round(amount * 100) / 100 }
  }
  return base
}

export async function PATCH(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = (await request.json().catch(() => null)) as { settings?: Partial<AdventSettings>; days?: unknown[] } | null
  if (!body?.settings || !Array.isArray(body.days)) return NextResponse.json({ error: 'Nieprawidłowe dane.' }, { status: 400 })

  const s = body.settings
  const mode = MODES.includes(s.mode as AdventMode) ? (s.mode as AdventMode) : null
  if (!mode) return NextResponse.json({ error: 'Wybierz, czy kalendarz jest wyłączony, w zapowiedzi czy włączony.' }, { status: 400 })
  const startsOn = String(s.starts_on ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || Number.isNaN(new Date(`${startsOn}T12:00:00Z`).getTime())) {
    return NextResponse.json({ error: 'Podaj poprawną datę pierwszego okienka.' }, { status: 400 })
  }
  const days = intInRange(s.days, 1, 31)
  if (days === null) return NextResponse.json({ error: 'Liczba okienek: od 1 do 31.' }, { status: 400 })
  const couponDays = intInRange(s.coupon_valid_days, 1, 60)
  if (couponDays === null) return NextResponse.json({ error: 'Ważność kuponu: od 1 do 60 dni.' }, { status: 400 })
  if (body.days.length < days) return NextResponse.json({ error: 'Uzupełnij nagrody dla wszystkich okienek.' }, { status: 400 })

  const admin = createAdminClient()
  const requestedIds = [
    ...new Set(
      body.days
        .slice(0, days)
        .flatMap((raw) => (Array.isArray((raw as Partial<AdventDayConfig> | null)?.items) ? (raw as AdventDayConfig).items : []))
        .map((item) => String(item?.product_id ?? ''))
        .filter(Boolean),
    ),
  ]
  const menu = new Map<string, string>()
  if (requestedIds.length) {
    const { data: products, error: menuError } = await admin.from('menu_products').select('id, name').in('id', requestedIds)
    if (menuError) return NextResponse.json({ error: 'Nie udało się sprawdzić pozycji menu.' }, { status: 503 })
    for (const product of products ?? []) menu.set(product.id, product.name)
  }

  const parsedDays: AdventDayConfig[] = []
  for (const [index, raw] of body.days.slice(0, days).entries()) {
    const parsed = parseDay(raw, index, menu)
    if (typeof parsed === 'string') return NextResponse.json({ error: parsed }, { status: 400 })
    parsedDays.push(parsed)
  }

  const now = new Date().toISOString()
  const [settingsResult, daysResult] = await Promise.all([
    admin
      .from('advent_settings')
      .update({
        mode,
        starts_on: startsOn,
        days,
        allow_late: Boolean(s.allow_late),
        coupon_valid_days: couponDays,
        teaser_text: String(s.teaser_text ?? '').trim().slice(0, 200),
        show_home_slide: Boolean(s.show_home_slide),
        show_bubble: Boolean(s.show_bubble),
        show_club_banner: Boolean(s.show_club_banner),
        updated_at: now,
      })
      .eq('id', 1),
    admin.from('advent_days').upsert(parsedDays.map((day) => ({ ...day, updated_at: now })), { onConflict: 'day' }),
  ])
  if (settingsResult.error || daysResult.error) return NextResponse.json({ error: 'Nie udało się zapisać kalendarza.' }, { status: 503 })

  const data = await load()
  if (!data) return NextResponse.json({ error: 'Zapisano, ale nie udało się odświeżyć danych.' }, { status: 503 })
  return NextResponse.json(data)
}
