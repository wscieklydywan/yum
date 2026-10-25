import { NextResponse } from 'next/server'
import { DEFAULT_WHEEL_CONFIG } from '@/lib/marketing'
import { getCachedWheelConfig } from '@/lib/public-cache'

// Display only: spin RPCs check wheel_enabled / extra_spin_* on fresh data in the database.
export async function GET() {
  const config = await getCachedWheelConfig().catch(() => DEFAULT_WHEEL_CONFIG)
  return NextResponse.json(config, { headers: { 'Cache-Control': 'no-store' } })
}
