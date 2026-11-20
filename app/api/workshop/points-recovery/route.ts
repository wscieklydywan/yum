import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles } from '@/lib/workshop-auth'

const RECOVERY_ROLES = ['admin', 'szef', 'kelner'] as const
const columns = 'id, email, phone, full_name, status, points_awarded, staff_note, handled_at, created_at'

export async function GET() {
  const auth = await authorizeRoles(RECOVERY_ROLES)
  if ('response' in auth) return auth.response
  const admin = createAdminClient()
  const [pending, handled] = await Promise.all([
    admin.from('points_recovery_requests').select(columns).eq('status', 'pending').order('created_at', { ascending: true }).limit(200),
    admin.from('points_recovery_requests').select(columns).neq('status', 'pending').order('handled_at', { ascending: false }).limit(20),
  ])
  if (pending.error || handled.error) return NextResponse.json({ error: 'Nie udało się wczytać zgłoszeń.' }, { status: 503 })
  return NextResponse.json({ pending: pending.data ?? [], handled: handled.data ?? [] })
}

export async function PATCH(request: Request) {
  const auth = await authorizeRoles(RECOVERY_ROLES)
  if ('response' in auth) return auth.response
  const body = (await request.json().catch(() => null)) as { id?: string; action?: string; points?: number; note?: string } | null
  const id = typeof body?.id === 'string' ? body.id : ''
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 200) : ''
  if (!id) return NextResponse.json({ error: 'Brak zgłoszenia.' }, { status: 400 })
  const admin = createAdminClient()

  if (body?.action === 'reject') {
    const { data, error } = await admin
      .from('points_recovery_requests')
      .update({ status: 'rejected', staff_note: note || null, handled_by: auth.user.id, handled_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()
    if (error) return NextResponse.json({ error: 'Nie udało się odrzucić zgłoszenia.' }, { status: 503 })
    if (!data) return NextResponse.json({ error: 'Zgłoszenie zostało już obsłużone.' }, { status: 409 })
    return NextResponse.json({ ok: true })
  }

  if (body?.action !== 'award') return NextResponse.json({ error: 'Nieznana operacja.' }, { status: 400 })
  const points = Number(body.points)
  if (!Number.isInteger(points) || points < 1 || points > 100000) {
    return NextResponse.json({ error: 'Podaj liczbę punktów od 1 do 100 000.' }, { status: 400 })
  }
  const { data, error } = await admin.rpc('resolve_points_recovery', { request_id: id, amount: points, actor: auth.user.id, note })
  if (error) {
    if (error.message.includes('request_not_pending')) return NextResponse.json({ error: 'Zgłoszenie zostało już obsłużone.' }, { status: 409 })
    if (error.message.includes('customer_not_found')) return NextResponse.json({ error: 'Konto klienta już nie istnieje.' }, { status: 404 })
    console.error('Points recovery award failed', error.message)
    return NextResponse.json({ error: 'Nie udało się przyznać punktów.' }, { status: 503 })
  }
  return NextResponse.json({ ok: true, balance: data })
}
