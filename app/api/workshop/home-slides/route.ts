import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'
import { invalidatesPublic, PUBLIC_HOME_SLIDES_TAG } from '@/lib/public-cache'
import { HOME_SLIDE_IDS, isHomeSlideId, normalizeSlideOrder, type HomeSlidesSettings } from '@/lib/home-slides'

const COLUMNS = 'slide_order, hidden_slides, burger_week_enabled, burger_week_product_id, burger_week_title, burger_week_text, burger_week_until'

async function load(): Promise<HomeSlidesSettings | null> {
  const { data, error } = await createAdminClient().from('home_slides_settings').select(COLUMNS).eq('id', 1).maybeSingle()
  if (error) return null
  return {
    order: normalizeSlideOrder(data?.slide_order),
    hidden: (data?.hidden_slides ?? []).filter(isHomeSlideId),
    burger_week: {
      enabled: data?.burger_week_enabled ?? false,
      product_id: data?.burger_week_product_id ?? null,
      title: data?.burger_week_title ?? 'Burger tygodnia',
      text: data?.burger_week_text ?? '',
      until: data?.burger_week_until ?? null,
    },
  }
}

export async function GET() {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const data = await load()
  if (!data) return NextResponse.json({ error: 'Nie udało się wczytać ustawień slidera.' }, { status: 503 })
  return NextResponse.json(data)
}

const bad = (error: string) => NextResponse.json({ error }, { status: 400 })

async function handlePUT(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = (await request.json().catch(() => null)) as Partial<HomeSlidesSettings> | null
  if (!body) return bad('Niepoprawne dane.')

  const order = normalizeSlideOrder(body.order)
  const hidden = [...new Set(Array.isArray(body.hidden) ? body.hidden.filter(isHomeSlideId) : [])]
  if (hidden.length >= HOME_SLIDE_IDS.length) return bad('Zostaw widoczny przynajmniej jeden slajd.')

  const week = body.burger_week
  if (!week || typeof week !== 'object') return bad('Brak ustawień burgera tygodnia.')
  const title = typeof week.title === 'string' ? week.title.trim() : ''
  const text = typeof week.text === 'string' ? week.text.trim() : ''
  if (title.length < 1 || title.length > 40) return bad('Nagłówek musi mieć od 1 do 40 znaków.')
  if (text.length > 200) return bad('Opis może mieć maksymalnie 200 znaków.')
  const until = week.until ? String(week.until) : null
  if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) return bad('Niepoprawna data końca.')
  const productId = typeof week.product_id === 'string' && week.product_id ? week.product_id : null
  const enabled = week.enabled === true
  if (enabled && !productId) return bad('Wybierz burgera, zanim włączysz slajd.')

  const admin = createAdminClient()
  if (productId) {
    const { data: product } = await admin.from('menu_products').select('id').eq('id', productId).maybeSingle()
    if (!product) return bad('Wybrany produkt nie istnieje w menu.')
  }

  const { error } = await admin.from('home_slides_settings').upsert({
    id: 1,
    slide_order: order,
    hidden_slides: hidden,
    burger_week_enabled: enabled,
    burger_week_product_id: productId,
    burger_week_title: title,
    burger_week_text: text,
    burger_week_until: until,
    updated_at: new Date().toISOString(),
  })
  if (error) return NextResponse.json({ error: 'Nie udało się zapisać ustawień.' }, { status: 500 })
  const data = await load()
  return NextResponse.json(data)
}

export const PUT = invalidatesPublic([PUBLIC_HOME_SLIDES_TAG], handlePUT)
