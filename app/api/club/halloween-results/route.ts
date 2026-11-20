import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { finalizeHalloween } from '@/lib/halloween-winners'
import type { HalloweenResults } from '@/lib/halloween'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  const load = async () => {
    const { data, error } = await supabase.rpc('halloween_results')
    if (error) throw error
    return data as HalloweenResults
  }

  try {
    let results = await load()
    // Jeśli cron jeszcze nie zadziałał, pierwszy klient po końcu gry wyzwala rozstrzygnięcie.
    if (results.ended && !results.finalized) {
      await finalizeHalloween().catch((error) => console.error('Halloween finalize failed', error))
      results = await load()
    }
    return NextResponse.json(results, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'Nie udało się wczytać wyników.' }, { status: 503 })
  }
}
