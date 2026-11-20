import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseUrl } from '@/lib/supabase/url'
import { DEFAULT_ABOUT, parseAboutContent, type AboutContent } from '@/lib/about'

export const storageOrigin = () => {
  try {
    return new URL(supabaseUrl()).origin
  } catch {
    return null
  }
}

/** Throws on a read error so a failed read is never cached. A missing row means the built-in default content. */
export async function loadAbout(admin: SupabaseClient): Promise<AboutContent> {
  const { data, error } = await admin.from('about_page').select('content').eq('id', 1).maybeSingle()
  if (error) throw error
  if (!data) return DEFAULT_ABOUT
  const parsed = parseAboutContent(data.content, storageOrigin())
  return typeof parsed === 'string' ? DEFAULT_ABOUT : parsed
}
