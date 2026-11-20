import { NextResponse } from 'next/server'
import { finalizeHalloween } from '@/lib/halloween-winners'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return NextResponse.json(await finalizeHalloween())
  } catch (error) {
    console.error('Halloween finalize failed', error)
    return NextResponse.json({ error: 'Finalize failed' }, { status: 500 })
  }
}
