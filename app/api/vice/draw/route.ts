import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'
import { drawViceWinner, getCachedLatestWinner, getViceDrawStats, VICE_WINNER_TAG, type ViceDrawState } from '@/lib/vice-draw'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'private, no-store' }

async function isManager() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  return (MANAGER_ROLES as readonly string[]).includes(profile?.role ?? '')
}

export async function GET() {
  try {
    const [canDraw, winner] = await Promise.all([isManager(), getCachedLatestWinner()])
    // Once drawn, the result card already carries the final pool size, so regular visitors skip the orders scan.
    // Managers still get live stats because they can run the draw again.
    const stats = winner && !canDraw ? { participants: winner.participants, tickets: winner.totalTickets, names: [] } : await getViceDrawStats()
    const body: ViceDrawState = { ...stats, canDraw, winner }
    return NextResponse.json(body, { headers: noStore })
  } catch {
    return NextResponse.json({ error: 'Nie udało się pobrać statystyk losowania.' }, { status: 500, headers: noStore })
  }
}

export async function POST() {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if (auth.response) return auth.response
  try {
    const winner = await drawViceWinner(auth.user.id)
    if (!winner) return NextResponse.json({ error: 'Pula jest pusta – nikt jeszcze nie kupił VICE Zestawu.' }, { status: 409, headers: noStore })
    revalidateTag(VICE_WINNER_TAG, { expire: 0 })
    return NextResponse.json({ winner }, { headers: noStore })
  } catch {
    return NextResponse.json({ error: 'Losowanie nie powiodło się. Spróbuj ponownie.' }, { status: 500, headers: noStore })
  }
}
