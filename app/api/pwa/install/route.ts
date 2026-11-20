import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const APPS = new Set(['site', 'club'])
const PLATFORMS = new Set(['ios', 'android', 'desktop', 'other'])
const SOURCES = new Set(['appinstalled', 'standalone'])

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const deviceId = typeof body?.deviceId === 'string' ? body.deviceId : ''
  const app = String(body?.app ?? '')
  const platform = String(body?.platform ?? '')
  const source = String(body?.source ?? '')
  if (!UUID.test(deviceId) || !APPS.has(app) || !PLATFORMS.has(platform) || !SOURCES.has(source)) {
    return NextResponse.json({ error: 'Nieprawidłowe dane.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: existing } = await admin.from('app_installs').select('device_id, user_id').eq('device_id', deviceId).maybeSingle()
  const result = existing
    ? await admin.from('app_installs').update({ last_seen_at: now, user_id: auth.user?.id ?? existing.user_id }).eq('device_id', deviceId)
    : await admin.from('app_installs').insert({ device_id: deviceId, app, platform, source, user_id: auth.user?.id ?? null, created_at: now, last_seen_at: now })

  if (result.error) {
    console.error('[pwa-install]', result.error)
    return NextResponse.json({ error: 'Nie udało się zapisać.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
