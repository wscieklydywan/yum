import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { loadPointsPayment } from '@/lib/points-payment-server'
import { DEFAULT_POINTS_PAYMENT, type PublicPointsPayment } from '@/lib/points-payment'

export async function GET() {
  const admin = createAdminClient()
  const settings = (await loadPointsPayment(admin)) ?? DEFAULT_POINTS_PAYMENT
  let balance: number | null = null
  if (settings.enabled) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await admin.from('profiles').select('points').eq('id', user.id).maybeSingle()
      balance = data ? Number(data.points) : null
    }
  }
  const body: PublicPointsPayment = { ...settings, balance }
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
