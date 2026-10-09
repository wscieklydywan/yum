import 'server-only'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const MANAGER_ROLES = ['admin', 'szef'] as const

export async function authorizeRoles(allowed: readonly string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { response: NextResponse.json({ error: 'Zaloguj się ponownie.' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = profile?.role as string | undefined
  if (!role || !allowed.includes(role)) return { response: NextResponse.json({ error: 'Brak uprawnień.' }, { status: 403 }) }
  return { user, role }
}
