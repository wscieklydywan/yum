import { NextResponse } from 'next/server'
import { getCachedCatalog, getCachedRestaurantSettings } from '@/lib/public-cache'
import { computeStatus, stationOpen } from '@/lib/restaurant-status'

export async function GET(request: Request) {
  const includeUnavailable = new URL(request.url).searchParams.get('include') === 'unavailable'
  const [catalog, settings] = await Promise.all([getCachedCatalog(), getCachedRestaurantSettings()])
  if (!catalog) return NextResponse.json({ error: 'Menu jest chwilowo niedostępne.' }, { status: 503 })
  // Status depends on the current time (opening hours), so it is computed per request from cached settings.
  const status = settings ? computeStatus(settings) : null
  const isOrderable = (product: (typeof catalog)[number]) => product.available && (!status || stationOpen(status, product.station))
  const body = includeUnavailable
    ? catalog.map((product) => ({ ...product, disabled: !isOrderable(product) }))
    : catalog.filter(isOrderable)
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
