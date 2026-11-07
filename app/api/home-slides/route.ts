import { NextResponse } from 'next/server'
import { getCachedCatalog, getCachedHomeSlides, getCachedRestaurantSettings } from '@/lib/public-cache'
import { computeStatus, stationOpen } from '@/lib/restaurant-status'
import { isSeasonExpired } from '@/lib/menu'
import { DEFAULT_HOME_SLIDES, isBurgerWeekExpired, type PublicHomeSlides } from '@/lib/home-slides'

export async function GET() {
  const settings = await getCachedHomeSlides().catch(() => null)
  if (!settings) return NextResponse.json(DEFAULT_HOME_SLIDES, { headers: { 'Cache-Control': 'no-store' } })

  let burgerWeek: PublicHomeSlides['burgerWeek'] = null
  const week = settings.burger_week
  if (week.enabled && week.product_id && !isBurgerWeekExpired(week.until)) {
    const [catalog, restaurant] = await Promise.all([getCachedCatalog(), getCachedRestaurantSettings()])
    const product = catalog?.find((item) => item.id === week.product_id)
    const status = restaurant ? computeStatus(restaurant) : null
    // Hidden while the product is switched off, so the slide never leads to something that can't be ordered.
    if (product && product.available && !isSeasonExpired(product.availableUntil)) {
      const { available: _available, station: _station, vat: _vat, ...publicProduct } = product
      burgerWeek = {
        title: week.title,
        text: week.text,
        until: week.until,
        product: { ...publicProduct, disabled: status ? !stationOpen(status, product.station) : false },
      }
    }
  }

  const body: PublicHomeSlides = { order: settings.order, hidden: settings.hidden, burgerWeek }
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
