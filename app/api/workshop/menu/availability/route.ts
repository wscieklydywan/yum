import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles } from '@/lib/workshop-auth'
import { ID_PATTERN } from '@/lib/workshop-menu'

const AVAILABILITY_ROLES = ['admin', 'szef', 'kuchnia', 'kelner'] as const

export async function PATCH(request: Request) {
  const auth = await authorizeRoles(AVAILABILITY_ROLES)
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null) as { id?: unknown; available?: unknown } | null
  const id = typeof body?.id === 'string' && ID_PATTERN.test(body.id) ? body.id : ''
  if (!id || typeof body?.available !== 'boolean') return NextResponse.json({ error: 'Nieprawidłowe dane.' }, { status: 400 })
  const { data, error } = await createAdminClient().from('menu_products').update({ available: body.available }).eq('id', id).select('id').maybeSingle()
  if (error) return NextResponse.json({ error: 'Nie udało się zaktualizować dostępności.' }, { status: 503 })
  if (!data) return NextResponse.json({ error: 'Nie znaleziono pozycji.' }, { status: 404 })
  return NextResponse.json({ success: true })
}
