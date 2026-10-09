import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'
import { PROMO_FIELDS, PROMO_REWARD_TYPES, normalizePromoCode, type PromoCode, type PromoRewardType } from '@/lib/promo-codes'

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function num(value: unknown) {
  if (value === null || value === undefined || value === '') return NaN
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : NaN
}

function normalize(row: Record<string, unknown>): PromoCode {
  return { ...(row as PromoCode), discount_value: Number(row.discount_value) }
}

async function validate(body: Record<string, unknown>) {
  const code = normalizePromoCode(text(body.code, 40))
  if (!/^[A-Z0-9-]{3,24}$/.test(code)) return { error: 'Kod: 3–24 znaki (litery, cyfry, myślnik).' }
  const rewardType = body.reward_type as PromoRewardType
  if (!PROMO_REWARD_TYPES.includes(rewardType)) return { error: 'Nieprawidłowy typ nagrody.' }

  const points = Math.round(num(body.points))
  const discount = Math.round(num(body.discount_value) * 100) / 100
  const hours = Math.round(num(body.coupon_hours))
  const maxUses = body.max_uses === null || body.max_uses === '' ? null : Math.round(num(body.max_uses))
  const perUser = Math.round(num(body.per_user_limit))

  if (maxUses !== null && !(maxUses >= 1 && maxUses <= 1_000_000)) return { error: 'Limit użyć: 1–1 000 000 lub bez limitu.' }
  if (!(perUser >= 1 && perUser <= 100)) return { error: 'Limit na klienta: 1–100.' }

  let expiresAt: string | null = null
  if (body.expires_at) {
    const date = new Date(String(body.expires_at))
    if (Number.isNaN(date.getTime())) return { error: 'Nieprawidłowa data ważności.' }
    expiresAt = date.toISOString()
  }

  const row: Record<string, unknown> = {
    code,
    description: text(body.description, 120),
    reward_type: rewardType,
    points: 0,
    product_id: null,
    product_name: '',
    discount_value: 0,
    coupon_hours: Number.isFinite(hours) && hours >= 1 && hours <= 720 ? hours : 24,
    max_uses: maxUses,
    per_user_limit: perUser,
    expires_at: expiresAt,
    active: body.active !== false,
  }

  if (rewardType === 'points') {
    if (!(points >= 1 && points <= 100000)) return { error: 'Liczba punktów: 1–100 000.' }
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

  return { row }
}

async function listCodes() {
  const { data, error } = await createAdminClient().from('promo_codes').select(PROMO_FIELDS).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(normalize)
}

function dbError(error: { code?: string } | null, fallback: string) {
  if (error?.code === '23505') return NextResponse.json({ error: 'Taki kod już istnieje.' }, { status: 409 })
  return NextResponse.json({ error: fallback }, { status: 503 })
}

export async function GET() {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const [codes, products] = await Promise.all([
    listCodes().catch(() => null),
    createAdminClient().from('menu_products').select('id, name').eq('available', true).order('sort'),
  ])
  if (!codes) return NextResponse.json({ error: 'Nie udało się pobrać kodów.' }, { status: 503 })
  return NextResponse.json({ codes, products: products.data ?? [] })
}

export async function POST(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Nieprawidłowe dane.' }, { status: 400 })
  const result = await validate(body)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  const { error } = await createAdminClient().from('promo_codes').insert(result.row)
  if (error) return dbError(error, 'Nie udało się dodać kodu.')
  return NextResponse.json({ codes: await listCodes() }, { status: 201 })
}

export async function PATCH(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const id = text(body?.id, 60)
  if (!body || !id) return NextResponse.json({ error: 'Nieprawidłowe dane.' }, { status: 400 })
  const result = await validate(body)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  const { error } = await createAdminClient().from('promo_codes').update({ ...result.row, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return dbError(error, 'Nie udało się zapisać kodu.')
  return NextResponse.json({ codes: await listCodes() })
}

export async function DELETE(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Brak kodu.' }, { status: 400 })
  const { error } = await createAdminClient().from('promo_codes').delete().eq('id', id)
  if (error) return dbError(error, 'Nie udało się usunąć kodu.')
  return NextResponse.json({ codes: await listCodes() })
}
