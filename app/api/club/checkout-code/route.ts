import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GUEST_CHECKOUT_CODE, GUEST_PROMO_CODE, checkoutCodeError, type CheckoutCode } from '@/lib/checkout-codes'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { code?: unknown } | null
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase().replace(/\s+/g, '').slice(0, 24) : ''
  if (!code) return NextResponse.json({ error: 'Wpisz kod rabatowy.' }, { status: 400, headers: NO_STORE })
  if (code === GUEST_PROMO_CODE) return NextResponse.json(GUEST_CHECKOUT_CODE, { headers: NO_STORE })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: checkoutCodeError('not_authenticated') }, { status: 401, headers: NO_STORE })

  const { data, error } = await supabase.rpc('checkout_code_preview', { p_code: code })
  if (error || !data) {
    if (!error || !(error.message in { promo_invalid: 1, promo_expired: 1, promo_exhausted: 1, promo_already_used: 1, promo_points_only: 1, not_authenticated: 1 })) {
      console.error('[checkout-code] preview failed', error)
    }
    return NextResponse.json({ error: checkoutCodeError(error?.message ?? error?.code) }, { status: 409, headers: NO_STORE })
  }
  return NextResponse.json(data as CheckoutCode, { headers: NO_STORE })
}
