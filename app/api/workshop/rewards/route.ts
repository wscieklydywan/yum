import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'
import { monthStartIso } from '@/lib/marketing'
import { DEFAULT_LOYALTY_RATE } from '@/lib/loyalty-rate'
import { invalidatesPublic, PUBLIC_LOYALTY_TAG } from '@/lib/public-cache'
import { DEFAULT_FOOD_COST_PERCENT, linkedMenuValue, type LoyaltyReward, type RewardItem, type RewardsAdminData } from '@/lib/loyalty-economics'

const REWARD_COLUMNS = 'key, name, note, cost, menu_value, items, image, active, sort'
const MAX_REWARDS = 40
const MAX_ITEMS = 6

async function loadRewards(): Promise<RewardsAdminData | null> {
  const admin = createAdminClient()
  const [settings, rewards, summary, products, categories] = await Promise.all([
    admin.from('restaurant_settings').select('loyalty_points, loyalty_spend, food_cost_percent').eq('id', 1).maybeSingle(),
    admin.from('loyalty_rewards').select(REWARD_COLUMNS).order('sort').order('key'),
    admin.rpc('marketing_cost_summary', { p_from: monthStartIso() }),
    admin.from('menu_products').select('id, name, price, image, category_id').eq('available', true).order('sort'),
    admin.from('menu_categories').select('id, label, sort').order('sort'),
  ])
  if (rewards.error || summary.error || settings.error || products.error || categories.error) return null

  const stats = new Map<string, Record<string, unknown>>()
  for (const row of (summary.data ?? []) as Record<string, unknown>[]) {
    if (row.source === 'reward') stats.set(String(row.ref_id), row)
  }
  const categoryOrder = new Map((categories.data ?? []).map((category, index) => [category.id, { label: category.label, index }]))
  const menu = (products.data ?? [])
    .map((product) => ({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      image: product.image ?? '',
      category_id: product.category_id,
      category: categoryOrder.get(product.category_id)?.label ?? product.category_id,
    }))
    .sort((a, b) => (categoryOrder.get(a.category_id)?.index ?? 99) - (categoryOrder.get(b.category_id)?.index ?? 99))
  const prices = new Map(menu.map((product) => [product.id, product.price]))

  return {
    foodCostPercent: settings.data ? Number(settings.data.food_cost_percent) : DEFAULT_FOOD_COST_PERCENT,
    rate: settings.data ? { points: Number(settings.data.loyalty_points), spend: Number(settings.data.loyalty_spend) } : DEFAULT_LOYALTY_RATE,
    products: menu,
    rewards: (rewards.data ?? []).map((reward) => {
      const row = stats.get(reward.key)
      const items = (Array.isArray(reward.items) ? reward.items : []) as RewardItem[]
      return {
        ...reward,
        items,
        menu_value: linkedMenuValue(items, (id) => prices.get(id)) ?? Number(reward.menu_value),
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

type PutBody = { foodCostPercent?: number; rewards?: (Partial<LoyaltyReward> & { isNew?: boolean })[]; deleted?: string[] }

export const PUT = invalidatesPublic([PUBLIC_LOYALTY_TAG], handlePUT)

function newKey(name: string) {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/gi, 'l')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 22)
  return `${slug || 'kupon'}-${crypto.randomUUID().slice(0, 6)}`
}

async function handlePUT(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = (await request.json().catch(() => null)) as PutBody | null
  if (!body || !Array.isArray(body.rewards)) return NextResponse.json({ error: 'Nieprawidłowe dane.' }, { status: 400 })
  if (body.rewards.length > MAX_REWARDS) return NextResponse.json({ error: `Maksymalnie ${MAX_REWARDS} kuponów.` }, { status: 400 })

  const foodCost = Math.round(Number(body.foodCostPercent) * 100) / 100
  if (!(foodCost >= 0 && foodCost <= 100)) return NextResponse.json({ error: 'Koszt surowca: 0–100%.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: menuRows, error: menuError } = await admin.from('menu_products').select('id, name, price, image')
  if (menuError) return NextResponse.json({ error: 'Nie udało się wczytać menu.' }, { status: 503 })
  const menu = new Map((menuRows ?? []).map((product) => [product.id, product]))

  const rows = []
  for (const [index, reward] of body.rewards.entries()) {
    const name = String(reward.name ?? '').trim()
    const note = String(reward.note ?? '').trim()
    const cost = Number(reward.cost)
    const key = reward.isNew ? newKey(name) : String(reward.key ?? '')
    if (!/^[a-z0-9_-]{2,32}$/.test(key)) return NextResponse.json({ error: 'Nieznana nagroda.' }, { status: 400 })
    if (name.length < 1 || name.length > 80) return NextResponse.json({ error: 'Nazwa kuponu: 1–80 znaków.' }, { status: 400 })
    if (note.length > 120) return NextResponse.json({ error: 'Opis kuponu: maks. 120 znaków.' }, { status: 400 })
    if (!Number.isInteger(cost) || cost < 1 || cost > 100000) return NextResponse.json({ error: `${name}: cena 1–100 000 Stars.` }, { status: 400 })

    const rawItems = Array.isArray(reward.items) ? reward.items : []
    if (rawItems.length > MAX_ITEMS) return NextResponse.json({ error: `${name}: maks. ${MAX_ITEMS} produktów w kuponie.` }, { status: 400 })
    const items: RewardItem[] = []
    for (const item of rawItems) {
      const quantity = Number(item.quantity)
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) return NextResponse.json({ error: `${name}: ilość 1–10.` }, { status: 400 })
      if (item.product_id) {
        const product = menu.get(String(item.product_id))
        if (!product) return NextResponse.json({ error: `${name}: produkt nie istnieje w menu.` }, { status: 400 })
        items.push({ product_id: product.id, name: product.name, quantity, choice: item.choice === true })
      } else {
        const legacyName = String(item.name ?? '').trim().slice(0, 80)
        if (legacyName) items.push({ name: legacyName, quantity })
      }
    }
    if (!items.length) return NextResponse.json({ error: `${name}: dodaj przynajmniej jeden produkt z menu.` }, { status: 400 })

    const linkedValue = linkedMenuValue(items, (id) => (menu.has(id) ? Number(menu.get(id)!.price) : undefined))
    const value = Math.round((linkedValue ?? Number(reward.menu_value)) * 100) / 100
    if (!(value >= 0 && value <= 10000)) return NextResponse.json({ error: `${name}: cena w menu 0–10 000 zł.` }, { status: 400 })
    const firstProduct = items.find((item) => item.product_id)
    const image = String(reward.image ?? '').trim() || (firstProduct ? menu.get(firstProduct.product_id!)?.image ?? '' : '')

    rows.push({ key, name, note, cost, menu_value: value, items, image, active: reward.active !== false, sort: (index + 1) * 10, updated_at: new Date().toISOString() })
  }

  const deleted = (Array.isArray(body.deleted) ? body.deleted : []).map(String).filter((key) => /^[a-z0-9_-]{2,32}$/.test(key))
  const results = await Promise.all([
    admin.from('restaurant_settings').update({ food_cost_percent: foodCost }).eq('id', 1),
    rows.length ? admin.from('loyalty_rewards').upsert(rows, { onConflict: 'key' }) : Promise.resolve({ error: null }),
    deleted.length ? admin.from('loyalty_rewards').delete().in('key', deleted) : Promise.resolve({ error: null }),
  ])
  if (results.some((result) => result.error)) return NextResponse.json({ error: 'Nie udało się zapisać kuponów.' }, { status: 503 })

  const data = await loadRewards()
  if (!data) return NextResponse.json({ error: 'Zapisano, ale nie udało się odświeżyć danych.' }, { status: 503 })
  return NextResponse.json(data)
}
