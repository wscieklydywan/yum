import { NextResponse } from 'next/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'
import { finalizeHalloween, loadWinnersAdmin, sendPendingWinnerEmails } from '@/lib/halloween-winners'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function payload() {
  const [winners, settings] = await Promise.all([
    loadWinnersAdmin(),
    createAdminClient().from('halloween_settings').select('ends_at, finalized_at').eq('id', 1).single(),
  ])
  return {
    winners,
    ends_at: settings.data?.ends_at ?? null,
    finalized_at: settings.data?.finalized_at ?? null,
    email_configured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
  }
}

export async function GET() {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  try {
    return NextResponse.json(await payload())
  } catch {
    return NextResponse.json({ error: 'Nie udało się wczytać zwycięzców.' }, { status: 503 })
  }
}

export async function POST(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = (await request.json().catch(() => null)) as { action?: string } | null
  try {
    if (body?.action === 'end_now') {
      const admin = createAdminClient()
      const { data: settings } = await admin.from('halloween_settings').select('starts_at, ends_at, finalized_at').eq('id', 1).single()
      if (settings?.finalized_at) return NextResponse.json({ error: 'Gra jest już rozstrzygnięta.' }, { status: 409 })
      const now = new Date()
      if (settings && new Date(settings.ends_at) > now) {
        const update: Record<string, string> = { ends_at: now.toISOString(), updated_at: now.toISOString() }
        if (new Date(settings.starts_at) >= now) update.starts_at = new Date(now.getTime() - 1000).toISOString()
        const { error } = await admin.from('halloween_settings').update(update).eq('id', 1)
        if (error) throw error
      }
      await finalizeHalloween()
    } else if (body?.action === 'finalize') {
      const result = await finalizeHalloween()
      if (!result.finalized) return NextResponse.json({ error: 'Gra jeszcze trwa – rozstrzygnięcie po jej końcu.' }, { status: 409 })
    } else if (body?.action === 'resend') {
      await sendPendingWinnerEmails()
    } else {
      return NextResponse.json({ error: 'Nieznana akcja.' }, { status: 400 })
    }
    return NextResponse.json(await payload())
  } catch {
    return NextResponse.json({ error: 'Operacja nie powiodła się.' }, { status: 503 })
  }
}
