import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const PLATFORMS = new Set(['ios', 'android', 'desktop', 'other'])
const CAMPAIGN = /^[a-z0-9-]{1,40}$/

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const campaign = String(body?.campaign ?? '').toLowerCase() || 'instalacja'
  const platform = String(body?.platform ?? '')
  if (!CAMPAIGN.test(campaign) || !PLATFORMS.has(platform)) return NextResponse.json({ error: 'Nieprawidłowe dane.' }, { status: 400 })

  const { error } = await createAdminClient().from('qr_scans').insert({ campaign, platform })
  if (error) {
    console.error('[qr-scan]', error)
    return NextResponse.json({ ok: false }, { status: 202 })
  }
  return NextResponse.json({ ok: true })
}
