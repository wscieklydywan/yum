import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles } from '@/lib/workshop-auth'
import { getVapidKeys } from '@/lib/push'

const WORKSHOP_ROLES = ['admin', 'szef', 'kuchnia', 'kelner'] as const
const STATIONS = ['kitchen', 'cashier'] as const

export async function GET() {
  const auth = await authorizeRoles(WORKSHOP_ROLES)
  if ('response' in auth) return auth.response
  const { publicKey } = await getVapidKeys()
  return NextResponse.json({ publicKey })
}

type Body = { endpoint?: string; keys?: { p256dh?: string; auth?: string }; station?: string }

export async function POST(request: Request) {
  const auth = await authorizeRoles(WORKSHOP_ROLES)
  if ('response' in auth) return auth.response
  const body = (await request.json().catch(() => null)) as Body | null
  const endpoint = body?.endpoint ?? ''
  const station = body?.station as (typeof STATIONS)[number]
  const p256dh = body?.keys?.p256dh ?? ''
  const key = body?.keys?.auth ?? ''
  if (!endpoint.startsWith('https://') || endpoint.length > 1000 || !STATIONS.includes(station) || !p256dh || !key || p256dh.length > 200 || key.length > 100) {
    return NextResponse.json({ error: 'Nieprawidłowa subskrypcja.' }, { status: 400 })
  }
  const { error } = await createAdminClient().from('push_subscriptions').upsert(
    { endpoint, p256dh, auth: key, station, user_id: auth.user.id, updated_at: new Date().toISOString() },
    { onConflict: 'endpoint' },
  )
  if (error) return NextResponse.json({ error: 'Nie udało się zapisać powiadomień.' }, { status: 503 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const auth = await authorizeRoles(WORKSHOP_ROLES)
  if ('response' in auth) return auth.response
  const body = (await request.json().catch(() => null)) as Body | null
  if (body?.endpoint) await createAdminClient().from('push_subscriptions').delete().eq('endpoint', body.endpoint).eq('user_id', auth.user.id)
  return NextResponse.json({ ok: true })
}
