import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { supabaseUrl } from './url'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    supabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: { secure: process.env.NODE_ENV === 'production' },
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Server Components cannot write refreshed cookies; proxy.ts handles refreshes.
          }
        },
      },
    },
  )
}

export function createAdminClient() {
  const key = process.env.YUMMY_SUPABASE_SECRET_KEY
  if (!key) throw new Error('YUMMY_SUPABASE_SECRET_KEY is not configured')
  return createSupabaseClient(supabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
