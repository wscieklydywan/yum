import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles } from '@/lib/workshop-auth'
import { KIOSK_ROLES } from '@/lib/kiosk'
import { getTier } from '@/lib/loyalty'
import { isValidPhone, normalizePhone } from '@/lib/phone'
import { normalizeWorkshopCode, previewWorkshopCode, WorkshopCodeError } from '@/lib/workshop-codes'
import { describeCodeBenefit } from '@/lib/checkout-codes'

// GET ?code=  -> preview of a promo code / Yummy Club coupon (not redeemed yet)
// GET ?phone= -> Yummy Club member by phone (first name + tier only, nothing else leaves the server)
export async function GET(request: Request) {
  const auth = await authorizeRoles(KIOSK_ROLES)
  if ('response' in auth) return auth.response
  const params = new URL(request.url).searchParams
  const admin = createAdminClient()

  if (params.has('phone')) {
    const phone = normalizePhone(params.get('phone'))
    if (!isValidPhone(phone)) return NextResponse.json({ error: 'Numer telefonu musi mieć 9 cyfr.' }, { status: 400 })
    const { data } = await admin.from('profiles').select('full_name, status_points').eq('phone', phone).eq('role', 'klient').maybeSingle()
    if (!data) return NextResponse.json({ error: 'Nie znaleziono konta Yummy Club z tym numerem.' }, { status: 404 })
    const tier = getTier(data.status_points ?? 0)
    return NextResponse.json({ phone, firstName: data.full_name?.split(' ')[0] ?? null, tierName: tier.name, tierPercent: tier.percent })
  }

  const code = normalizeWorkshopCode(params.get('code'))
  if (code.length < 3) return NextResponse.json({ error: 'Wpisz kod.' }, { status: 400 })
  try {
    const preview = await previewWorkshopCode(admin, code)
    return NextResponse.json({ code: preview.code, benefit: describeCodeBenefit(preview) })
  } catch (error) {
    if (error instanceof WorkshopCodeError) return NextResponse.json({ error: error.message }, { status: 404 })
    return NextResponse.json({ error: 'Nie udało się sprawdzić kodu.' }, { status: 503 })
  }
}
