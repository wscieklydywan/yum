import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'
import { invalidatesPublic, PUBLIC_HOME_SLIDES_TAG } from '@/lib/public-cache'
import { customSlideKey, warsawDate } from '@/lib/home-slides'
import { loadHomeSlides } from '@/lib/home-slides-server'
import { DEFAULT_SEASONAL_LABEL } from '@/lib/menu'

const COLUMNS = 'id, name, description, price, image, available, seasonal, seasonal_label, available_until'

export type SlideProduct = {
  id: string
  name: string
  description: string
  price: number
  image: string | null
  available: boolean
  seasonal: boolean
  seasonal_label: string | null
  available_until: string | null
}

/** Menu products for the slide editor – seasonal ones first. */
export async function GET() {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const { data, error } = await createAdminClient().from('menu_products').select(COLUMNS).order('seasonal', { ascending: false }).order('sort')
  if (error) return NextResponse.json({ error: 'Nie udało się wczytać menu.' }, { status: 503 })
  return NextResponse.json((data ?? []).map((row) => ({ ...row, price: Number(row.price) })))
}

/** Adds a slide for a menu product (e.g. a seasonal dish) at the end of the slider. */
async function handlePOST(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = (await request.json().catch(() => null)) as { product_id?: unknown } | null
  const productId = typeof body?.product_id === 'string' ? body.product_id : ''
  if (!productId) return NextResponse.json({ error: 'Brak produktu.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: product } = await admin.from('menu_products').select(COLUMNS).eq('id', productId).maybeSingle()
  if (!product) return NextResponse.json({ error: 'Produkt nie istnieje.' }, { status: 404 })

  const { data: existing } = await admin.from('home_custom_slides').select('id').eq('product_id', productId).limit(1).maybeSingle()
  if (existing) return NextResponse.json({ error: 'To danie jest już na sliderze.', id: existing.id }, { status: 409 })
  const { count } = await admin.from('home_custom_slides').select('id', { count: 'exact', head: true })
  if ((count ?? 0) >= 12) return NextResponse.json({ error: 'Maksymalnie 12 własnych slajdów.' }, { status: 400 })

  const id = crypto.randomUUID()
  const { error } = await admin.from('home_custom_slides').insert({
    id,
    product_id: productId,
    title: String(product.name).slice(0, 60),
    badge: product.seasonal ? (product.seasonal_label || DEFAULT_SEASONAL_LABEL).slice(0, 30) : 'Polecamy',
    text: '',
    theme: 'red',
    until: product.available_until ? warsawDate(product.available_until) : null,
  })
  if (error) return NextResponse.json({ error: 'Nie udało się dodać slajdu.' }, { status: 500 })

  const settings = await loadHomeSlides(admin)
  await admin.from('home_slides_settings').upsert({ id: 1, slide_order: settings.order, updated_at: new Date().toISOString() })
  return NextResponse.json({ id, key: customSlideKey(id) }, { status: 201 })
}

export const POST = invalidatesPublic([PUBLIC_HOME_SLIDES_TAG], handlePOST)
