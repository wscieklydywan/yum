import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadRestaurantStatus } from '@/lib/restaurant-state'

export async function GET() {
  const status = await loadRestaurantStatus(await createClient())
  if (!status) return NextResponse.json({ error: 'Nie udało się sprawdzić statusu lokalu.' }, { status: 503 })
  return NextResponse.json(status, { headers: { 'Cache-Control': 'no-store' } })
}
