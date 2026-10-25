import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseUrl } from './url'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    supabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: { secure: process.env.NODE_ENV === 'production' },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )
  // The proxy only refreshes the session cookie; it never authorizes anything. getClaims() still refreshes an expired
  // token via getSession() but verifies the ES256 JWT locally, so pages and Route Handlers keep their own getUser()
  // check (revoked sessions, roles) without paying for a second Supabase Auth round trip here.
  await supabase.auth.getClaims()
  return response
}
