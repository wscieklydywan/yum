import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles } from '@/lib/workshop-auth'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  const auth = await authorizeRoles(['admin', 'szef', 'kelner'])
  if ('response' in auth) return auth.response

  const body = (await request.json().catch(() => null)) as { email?: string } | null
  const email = (body?.email ?? '').trim().toLowerCase()
  if (!emailPattern.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Podaj poprawny adres e-mail.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: existing } = await admin.from('profiles').select('id').eq('email_lower', email).maybeSingle()
  if (existing) return NextResponse.json({ error: 'Ten adres ma już konto w Yummy Club.' }, { status: 409 })

  const origin = new URL(request.url).origin
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/yummy-club/nowe-haslo`,
    data: { invited_by: auth.user.id },
  })
  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes('already') || error.code === 'email_exists') {
      return NextResponse.json({ error: 'Ten adres ma już konto w Yummy Club.' }, { status: 409 })
    }
    if (error.status === 429 || message.includes('rate limit')) {
      return NextResponse.json({ error: 'Za dużo wysłanych maili. Spróbuj za chwilę.' }, { status: 429 })
    }
    return NextResponse.json({ error: 'Nie udało się wysłać zaproszenia.' }, { status: 503 })
  }
  return NextResponse.json({ ok: true }, { status: 201 })
}
