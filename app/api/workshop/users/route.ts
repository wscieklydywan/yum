import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'

const roles = ['admin', 'szef', 'kuchnia', 'kelner', 'kierowca'] as const
const forbiddenForSzef = NextResponse.json({ error: 'Szef nie może zarządzać kontami administratorów.' }, { status: 403 })

export async function GET() {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const admin = createAdminClient()
  const hiddenRoles = auth.role === 'szef' ? '(klient,admin)' : '(klient)'
  const { data, error } = await admin.from('profiles').select('id, email, full_name, role, created_at').not('role', 'in', hiddenRoles).order('created_at')
  if (error) return NextResponse.json({ error: 'Nie udało się pobrać użytkowników.' }, { status: 503 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null) as { email?: string; fullName?: string; password?: string; role?: string } | null
  const email = body?.email?.trim().toLowerCase() ?? ''
  const fullName = body?.fullName?.trim().slice(0, 120) ?? ''
  const password = body?.password ?? ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10 || password.length > 128 || !roles.includes(body?.role as (typeof roles)[number])) {
    return NextResponse.json({ error: 'Podaj poprawny e-mail, hasło (min. 10 znaków) i rolę.' }, { status: 400 })
  }
  if (auth.role === 'szef' && body!.role === 'admin') return forbiddenForSzef
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } })
  if (error || !data.user) return NextResponse.json({ error: error?.message.includes('already been registered') ? 'Konto z tym adresem już istnieje.' : 'Nie udało się utworzyć konta.' }, { status: 409 })
  const { error: profileError } = await admin.from('profiles').update({ role: body!.role, full_name: fullName }).eq('id', data.user.id)
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id)
    return NextResponse.json({ error: 'Nie udało się ustawić roli konta.' }, { status: 503 })
  }
  return NextResponse.json({ id: data.user.id }, { status: 201 })
}

export async function PATCH(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null) as { userId?: string; role?: string } | null
  if (!body?.userId || !roles.includes(body.role as (typeof roles)[number])) return NextResponse.json({ error: 'Nieprawidłowa rola.' }, { status: 400 })
  if (body.userId === auth.user.id) return NextResponse.json({ error: 'Nie możesz zmienić własnej roli.' }, { status: 400 })
  const admin = createAdminClient()
  const { data: target } = await admin.from('profiles').select('role').eq('id', body.userId).maybeSingle()
  if (!target) return NextResponse.json({ error: 'Nie znaleziono użytkownika.' }, { status: 404 })
  if (auth.role === 'szef' && (target.role === 'admin' || body.role === 'admin')) return forbiddenForSzef
  if (target.role === 'admin' && body.role !== 'admin') {
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin')
    if ((count ?? 0) <= 1) return NextResponse.json({ error: 'W warsztacie musi pozostać co najmniej jeden administrator.' }, { status: 409 })
  }
  const { error } = await admin.from('profiles').update({ role: body.role }).eq('id', body.userId)
  if (error) return NextResponse.json({ error: 'Nie udało się zmienić roli.' }, { status: 503 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null) as { userId?: string } | null
  if (!body?.userId || body.userId === auth.user.id) return NextResponse.json({ error: 'Nie można usunąć tego konta.' }, { status: 400 })
  const admin = createAdminClient()
  const { data: target } = await admin.from('profiles').select('role').eq('id', body.userId).maybeSingle()
  if (!target) return NextResponse.json({ error: 'Nie znaleziono użytkownika.' }, { status: 404 })
  if (auth.role === 'szef' && target.role === 'admin') return forbiddenForSzef
  if (target.role === 'admin') {
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin')
    if ((count ?? 0) <= 1) return NextResponse.json({ error: 'W warsztacie musi pozostać co najmniej jeden administrator.' }, { status: 409 })
  }
  const { error } = await admin.auth.admin.deleteUser(body.userId)
  if (error) return NextResponse.json({ error: 'Nie udało się usunąć konta.' }, { status: 503 })
  return NextResponse.json({ success: true })
}
