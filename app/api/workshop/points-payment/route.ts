import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'
import { loadPointsPayment } from '@/lib/points-payment-server'
import { MAX_POINTS_PAYMENT_VALUE } from '@/lib/points-payment'

export async function GET() {
  const auth = await authorizeRoles(['admin', 'szef', 'kelner', 'kuchnia'])
  if ('response' in auth) return auth.response
  const settings = await loadPointsPayment(createAdminClient())
  if (!settings) return NextResponse.json({ error: 'Nie udało się wczytać ustawień.' }, { status: 503 })
  return NextResponse.json(settings)
}

export async function PUT(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = (await request.json().catch(() => null)) as { enabled?: unknown; value?: unknown; maxPercent?: unknown; earnsRest?: unknown } | null
  const enabled = body?.enabled === true
  const earnsRest = body?.earnsRest !== false
  const value = Math.round(Number(body?.value) * 100) / 100
  const maxPercent = Number(body?.maxPercent)
  if (!(value > 0) || value > MAX_POINTS_PAYMENT_VALUE || !Number.isInteger(maxPercent) || maxPercent < 1 || maxPercent > 100) {
    return NextResponse.json({ error: `Wartość 1 Star: 0,01–${MAX_POINTS_PAYMENT_VALUE} zł, limit 1–100%.` }, { status: 400 })
  }
  const { error } = await createAdminClient()
    .from('restaurant_settings')
    .update({ points_payment_enabled: enabled, points_payment_value: value, points_payment_max_percent: maxPercent, points_payment_earns_rest: earnsRest })
    .eq('id', 1)
  if (error) return NextResponse.json({ error: 'Nie udało się zapisać ustawień.' }, { status: 503 })
  return NextResponse.json({ enabled, value, maxPercent, earnsRest })
}
