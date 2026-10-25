import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { parsePromotionInput } from '@/lib/promotions'
import { loadAllPromotions } from '@/lib/promotions-server'
import { PUBLIC_PROMOTIONS_TAG, invalidatesPublic } from '@/lib/public-cache'

const MANAGERS = ['admin', 'szef']
const TOGGLERS = [...MANAGERS, 'kelner']
const STAFF = [...TOGGLERS, 'kuchnia', 'kierowca']

async function authorize(roles: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Zaloguj się ponownie.' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!roles.includes(profile?.role ?? '')) return { error: NextResponse.json({ error: 'Brak uprawnień do promocji.' }, { status: 403 }) }
  return { role: profile!.role as string, admin: createAdminClient() }
}

async function respond(admin: ReturnType<typeof createAdminClient>, status = 200) {
  const [promotions, categories, products] = await Promise.all([
    loadAllPromotions(admin),
    admin.from('menu_categories').select('id, label').order('sort'),
    admin.from('menu_products').select('id, name, category_id').order('sort'),
  ])
  if (!promotions) return NextResponse.json({ error: 'Nie udało się wczytać promocji.' }, { status: 503 })
  return NextResponse.json({ promotions, categories: categories.data ?? [], products: products.data ?? [] }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET() {
  const auth = await authorize(STAFF)
  if (auth.error) return auth.error
  return respond(auth.admin)
}

async function handlePOST(request: Request) {
  const auth = await authorize(MANAGERS)
  if (auth.error) return auth.error
  const parsed = parsePromotionInput(await request.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { error } = await auth.admin.from('promotions').insert({ ...parsed.value, active: parsed.value.active ?? false })
  if (error) return NextResponse.json({ error: 'Nie udało się dodać promocji.' }, { status: 503 })
  return respond(auth.admin, 201)
}

async function handlePATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!id) return NextResponse.json({ error: 'Brak promocji.' }, { status: 400 })
  const toggleOnly = Object.keys(body!).every((key) => key === 'id' || key === 'active') && typeof body!.active === 'boolean'

  const auth = await authorize(toggleOnly ? TOGGLERS : MANAGERS)
  if (auth.error) return auth.error

  let changes: Record<string, unknown>
  if (toggleOnly) {
    changes = { active: body!.active }
  } else {
    const parsed = parsePromotionInput(body)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    changes = parsed.value
  }
  const { data, error } = await auth.admin.from('promotions').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', id).select('id')
  if (error) return NextResponse.json({ error: 'Nie udało się zapisać promocji.' }, { status: 503 })
  if (!data?.length) return NextResponse.json({ error: 'Ta promocja już nie istnieje.' }, { status: 404 })
  return respond(auth.admin)
}

async function handleDELETE(request: Request) {
  const auth = await authorize(MANAGERS)
  if (auth.error) return auth.error
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Brak promocji.' }, { status: 400 })
  const { error } = await auth.admin.from('promotions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Nie udało się usunąć promocji.' }, { status: 503 })
  return respond(auth.admin)
}

export const POST = invalidatesPublic([PUBLIC_PROMOTIONS_TAG], handlePOST)
export const PATCH = invalidatesPublic([PUBLIC_PROMOTIONS_TAG], handlePATCH)
export const DELETE = invalidatesPublic([PUBLIC_PROMOTIONS_TAG], handleDELETE)
