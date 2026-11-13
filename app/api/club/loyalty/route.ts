import { NextResponse } from 'next/server'
import { getCachedLoyalty } from '@/lib/public-cache'
import { FALLBACK_LOYALTY } from '@/lib/loyalty-public'

// Display only: redeem_reward and loyalty_apply always read fresh data in the database.
export async function GET() {
  const loyalty = await getCachedLoyalty().catch(() => FALLBACK_LOYALTY)
  return NextResponse.json(loyalty, { headers: { 'Cache-Control': 'no-store' } })
}
