import { NextResponse } from 'next/server'
import { getCachedWheelPrizes } from '@/lib/public-cache'

export async function GET() {
  try {
    const prizes = await getCachedWheelPrizes()
    return NextResponse.json({ prizes }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Nie udało się pobrać nagród.' }, { status: 503 })
  }
}
