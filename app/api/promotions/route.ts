import { NextResponse } from 'next/server'
import { getCachedPromotions } from '@/lib/public-cache'

export async function GET() {
  const promotions = await getCachedPromotions()
  return NextResponse.json(promotions, { headers: { 'Cache-Control': 'no-store' } })
}
