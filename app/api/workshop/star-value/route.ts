import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'
import { loadStarValue } from '@/lib/star-value-server'
import { PRIVATE_CACHE } from '@/lib/marketing-kpis-server'

/** Lekki endpoint: 2 małe zapytania zamiast pełnego katalogu nagród z produktami i statystykami. */
export async function GET() {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response

  const star = await loadStarValue(createAdminClient())
  if (!star) return NextResponse.json({ error: 'Nie udało się wczytać wartości Stars.' }, { status: 500 })
  return NextResponse.json(star, { headers: PRIVATE_CACHE })
}
