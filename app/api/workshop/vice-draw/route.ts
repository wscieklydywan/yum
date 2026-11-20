import { NextResponse } from 'next/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'
import { getLatestDrawAdmin, getViceDrawStats, sendViceWinnerEmail } from '@/lib/vice-draw'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'private, no-store' }

export async function GET() {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if (auth.response) return auth.response
  try {
    const [stats, draw] = await Promise.all([getViceDrawStats(), getLatestDrawAdmin()])
    return NextResponse.json(
      { participants: stats.participants, tickets: stats.tickets, draw, emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) },
      { headers: noStore },
    )
  } catch {
    return NextResponse.json({ error: 'Nie udało się wczytać losowania.' }, { status: 500, headers: noStore })
  }
}

export async function POST(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if (auth.response) return auth.response
  const body = (await request.json().catch(() => null)) as { action?: string; drawId?: string } | null
  if (body?.action !== 'send_email' || typeof body.drawId !== 'string') {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400, headers: noStore })
  }
  try {
    const result = await sendViceWinnerEmail(body.drawId)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: noStore })
    return NextResponse.json({ draw: result.draw }, { headers: noStore })
  } catch {
    return NextResponse.json({ error: 'Nie udało się wysłać maila.' }, { status: 500, headers: noStore })
  }
}
