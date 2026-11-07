import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isValidPhone, normalizePhone } from '@/lib/phone'

const staffRoles = ['admin', 'szef', 'kuchnia', 'kelner', 'kierowca']

const cleanName = (value: unknown) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 40) : '')

async function currentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function PATCH(request: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'Zaloguj się ponownie.' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { firstName?: string; lastName?: string; phone?: string } | null
  const firstName = cleanName(body?.firstName)
  const lastName = cleanName(body?.lastName)
  const phone = normalizePhone(body?.phone)

  if (!firstName) return NextResponse.json({ error: 'Podaj imię.' }, { status: 400 })
  if (!isValidPhone(phone)) return NextResponse.json({ error: 'Numer telefonu musi mieć 9 cyfr.' }, { status: 400 })

  const fullName = [firstName, lastName].filter(Boolean).join(' ')
  const { error } = await createAdminClient().from('profiles').update({ full_name: fullName, phone }).eq('id', user.id)
  if (error) {
    const taken = error.code === '23505'
    return NextResponse.json(
      { error: taken ? 'Ten numer jest już przypisany do innego konta.' : 'Nie udało się zapisać danych.' },
      { status: taken ? 409 : 503 },
    )
  }
  return NextResponse.json({ fullName, phone })
}

export async function DELETE(request: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'Zaloguj się ponownie.' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { confirm?: string } | null
  if (body?.confirm?.trim().toUpperCase() !== 'USUŃ') {
    return NextResponse.json({ error: 'Wpisz USUŃ, aby potwierdzić.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile && staffRoles.includes(profile.role)) {
    return NextResponse.json({ error: 'Konta pracowników usuwa administrator.' }, { status: 403 })
  }

  // Orders stay for accounting, but are detached from the deleted account (FK has no ON DELETE action).
  const detach = await Promise.all([
    admin.from('orders').update({ customer_id: null }).eq('customer_id', user.id),
    admin.from('marketing_events').update({ user_id: null }).eq('user_id', user.id),
    admin.from('order_documents').update({ created_by: null }).eq('created_by', user.id),
    admin.from('point_transactions').update({ created_by: null }).eq('created_by', user.id),
  ])
  const detachError = detach.find((result) => result.error)?.error
  if (detachError) {
    console.error('Account deletion: detach failed', detachError.message)
    return NextResponse.json({ error: 'Nie udało się usunąć konta. Spróbuj ponownie.' }, { status: 503 })
  }

  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    console.error('Account deletion failed', error.message)
    return NextResponse.json({ error: 'Nie udało się usunąć konta. Spróbuj ponownie.' }, { status: 503 })
  }

  const supabase = await createClient()
  await supabase.auth.signOut().catch(() => undefined)
  return NextResponse.json({ ok: true })
}
