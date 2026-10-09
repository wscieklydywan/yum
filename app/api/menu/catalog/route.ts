import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadCatalog } from '@/lib/menu-catalog'
import { loadRestaurantStatus } from '@/lib/restaurant-state'
import { stationOpen } from '@/lib/restaurant-status'

export async function GET(request: Request) {
  const includeUnavailable = new URL(request.url).searchParams.get('include') === 'unavailable'
  const supabase = await createClient()
  const [catalog, status] = await Promise.all([loadCatalog(supabase), loadRestaurantStatus(supabase)])
  if (!catalog) return NextResponse.json({ error: 'Menu jest chwilowo niedostępne.' }, { status: 503 })
  const isOrderable = (product: (typeof catalog)[number]) => product.available && (!status || stationOpen(status, product.station))
  const body = includeUnavailable
    ? catalog.map((product) => ({ ...product, disabled: !isOrderable(product) }))
    : catalog.filter(isOrderable)
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
