import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { getVapidKeys } from '@/lib/push'

const APPS = ['site', 'club'] as const
type Body = { endpoint?: string; keys?: { p256dh?: string; auth?: string }; app?: string }

const isValidEndpoint = (endpoint: string) => endpoint.startsWith('https://') && endpoint.length <= 1000

export async function GET() {
  const { publicKey } = await getVapidKeys()
  return NextResponse.json({ publicKey }, { headers: { 'Cache-Control': 'no-store' } })
}

async function currentUserId() {
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return data.user?.id ?? null
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null
  const endpoint = body?.endpoint ?? ''
  const app = (APPS as readonly string[]).includes(body?.app ?? '') ? (body!.app as (typeof APPS)[number]) : 'site'
  const p256dh = body?.keys?.p256dh ?? ''
  const key = body?.keys?.auth ?? ''
  if (!isValidEndpoint(endpoint) || !p256dh || !key || p256dh.length > 200 || key.length > 100) {
    return NextResponse.json({ error: 'Nieprawidłowa subskrypcja.' }, { status: 400 })
  }
  const { error } = await createAdminClient().from('public_push_subscriptions').upsert(
    { endpoint, p256dh, auth: key, app, user_id: await currentUserId(), updated_at: new Date().toISOString() },
    { onConflict: 'endpoint' },
  )
  if (error) return NextResponse.json({ error: 'Nie udało się zapisać powiadomień.' }, { status: 503 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null
  const endpoint = body?.endpoint ?? ''
  if (isValidEndpoint(endpoint)) await createAdminClient().from('public_push_subscriptions').delete().eq('endpoint', endpoint)
  return NextResponse.json({ ok: true })
}
