import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles } from '@/lib/workshop-auth'

const BAR_ROLES = ['admin', 'szef', 'kelner'] as const

/** Records a fiscal daily report – printed by POSNET from the app, or confirmed by hand when done on the till itself. */
export async function POST(request: Request) {
  const auth = await authorizeRoles(BAR_ROLES)
  if ('response' in auth) return auth.response

  const body = (await request.json().catch(() => null)) as { source?: unknown; recovered?: unknown } | null
  const source = body?.source === 'manual' ? 'manual' : 'posnet'
  const note = source === 'manual' ? 'Potwierdzone ręcznie – raport zrobiony na kasie' : body?.recovered === true ? 'Odzyskane potwierdzenie z POSNET' : null

  const admin = createAdminClient()
  const { data, error } = await admin.from('fiscal_daily_reports').insert({ source, note, created_by: auth.user.id }).select('id, printed_at').single()
  if (error || !data) return NextResponse.json({ error: 'Nie udało się zapisać raportu fiskalnego.' }, { status: 500 })
  return NextResponse.json({ id: data.id, printedAt: data.printed_at })
}
