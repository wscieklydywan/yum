import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'
import { MAX_WHEEL_SEGMENTS, WHEEL_ICONS, WHEEL_REWARD_TYPES, type WheelPrizeAdmin, type WheelRewardType } from '@/lib/wheel'

const FIELDS = 'id, sort, label, description, reward_type, points, product_id, product_name, discount_value, coupon_hours, chance, visual, image, icon, active'

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function num(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : NaN
}

function normalize(row: Record<string, unknown>): WheelPrizeAdmin {
  return { ...(row as WheelPrizeAdmin), chance: Number(row.chance), discount_value: Number(row.discount_value) }
}

function isAllowedImage(url: string) {
  if (url.startsWith('/images/') && !url.includes('..')) return true
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return Boolean(base && url.startsWith(`${base}/storage/v1/object/public/menu-images/`))
}

async function validate(body: Record<string, unknown>) {
  const label = text(body.label, 24)
  if (!label) return { error: 'Podaj nazwę nagrody (max 24 znaki).' }
  const rewardType = body.reward_type as WheelRewardType
  if (!WHEEL_REWARD_TYPES.includes(rewardType)) return { error: 'Nieprawidłowy typ nagrody.' }

  const chance = Math.round(num(body.chance) * 1000) / 1000
  if (!(chance >= 0 && chance <= 100)) return { error: 'Szansa musi mieścić się w zakresie 0–100%.' }

  const points = Math.round(num(body.points))
  const discount = Math.round(num(body.discount_value) * 100) / 100
  const hours = Math.round(num(body.coupon_hours))
  const row: Record<string, unknown> = {
    label,
    description: text(body.description, 80),
    reward_type: rewardType,
    chance,
    points: 0,
    product_id: null,
    product_name: '',
    discount_value: 0,
    coupon_hours: Number.isFinite(hours) && hours >= 1 && hours <= 720 ? hours : 24,
    active: body.active !== false,
  }

  if (rewardType === 'points') {
    if (!(points >= 1 && points <= 100000)) return { error: 'Liczba punktów musi być w zakresie 1–100 000.' }
    row.points = points
  }
  if (rewardType === 'free_item') {
    const productId = text(body.product_id, 80)
    if (!productId) return { error: 'Wybierz pozycję z menu.' }
    const { data: product } = await createAdminClient().from('menu_products').select('id, name').eq('id', productId).maybeSingle()
    if (!product) return { error: 'Wybrana pozycja nie istnieje w menu.' }
    row.product_id = product.id
    row.product_name = product.name
  }
  if (rewardType === 'discount_percent' && !(discount > 0 && discount <= 100)) return { error: 'Rabat procentowy: 0,01–100%.' }
  if (rewardType === 'discount_amount' && !(discount > 0 && discount <= 1000)) return { error: 'Rabat kwotowy: 0,01–1000 zł.' }
  if (rewardType.startsWith('discount')) row.discount_value = discount

  const visual = body.visual === 'image' ? 'image' : 'icon'
  const image = text(body.image, 500)
  const icon = text(body.icon, 40)
  if (visual === 'image' && !isAllowedImage(image)) return { error: 'Wybierz zdjęcie z menu lub wgraj własne.' }
  row.visual = visual
  row.image = visual === 'image' ? image : ''
  row.icon = WHEEL_ICONS[icon] ? icon : 'gift'
  return { row }
}

async function listPrizes() {
  const { data, error } = await createAdminClient().from('wheel_prizes').select(FIELDS).order('sort').order('id')
  if (error) throw error
  return (data ?? []).map(normalize)
}

async function activeCount(excludeId?: string) {
  let query = createAdminClient().from('wheel_prizes').select('id', { count: 'exact', head: true }).eq('active', true)
  if (excludeId) query = query.neq('id', excludeId)
  const { count } = await query
  return count ?? 0
}

export async function GET() {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const admin = createAdminClient()
  const [prizes, products] = await Promise.all([
    listPrizes().catch(() => null),
    admin.from('menu_products').select('id, name, image, price').eq('available', true).order('sort'),
  ])
  if (!prizes) return NextResponse.json({ error: 'Nie udało się pobrać nagród.' }, { status: 503 })
  return NextResponse.json({ prizes, products: products.data ?? [] })
}

export async function POST(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Nieprawidłowe dane.' }, { status: 400 })
  const result = await validate(body)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  if (result.row.active && (await activeCount()) >= MAX_WHEEL_SEGMENTS) {
    return NextResponse.json({ error: `Koło może mieć maksymalnie ${MAX_WHEEL_SEGMENTS} aktywnych pól.` }, { status: 400 })
  }
  const admin = createAdminClient()
  const { data: last } = await admin.from('wheel_prizes').select('sort').order('sort', { ascending: false }).limit(1).maybeSingle()
  const { error } = await admin.from('wheel_prizes').insert({ ...result.row, sort: (last?.sort ?? -1) + 1 })
  if (error) return NextResponse.json({ error: 'Nie udało się dodać nagrody.' }, { status: 503 })
  return NextResponse.json({ prizes: await listPrizes() }, { status: 201 })
}

export async function PATCH(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const id = text(body?.id, 60)
  if (!body || !id) return NextResponse.json({ error: 'Nieprawidłowe dane.' }, { status: 400 })
  const result = await validate(body)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  if (result.row.active && (await activeCount(id)) >= MAX_WHEEL_SEGMENTS) {
    return NextResponse.json({ error: `Koło może mieć maksymalnie ${MAX_WHEEL_SEGMENTS} aktywnych pól.` }, { status: 400 })
  }
  if (!result.row.active && (await activeCount(id)) < 2) {
    return NextResponse.json({ error: 'Koło musi mieć co najmniej 2 aktywne pola.' }, { status: 400 })
  }
  const { error } = await createAdminClient().from('wheel_prizes').update({ ...result.row, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: 'Nie udało się zapisać nagrody.' }, { status: 503 })
  return NextResponse.json({ prizes: await listPrizes() })
}

export async function PUT(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = (await request.json().catch(() => null)) as { order?: unknown } | null
  const order = Array.isArray(body?.order) ? body.order.filter((id): id is string => typeof id === 'string').slice(0, 100) : []
  if (!order.length) return NextResponse.json({ error: 'Nieprawidłowa kolejność.' }, { status: 400 })
  const admin = createAdminClient()
  const results = await Promise.all(order.map((id, index) => admin.from('wheel_prizes').update({ sort: index }).eq('id', id)))
  if (results.some((item) => item.error)) return NextResponse.json({ error: 'Nie udało się zmienić kolejności.' }, { status: 503 })
  return NextResponse.json({ prizes: await listPrizes() })
}

export async function DELETE(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Brak nagrody.' }, { status: 400 })
  const admin = createAdminClient()
  const { data: prize } = await admin.from('wheel_prizes').select('active').eq('id', id).maybeSingle()
  if (prize?.active && (await activeCount(id)) < 2) {
    return NextResponse.json({ error: 'Koło musi mieć co najmniej 2 aktywne pola.' }, { status: 400 })
  }
  const { error } = await admin.from('wheel_prizes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Nie udało się usunąć nagrody.' }, { status: 503 })
  return NextResponse.json({ prizes: await listPrizes() })
}
