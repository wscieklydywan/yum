import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isValidPhone, normalizePhone } from '@/lib/phone'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Zaloguj się ponownie.' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { phone?: string; name?: string } | null
  const phone = normalizePhone(body?.phone)
  if (!isValidPhone(phone)) return NextResponse.json({ error: 'Numer telefonu musi mieć 9 cyfr.' }, { status: 400 })
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : ''

  const { error } = await createAdminClient()
    .from('profiles')
    .update(name ? { phone, full_name: name } : { phone })
    .eq('id', user.id)
  if (error) {
    const taken = error.code === '23505'
    return NextResponse.json(
      { error: taken ? 'Ten numer jest już przypisany do innego konta.' : 'Nie udało się zapisać numeru.' },
      { status: taken ? 409 : 503 },
    )
  }
  return NextResponse.json({ phone })
}
