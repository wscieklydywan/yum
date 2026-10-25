import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { normalizeWorkshopCode, previewWorkshopCode, WorkshopCodeError } from '@/lib/workshop-codes'

const ALLOWED_ROLES = ['admin', 'szef', 'kuchnia', 'kelner']

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Zaloguj się ponownie.' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!ALLOWED_ROLES.includes(profile?.role ?? '')) return NextResponse.json({ error: 'Brak uprawnień do realizacji kodów.' }, { status: 403 })

  const code = normalizeWorkshopCode(new URL(request.url).searchParams.get('code'))
  if (code.length < 3) return NextResponse.json({ error: 'Wpisz kod.' }, { status: 400 })
  try {
    return NextResponse.json(await previewWorkshopCode(createAdminClient(), code))
  } catch (error) {
    if (error instanceof WorkshopCodeError) return NextResponse.json({ error: error.message }, { status: 404 })
    return NextResponse.json({ error: 'Nie udało się sprawdzić kodu.' }, { status: 503 })
  }
}
