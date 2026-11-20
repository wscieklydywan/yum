import 'server-only'
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { MENU_CATEGORIES_TAG } from '@/lib/menu-cache'
import type { MenuCategory } from '@/lib/menu'

/** One cached read shared by the API route and the home page, invalidated by the workshop via MENU_CATEGORIES_TAG. */
export const getCachedMenuCategories = unstable_cache(async (): Promise<MenuCategory[]> => {
  const { data, error } = await createAdminClient().from('menu_categories').select('id, label, image').order('sort')
  if (error) throw error
  return (data ?? []) as MenuCategory[]
}, ['menu-categories'], { tags: [MENU_CATEGORIES_TAG], revalidate: 3600 })
