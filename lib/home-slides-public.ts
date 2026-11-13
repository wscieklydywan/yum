import 'server-only'
import { getCachedCatalog, getCachedHomeSlides, getCachedRestaurantSettings } from '@/lib/public-cache'
import { computeStatus, stationOpen } from '@/lib/restaurant-status'
import { isSeasonExpired, type Product } from '@/lib/menu'
import { DEFAULT_HOME_SLIDES, isBurgerWeekExpired, isSlideExpired, type PublicCustomSlide, type PublicHomeSlides } from '@/lib/home-slides'

/** Public slider data built only from the server cache, so it never queries Supabase unless the workshop invalidated it. */
export async function loadPublicHomeSlides(): Promise<{ body: PublicHomeSlides; cached: boolean }> {
  const settings = await getCachedHomeSlides().catch(() => null)
  if (!settings) return { body: DEFAULT_HOME_SLIDES, cached: false }

  const week = settings.burger_week
  const weekActive = week.enabled && week.product_id && !isBurgerWeekExpired(week.until)
  const activeCustom = settings.custom.filter((slide) => !isSlideExpired(slide.until))
  const needsCatalog = weekActive || activeCustom.some((slide) => slide.product_id)

  const [catalog, restaurant] = needsCatalog ? await Promise.all([getCachedCatalog(), getCachedRestaurantSettings()]) : [null, null]
  const status = restaurant ? computeStatus(restaurant) : null

  // Hidden while the product is switched off, so a slide never leads to something that can't be ordered.
  // `station` stays public so the page can recheck the live kitchen/bar status on the client.
  const orderable = (productId: string | null): (Product & { disabled?: boolean }) | null => {
    const product = productId ? catalog?.find((item) => item.id === productId) : undefined
    if (!product || !product.available || isSeasonExpired(product.availableUntil)) return null
    const { available: _available, vat: _vat, ...publicProduct } = product
    return { ...publicProduct, disabled: status ? !stationOpen(status, product.station) : false } as Product & { disabled?: boolean }
  }

  let burgerWeek: PublicHomeSlides['burgerWeek'] = null
  if (weekActive) {
    const product = orderable(week.product_id)
    if (product) burgerWeek = { title: week.title, text: week.text, until: week.until, product }
  }

  const custom = activeCustom.flatMap((slide): PublicCustomSlide[] => {
    const product = slide.product_id ? orderable(slide.product_id) : null
    if (slide.product_id && !product) return []
    return [{
      id: slide.id,
      badge: slide.badge,
      title: slide.title,
      text: slide.text || product?.description || '',
      image: slide.image_url || product?.image || null,
      // A banner only makes sense with an uploaded slide graphic; the menu photo stays in the circle.
      imageMode: slide.image_url ? slide.image_mode : 'circle',
      theme: slide.theme,
      until: slide.until,
      ctaLabel: slide.cta_label,
      href: slide.cta_href,
      product,
    }]
  })

  return { body: { order: settings.order, hidden: settings.hidden, clubHidden: settings.club_hidden ?? [], burgerWeek, custom }, cached: true }
}
