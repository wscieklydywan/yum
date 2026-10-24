import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'
import { DEFAULT_LOYALTY_RATE, MAX_LOYALTY_POINTS, MAX_LOYALTY_SPEND } from '@/lib/loyalty-rate'

export async function GET() {
  const auth = await authorizeRoles(['admin', 'szef', 'kelner', 'kuchnia'])
  if ('response' in auth) return auth.response
  const { data } = await createAdminClient().from('restaurant_settings').select('loyalty_points, loyalty_spend').eq('id', 1).maybeSingle()
  return NextResponse.json({
    rate: data ? { points: Number(data.loyalty_points), spend: Number(data.loyalty_spend) } : DEFAULT_LOYALTY_RATE,
  })
}

export async function PUT(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = (await request.json().catch(() => null)) as { points?: number; spend?: number } | null
  const points = Number(body?.points)
  const spend = Math.round(Number(body?.spend) * 100) / 100
  if (!Number.isInteger(points) || points < 0 || points > MAX_LOYALTY_POINTS || !(spend > 0) || spend > MAX_LOYALTY_SPEND) {
    return NextResponse.json({ error: `Punkty 0–${MAX_LOYALTY_POINTS}, kwota 0,01–${MAX_LOYALTY_SPEND} zł.` }, { status: 400 })
  }
  const { error } = await createAdminClient().from('restaurant_settings').update({ loyalty_points: points, loyalty_spend: spend }).eq('id', 1)
  if (error) return NextResponse.json({ error: 'Nie udało się zapisać przelicznika.' }, { status: 503 })
  return NextResponse.json({ rate: { points, spend } })
}
