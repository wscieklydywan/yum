import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { MENU_CATEGORIES_TAG } from '@/lib/menu-cache'

const getCategories = unstable_cache(async () => {
  const { data, error } = await createAdminClient().from('menu_categories').select('id, label, image').order('sort')
  if (error) throw error
  return data
}, ['menu-categories'], { tags: [MENU_CATEGORIES_TAG], revalidate: 3600 })

export async function GET() {
  try {
    const data = await getCategories()
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-cache' } })
  } catch {
    return NextResponse.json({ error: 'Kategorie menu są chwilowo niedostępne.' }, { status: 503 })
  }
}
