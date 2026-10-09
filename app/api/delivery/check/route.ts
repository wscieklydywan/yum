import { NextResponse } from 'next/server'
import { checkDeliveryZone } from '@/lib/delivery-zone'
import { createAdminClient } from '@/lib/supabase/server'
import { loadRestaurantSettings } from '@/lib/restaurant-state'
import { DEFAULT_DELIVERY_ZONES } from '@/lib/order-settings'

export async function POST(request: Request) {
  let body: { street?: unknown; city?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Nieprawidłowe dane.' }, { status: 400 })
  }

  const street = typeof body.street === 'string' ? body.street.trim() : ''
  const city = typeof body.city === 'string' ? body.city.trim() : ''
  if (street.length < 3 || city.length < 2) {
    return NextResponse.json({ ok: false, reason: 'not_found', message: 'Podaj ulicę z numerem i miasto.' }, { status: 400 })
  }

  const settings = await loadRestaurantSettings(createAdminClient())
  const result = await checkDeliveryZone(street, city, settings?.deliveryZones ?? DEFAULT_DELIVERY_ZONES)
  return NextResponse.json(result)
}
