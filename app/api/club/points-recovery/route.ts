import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

const staffRoles = ['admin', 'szef', 'kuchnia', 'kelner', 'kierowca']
const columns = 'status, points_awarded, created_at, handled_at'

async function currentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'Zaloguj się ponownie.' }, { status: 401 })
  const { data, error } = await createAdminClient()
    .from('points_recovery_requests')
    .select(columns)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'Nie udało się sprawdzić zgłoszenia.' }, { status: 503 })
  return NextResponse.json({ request: data ?? null })
}

export async function POST() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'Zaloguj się ponownie.' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('email, phone, full_name, role').eq('id', user.id).maybeSingle()
  if (!profile) return NextResponse.json({ error: 'Nie znaleziono konta.' }, { status: 404 })
  if (staffRoles.includes(profile.role)) return NextResponse.json({ error: 'Konta pracowników nie zbierają punktów.' }, { status: 403 })

  const { data, error } = await admin
    .from('points_recovery_requests')
    .insert({ user_id: user.id, email: profile.email ?? user.email ?? '', phone: profile.phone, full_name: profile.full_name })
    .select(columns)
    .single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Zgłoszenie zostało już wysłane.' }, { status: 409 })
    console.error('Points recovery request failed', error.message)
    return NextResponse.json({ error: 'Nie udało się wysłać zgłoszenia.' }, { status: 503 })
  }
  return NextResponse.json({ request: data })
}
