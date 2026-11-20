import 'server-only'
import { getCachedCatalog, getCachedHomeSlides, getCachedPromotions, getCachedRestaurantSettings } from '@/lib/public-cache'
import { computeStatus, stationOpen } from '@/lib/restaurant-status'
import { isSeasonExpired, type Product } from '@/lib/menu'
import { DEFAULT_CLUB_TILES } from '@/lib/club-tiles'
import { DEFAULT_HOME_SLIDES, isBurgerWeekExpired, isSlideExpired, warsawDate, type PublicCustomSlide, type PublicHomeSlides } from '@/lib/home-slides'

/** Public slider data built only from the server cache, so it never queries Supabase unless the workshop invalidated it. */
export async function loadPublicHomeSlides(): Promise<{ body: PublicHomeSlides; cached: boolean }> {
  const settings = await getCachedHomeSlides().catch(() => null)
  if (!settings) return { body: DEFAULT_HOME_SLIDES, cached: false }

  const week = settings.burger_week
  const weekActive = week.enabled && week.product_id && !isBurgerWeekExpired(week.until)
  const datedCustom = settings.custom.filter((slide) => !isSlideExpired(slide.until))
  const needsCatalog = weekActive || datedCustom.some((slide) => slide.product_id)
  const needsPromotions = datedCustom.some((slide) => slide.promotion_id)

  const [[catalog, restaurant], promotions] = await Promise.all([
    needsCatalog ? Promise.all([getCachedCatalog(), getCachedRestaurantSettings()]) : Promise.resolve([null, null] as const),
    needsPromotions ? getCachedPromotions().catch(() => []) : Promise.resolve([]),
  ])
  // Cached promotions are only the active ones; the slide also waits for its date range.
  // Hours and weekdays are rechecked on the client, so the slide flips on and off without a reload.
  const promotionFor = (id: string | null) => {
    const promotion = id ? promotions.find((item) => item.id === id) : undefined
    if (!promotion || !promotion.online) return null
    const today = warsawDate(new Date().toISOString())
    if ((promotion.valid_from && today < promotion.valid_from) || (promotion.valid_to && today > promotion.valid_to)) return null
    return promotion
  }
  const activeCustom = datedCustom.filter((slide) => !slide.promotion_id || promotionFor(slide.promotion_id))
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
    if (product) burgerWeek = { title: week.title, text: week.text, until: week.until, imageFit: week.image_fit, imagePosition: week.image_position, product }
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
      imageMobile: slide.image_url ? slide.image_mobile_url : null,
      theme: slide.theme,
      until: slide.until,
      ctaLabel: slide.cta_label,
      href: slide.cta_href,
      product,
      promotion: promotionFor(slide.promotion_id),
    }]
  })

  return { body: { order: settings.order, hidden: settings.hidden, clubHidden: settings.club_hidden ?? [], clubFeedHidden: settings.club_feed_hidden ?? [], clubTiles: settings.club_tiles ?? DEFAULT_CLUB_TILES, burgerWeek, custom }, cached: true }
}
