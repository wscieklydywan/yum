import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'
import { invalidatesPublic, PUBLIC_HOME_SLIDES_TAG, PUBLIC_MENU_TAG } from '@/lib/public-cache'
import { isSafeSlideHref, isSlideImageMode, isSlideTheme, normalizeHidden, normalizeSlideOrder, type CustomSlide, type HomeSlidesSettings } from '@/lib/home-slides'
import { loadHomeSlides } from '@/lib/home-slides-server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_CUSTOM = 12

export async function GET() {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const data = await loadHomeSlides(createAdminClient()).catch(() => null)
  if (!data) return NextResponse.json({ error: 'Nie udało się wczytać ustawień slidera.' }, { status: 503 })
  return NextResponse.json(data)
}

const bad = (error: string) => NextResponse.json({ error }, { status: 400 })
const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

function parseCustom(raw: unknown): CustomSlide | string {
  if (!raw || typeof raw !== 'object') return 'Niepoprawny slajd.'
  const slide = raw as Record<string, unknown>
  const id = str(slide.id)
  if (!UUID.test(id)) return 'Niepoprawny identyfikator slajdu.'
  const title = str(slide.title)
  const badge = str(slide.badge)
  const text = str(slide.text)
  const ctaLabel = str(slide.cta_label)
  const href = str(slide.cta_href) || null
  const image = str(slide.image_url) || null
  const until = str(slide.until) || null
  const productId = str(slide.product_id) || null
  if (title.length < 1 || title.length > 60) return 'Tytuł slajdu musi mieć od 1 do 60 znaków.'
  if (badge.length > 30) return 'Plakietka może mieć maksymalnie 30 znaków.'
  if (text.length > 240) return 'Opis slajdu może mieć maksymalnie 240 znaków.'
  if (ctaLabel.length > 30) return 'Tekst przycisku może mieć maksymalnie 30 znaków.'
  if (href && (href.length > 300 || !isSafeSlideHref(href))) return 'Link musi zaczynać się od „/” albo „https://”.'
  if (image && (image.length > 500 || !/^https:\/\//.test(image))) return 'Niepoprawny adres zdjęcia.'
  if (until && !DATE.test(until)) return 'Niepoprawna data końca slajdu.'
  if (!isSlideTheme(slide.theme)) return 'Niepoprawny kolor slajdu.'
  const imageMode = slide.image_mode === undefined ? 'circle' : slide.image_mode
  if (!isSlideImageMode(imageMode)) return 'Niepoprawny układ zdjęcia.'
  return { id, title, badge, text, cta_label: ctaLabel, cta_href: productId ? null : href, image_url: image, image_mode: image ? imageMode : 'circle', until, product_id: productId, theme: slide.theme }
}

async function handlePUT(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = (await request.json().catch(() => null)) as Partial<HomeSlidesSettings> | null
  if (!body) return bad('Niepoprawne dane.')

  const rawCustom = Array.isArray(body.custom) ? body.custom : []
  if (rawCustom.length > MAX_CUSTOM) return bad(`Maksymalnie ${MAX_CUSTOM} własnych slajdów.`)
  const custom: CustomSlide[] = []
  for (const raw of rawCustom) {
    const parsed = parseCustom(raw)
    if (typeof parsed === 'string') return bad(parsed)
    custom.push(parsed)
  }
  const customIds = custom.map((slide) => slide.id)
  if (new Set(customIds).size !== customIds.length) return bad('Zduplikowany slajd.')

  const order = normalizeSlideOrder(body.order, customIds)
  const hidden = normalizeHidden(body.hidden, customIds)
  if (hidden.length >= order.length) return bad('Zostaw widoczny przynajmniej jeden slajd.')
  const clubHidden = normalizeHidden(body.club_hidden, customIds)

  const week = body.burger_week
  if (!week || typeof week !== 'object') return bad('Brak ustawień burgera tygodnia.')
  const title = str(week.title)
  const text = str(week.text)
  if (title.length < 1 || title.length > 40) return bad('Nagłówek musi mieć od 1 do 40 znaków.')
  if (text.length > 200) return bad('Opis może mieć maksymalnie 200 znaków.')
  const until = week.until ? String(week.until) : null
  if (until && !DATE.test(until)) return bad('Niepoprawna data końca.')
  const productId = typeof week.product_id === 'string' && week.product_id ? week.product_id : null
  const enabled = week.enabled === true
  if (enabled && !productId) return bad('Wybierz burgera, zanim włączysz slajd.')
  let price: number | null = null
  if (week.price !== null && week.price !== undefined && String(week.price).trim() !== '') {
    price = Number(String(week.price).replace(',', '.'))
    if (!Number.isFinite(price) || price < 0 || price > 999) return bad('Cena musi być liczbą od 0 do 999 zł.')
    price = Math.round(price * 100) / 100
  }
  if (!productId) price = null

  const admin = createAdminClient()
  const productIds = [...new Set([productId, ...custom.map((slide) => slide.product_id)].filter((id): id is string => Boolean(id)))]
  if (productIds.length > 0) {
    const { data: found } = await admin.from('menu_products').select('id').in('id', productIds)
    if ((found ?? []).length !== productIds.length) return bad('Wybrany produkt nie istnieje w menu.')
  }

  const now = new Date().toISOString()
  const { data: existing } = await admin.from('home_custom_slides').select('id')
  const removed = (existing ?? []).map((row) => row.id as string).filter((id) => !customIds.includes(id))
  if (removed.length > 0) {
    const { error } = await admin.from('home_custom_slides').delete().in('id', removed)
    if (error) return NextResponse.json({ error: 'Nie udało się usunąć slajdu.' }, { status: 500 })
  }
  if (custom.length > 0) {
    const { error } = await admin.from('home_custom_slides').upsert(custom.map((slide) => ({ ...slide, updated_at: now })))
    if (error) return NextResponse.json({ error: 'Nie udało się zapisać własnych slajdów.' }, { status: 500 })
  }

  const { error } = await admin.from('home_slides_settings').upsert({
    id: 1,
    slide_order: order,
    hidden_slides: hidden,
    club_hidden_slides: clubHidden,
    burger_week_enabled: enabled,
    burger_week_product_id: productId,
    burger_week_title: title,
    burger_week_text: text,
    burger_week_until: until,
    burger_week_price: price,
    updated_at: now,
  })
  if (error) return NextResponse.json({ error: 'Nie udało się zapisać ustawień.' }, { status: 500 })
  const data = await loadHomeSlides(admin).catch(() => null)
  return NextResponse.json(data)
}

export const PUT = invalidatesPublic([PUBLIC_HOME_SLIDES_TAG, PUBLIC_MENU_TAG], handlePUT)
