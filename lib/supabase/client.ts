import { createBrowserClient } from '@supabase/ssr'
import { supabaseUrl } from './url'

export function createClient() {
  return createBrowserClient(
    supabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: { secure: process.env.NODE_ENV === 'production' },
      // Heartbeat from a Web Worker so background tabs (throttled timers) keep the Realtime socket alive.
      realtime: { worker: true },
    },
  )
}
