import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  // Public read-only APIs don't need a session refresh; skipping them avoids a Supabase Auth round trip per request.
  // api/yummy-club/orders is polled during live tracking and refreshes its own session via getClaims.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/menu/|api/promotions|api/restaurant/status|api/wheel/config|api/yummy-club/orders|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)'],
}
