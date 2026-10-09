import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { MENU_CATEGORIES_TAG } from '@/lib/menu-cache'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'
import { ID_PATTERN, shortId, slugify, text } from '@/lib/workshop-menu'

export async function POST(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null)
  const label = text(body?.label, 40)
  if (!label) return NextResponse.json({ error: 'Podaj nazwę kategorii.' }, { status: 400 })
  const admin = createAdminClient()
  const base = slugify(label, 'kategoria')
  const { data: clash } = await admin.from('menu_categories').select('id').eq('id', base).maybeSingle()
  const id = clash ? `${base}-${shortId()}` : base
  const { data: last } = await admin.from('menu_categories').select('sort').order('sort', { ascending: false }).limit(1).maybeSingle()
  const { error } = await admin.from('menu_categories').insert({ id, label, sort: (last?.sort ?? 0) + 1 })
  if (error) return NextResponse.json({ error: 'Nie udało się dodać kategorii.' }, { status: 503 })
  revalidateTag(MENU_CATEGORIES_TAG, { expire: 0 })
  return NextResponse.json({ id }, { status: 201 })
}

const IMAGE_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/menu-images/categories/`

export async function PATCH(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!ID_PATTERN.test(id)) return NextResponse.json({ error: 'Brak kategorii.' }, { status: 400 })
  const update: { label?: string; image?: string } = {}
  if (body?.label !== undefined) {
    const label = text(body.label, 40)
    if (!label) return NextResponse.json({ error: 'Podaj nazwę kategorii.' }, { status: 400 })
    update.label = label
  }
  if (body?.image !== undefined) {
    const image = typeof body.image === 'string' ? body.image : null
    if (image === null || (image !== '' && (!image.startsWith(IMAGE_PREFIX) || !/^[\w-]+\.webp$/.test(image.slice(IMAGE_PREFIX.length))))) {
      return NextResponse.json({ error: 'Nieprawidłowe zdjęcie kategorii.' }, { status: 400 })
    }
    update.image = image
  }
  if (!Object.keys(update).length) return NextResponse.json({ error: 'Brak zmian.' }, { status: 400 })
  const { error } = await createAdminClient().from('menu_categories').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: 'Nie udało się zapisać kategorii.' }, { status: 503 })
  revalidateTag(MENU_CATEGORIES_TAG, { expire: 0 })
  return NextResponse.json({ success: true })
}

export async function PUT(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null)
  const order: unknown = body?.order
  if (!Array.isArray(order) || order.length > 100 || !order.every((id) => typeof id === 'string' && ID_PATTERN.test(id))) {
    return NextResponse.json({ error: 'Nieprawidłowa kolejność.' }, { status: 400 })
  }
  const admin = createAdminClient()
  const results = await Promise.all(order.map((id, index) => admin.from('menu_categories').update({ sort: index + 1 }).eq('id', id)))
  if (results.some((result) => result.error)) return NextResponse.json({ error: 'Nie udało się zapisać kolejności.' }, { status: 503 })
  revalidateTag(MENU_CATEGORIES_TAG, { expire: 0 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!ID_PATTERN.test(id)) return NextResponse.json({ error: 'Brak kategorii.' }, { status: 400 })
  const admin = createAdminClient()
  const { count } = await admin.from('menu_products').select('id', { count: 'exact', head: true }).eq('category_id', id)
  if (count) return NextResponse.json({ error: `Kategoria zawiera ${count} poz. – przenieś je lub usuń najpierw.` }, { status: 409 })
  const { error } = await admin.from('menu_categories').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Nie udało się usunąć kategorii.' }, { status: 503 })
  revalidateTag(MENU_CATEGORIES_TAG, { expire: 0 })
  return NextResponse.json({ success: true })
}
