import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'
import { monthStartIso } from '@/lib/marketing'
import { DEFAULT_LOYALTY_RATE } from '@/lib/loyalty-rate'
import { DEFAULT_FOOD_COST_PERCENT, type LoyaltyReward, type RewardsAdminData } from '@/lib/loyalty-economics'

const REWARD_COLUMNS = 'key, name, note, cost, menu_value, image, active, sort'

async function loadRewards(): Promise<RewardsAdminData | null> {
  const admin = createAdminClient()
  const [settings, rewards, summary] = await Promise.all([
    admin.from('restaurant_settings').select('loyalty_points, loyalty_spend, food_cost_percent').eq('id', 1).maybeSingle(),
    admin.from('loyalty_rewards').select(REWARD_COLUMNS).order('sort').order('key'),
    admin.rpc('marketing_cost_summary', { p_from: monthStartIso() }),
  ])
  if (rewards.error || summary.error || settings.error) return null

  const stats = new Map<string, Record<string, unknown>>()
  for (const row of (summary.data ?? []) as Record<string, unknown>[]) {
    if (row.source === 'reward') stats.set(String(row.ref_id), row)
  }

  return {
    foodCostPercent: settings.data ? Number(settings.data.food_cost_percent) : DEFAULT_FOOD_COST_PERCENT,
    rate: settings.data ? { points: Number(settings.data.loyalty_points), spend: Number(settings.data.loyalty_spend) } : DEFAULT_LOYALTY_RATE,
    rewards: (rewards.data ?? []).map((reward) => {
      const row = stats.get(reward.key)
      return {
        ...reward,
        menu_value: Number(reward.menu_value),
        stats: {
          uses: Number(row?.uses ?? 0),
          total: Number(row?.total ?? 0),
          periodUses: Number(row?.period_uses ?? 0),
          periodTotal: Number(row?.period_total ?? 0),
        },
      }
    }),
  }
}

export async function GET() {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const data = await loadRewards()
  if (!data) return NextResponse.json({ error: 'Nie udało się wczytać nagród.' }, { status: 503 })
  return NextResponse.json(data)
}

type PutBody = { foodCostPercent?: number; rewards?: Partial<LoyaltyReward>[] }

export async function PUT(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = (await request.json().catch(() => null)) as PutBody | null
  if (!body || !Array.isArray(body.rewards)) return NextResponse.json({ error: 'Nieprawidłowe dane.' }, { status: 400 })

  const foodCost = Math.round(Number(body.foodCostPercent) * 100) / 100
  if (!(foodCost >= 0 && foodCost <= 100)) return NextResponse.json({ error: 'Koszt surowca: 0–100%.' }, { status: 400 })

  const updates = []
  for (const reward of body.rewards) {
    const key = String(reward.key ?? '')
    const name = String(reward.name ?? '').trim()
    const note = String(reward.note ?? '').trim()
    const cost = Number(reward.cost)
    const value = Math.round(Number(reward.menu_value) * 100) / 100
    if (!/^[a-z0-9_-]{2,32}$/.test(key)) return NextResponse.json({ error: 'Nieznana nagroda.' }, { status: 400 })
    if (name.length < 1 || name.length > 80) return NextResponse.json({ error: 'Nazwa nagrody: 1–80 znaków.' }, { status: 400 })
    if (note.length > 120) return NextResponse.json({ error: 'Opis nagrody: maks. 120 znaków.' }, { status: 400 })
    if (!Number.isInteger(cost) || cost < 1 || cost > 100000) return NextResponse.json({ error: `${name}: cena 1–100 000 Stars.` }, { status: 400 })
    if (!(value >= 0 && value <= 10000)) return NextResponse.json({ error: `${name}: cena w menu 0–10 000 zł.` }, { status: 400 })
    updates.push({ key, name, note, cost, menu_value: value, active: reward.active !== false })
  }

  const admin = createAdminClient()
  const results = await Promise.all([
    admin.from('restaurant_settings').update({ food_cost_percent: foodCost }).eq('id', 1),
    ...updates.map(({ key, ...fields }) => admin.from('loyalty_rewards').update({ ...fields, updated_at: new Date().toISOString() }).eq('key', key)),
  ])
  if (results.some((result) => result.error)) return NextResponse.json({ error: 'Nie udało się zapisać nagród.' }, { status: 503 })

  const data = await loadRewards()
  if (!data) return NextResponse.json({ error: 'Zapisano, ale nie udało się odświeżyć danych.' }, { status: 503 })
  return NextResponse.json(data)
}
