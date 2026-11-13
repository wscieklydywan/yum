import type { SupabaseClient } from '@supabase/supabase-js'
import { isSlideImageMode, isSlideTheme, normalizeHidden, normalizeSlideOrder, type CustomSlide, type HomeSlidesSettings } from './home-slides'

const SETTINGS_COLUMNS = 'slide_order, hidden_slides, club_hidden_slides, burger_week_enabled, burger_week_product_id, burger_week_title, burger_week_text, burger_week_until, burger_week_price'
export const CUSTOM_COLUMNS = 'id, badge, title, text, image_url, image_mode, product_id, cta_label, cta_href, theme, until'

type CustomRow = Omit<CustomSlide, 'theme' | 'image_mode'> & { theme: string; image_mode?: string | null }

export const toCustomSlide = (row: CustomRow): CustomSlide => ({
  id: row.id,
  badge: row.badge ?? '',
  title: row.title,
  text: row.text ?? '',
  image_url: row.image_url ?? null,
  image_mode: isSlideImageMode(row.image_mode) ? row.image_mode : 'circle',
  product_id: row.product_id ?? null,
  cta_label: row.cta_label ?? '',
  cta_href: row.cta_href ?? null,
  theme: isSlideTheme(row.theme) ? row.theme : 'yellow',
  until: row.until ?? null,
})

/** Throws on a read error. */
export async function loadHomeSlides(admin: SupabaseClient): Promise<HomeSlidesSettings> {
  const [settings, custom] = await Promise.all([
    admin.from('home_slides_settings').select(SETTINGS_COLUMNS).eq('id', 1).maybeSingle(),
    admin.from('home_custom_slides').select(CUSTOM_COLUMNS).order('created_at'),
  ])
  if (settings.error) throw settings.error
  if (custom.error) throw custom.error
  const data = settings.data
  const slides = (custom.data ?? []).map((row) => toCustomSlide(row as CustomRow))
  const ids = slides.map((slide) => slide.id)
  return {
    order: normalizeSlideOrder(data?.slide_order, ids),
    hidden: normalizeHidden(data?.hidden_slides, ids),
    club_hidden: normalizeHidden(data?.club_hidden_slides, ids),
    burger_week: {
      enabled: data?.burger_week_enabled ?? false,
      product_id: data?.burger_week_product_id ?? null,
      title: data?.burger_week_title ?? 'Burger tygodnia',
      text: data?.burger_week_text ?? '',
      until: data?.burger_week_until ?? null,
      price: data?.burger_week_price === null || data?.burger_week_price === undefined ? null : Number(data.burger_week_price),
    },
    custom: slides,
  }
}
