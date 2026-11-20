import type { SupabaseClient } from '@supabase/supabase-js'
import { clubTilesFromStored } from './club-tiles'
import { clubFeedFromStored, isSlideImageMode, isSlideKind, isSlideTheme, normalizeHidden, normalizeSlideOrder, type CustomSlide, type HomeSlidesSettings } from './home-slides'

const SETTINGS_COLUMNS = 'slide_order, hidden_slides, club_hidden_slides, burger_week_enabled, burger_week_product_id, burger_week_title, burger_week_text, burger_week_until, burger_week_price, burger_week_image_fit, burger_week_image_position'
const BASE_CUSTOM_COLUMNS = 'id, badge, title, text, image_url, image_mode, product_id, cta_label, cta_href, theme, until'
const KIND_CUSTOM_COLUMNS = `${BASE_CUSTOM_COLUMNS}, kind`
const MOBILE_CUSTOM_COLUMNS = `${KIND_CUSTOM_COLUMNS}, image_mobile_url`
export const CUSTOM_COLUMNS = `${MOBILE_CUSTOM_COLUMNS}, promotion_id`

type CustomRow = Omit<CustomSlide, 'theme' | 'image_mode' | 'kind' | 'image_mobile_url' | 'promotion_id'> & { theme: string; image_mode?: string | null; kind?: string | null; image_mobile_url?: string | null; promotion_id?: string | null }

const isMissingColumn = (error: { code?: string; message?: string } | null, column: string) =>
  Boolean(error && (error.code === '42703' || error.code === 'PGRST204') && error.message?.includes(column))

/** Kolumna `kind` pochodzi z migracji 20270104 — dopóki jej nie ma, działamy bez niej. */
export const isMissingKindColumn = (error: { code?: string; message?: string } | null) => isMissingColumn(error, 'kind')

/** Kolumna `image_mobile_url` pochodzi z migracji 20270105 — dopóki jej nie ma, działamy bez niej. */
export const isMissingMobileImageColumn = (error: { code?: string; message?: string } | null) => isMissingColumn(error, 'image_mobile_url')

/** Kolumna `promotion_id` pochodzi z migracji 20270106 — dopóki jej nie ma, działamy bez niej. */
export const isMissingPromotionColumn = (error: { code?: string; message?: string } | null) => isMissingColumn(error, 'promotion_id')

export const toCustomSlide = (row: CustomRow): CustomSlide => ({
  id: row.id,
  kind: isSlideKind(row.kind) ? row.kind : row.product_id ? 'dish' : 'other',
  badge: row.badge ?? '',
  title: row.title,
  text: row.text ?? '',
  image_url: row.image_url ?? null,
  image_mobile_url: row.image_mobile_url ?? null,
  image_mode: isSlideImageMode(row.image_mode) ? row.image_mode : 'circle',
  product_id: row.product_id ?? null,
  cta_label: row.cta_label ?? '',
  cta_href: row.cta_href ?? null,
  theme: isSlideTheme(row.theme) ? row.theme : 'yellow',
  until: row.until ?? null,
  promotion_id: row.promotion_id ?? null,
})

/** Throws on a read error. */
export async function loadHomeSlides(admin: SupabaseClient): Promise<HomeSlidesSettings> {
  const [settings, firstCustom] = await Promise.all([
    admin.from('home_slides_settings').select(SETTINGS_COLUMNS).eq('id', 1).maybeSingle(),
    admin.from('home_custom_slides').select(CUSTOM_COLUMNS).order('created_at'),
  ])
  let custom: { data: CustomRow[] | null; error: typeof firstCustom.error } = firstCustom
  if (isMissingPromotionColumn(custom.error)) custom = await admin.from('home_custom_slides').select(MOBILE_CUSTOM_COLUMNS).order('created_at')
  if (isMissingMobileImageColumn(custom.error)) custom = await admin.from('home_custom_slides').select(KIND_CUSTOM_COLUMNS).order('created_at')
  if (isMissingKindColumn(custom.error)) custom = await admin.from('home_custom_slides').select(BASE_CUSTOM_COLUMNS).order('created_at')
  if (settings.error) throw settings.error
  if (custom.error) throw custom.error
  const data = settings.data
  const slides = (custom.data ?? []).map((row) => toCustomSlide(row as CustomRow))
  const ids = slides.map((slide) => slide.id)
  return {
    order: normalizeSlideOrder(data?.slide_order, ids),
    hidden: normalizeHidden(data?.hidden_slides, ids),
    club_hidden: normalizeHidden(data?.club_hidden_slides, ids),
    club_feed_hidden: clubFeedFromStored(data?.club_hidden_slides),
    club_tiles: clubTilesFromStored(data?.club_hidden_slides),
    burger_week: {
      enabled: data?.burger_week_enabled ?? false,
      product_id: data?.burger_week_product_id ?? null,
      title: data?.burger_week_title ?? 'Burger tygodnia',
      text: data?.burger_week_text ?? '',
      until: data?.burger_week_until ?? null,
      price: data?.burger_week_price === null || data?.burger_week_price === undefined ? null : Number(data.burger_week_price),
      image_fit: data?.burger_week_image_fit === 'cover' ? 'cover' : 'contain',
      image_position: data?.burger_week_image_position === 'top' || data?.burger_week_image_position === 'bottom' ? data.burger_week_image_position : 'center',
    },
    custom: slides,
  }
}
