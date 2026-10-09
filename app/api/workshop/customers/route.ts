import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { MAX_STAFF_POINTS } from '@/lib/loyalty'

const PAGE_SIZE = 20
const customerColumns = 'id, email, full_name, points, created_at'
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type StaffRole = 'admin' | 'szef' | 'kelner'

async function authorizeStaff(allowed: StaffRole[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { response: NextResponse.json({ error: 'Zaloguj się ponownie.' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!allowed.includes(profile?.role as StaffRole)) {
    return { response: NextResponse.json({ error: 'Brak uprawnień.' }, { status: 403 }) }
  }
  return { user, role: profile!.role as StaffRole }
}

function encodeCursor(row: { created_at: string; id: string }) {
  return Buffer.from(`${row.created_at}|${row.id}`).toString('base64url')
}

function decodeCursor(value: string | null) {
  if (!value) return null
  const [createdAt, id] = Buffer.from(value, 'base64url').toString().split('|')
  if (!createdAt || Number.isNaN(Date.parse(createdAt)) || !uuidPattern.test(id ?? '')) return null
  return { createdAt, id }
}

// GET ?email=  -> dokładne wyszukanie klienta (admin, kelner)
// GET ?list=1&q=&cursor= -> paginowana lista klientów (tylko admin)
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams

  if (params.get('list') === '1') {
    const auth = await authorizeStaff(['admin', 'szef'])
    if ('response' in auth) return auth.response

    const prefix = (params.get('q') ?? '').trim().toLowerCase().replace(/[^a-z0-9@._+-]/g, '').slice(0, 80)
    const cursor = decodeCursor(params.get('cursor'))

    let query = createAdminClient()
      .from('profiles')
      .select(customerColumns)
      .eq('role', 'klient')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE + 1)

    if (prefix.length >= 2) query = query.like('email_lower', `${prefix.replace(/[_%\\]/g, '\\$&')}%`)
    if (cursor) query = query.or(`created_at.lt."${cursor.createdAt}",and(created_at.eq."${cursor.createdAt}",id.lt.${cursor.id})`)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: 'Nie udało się pobrać listy klientów.' }, { status: 503 })

    const items = data.slice(0, PAGE_SIZE)
    const nextCursor = data.length > PAGE_SIZE ? encodeCursor(items[items.length - 1]) : null
    return NextResponse.json({ items, nextCursor }, { headers: { 'Cache-Control': 'private, max-age=15' } })
  }

  const auth = await authorizeStaff(['admin', 'szef', 'kelner'])
  if ('response' in auth) return auth.response

  const email = (params.get('email') ?? '').trim().toLowerCase()
  if (!emailPattern.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Podaj pełny, poprawny adres e-mail.' }, { status: 400 })
  }

  const { data, error } = await createAdminClient()
    .from('profiles')
    .select(customerColumns)
    .eq('email_lower', email)
    .eq('role', 'klient')
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'Nie udało się wyszukać klienta.' }, { status: 503 })
  return NextResponse.json({ customer: data })
}

export async function POST(request: Request) {
  const auth = await authorizeStaff(['admin', 'szef', 'kelner'])
  if ('response' in auth) return auth.response

  const body = (await request.json().catch(() => null)) as { userId?: string; amount?: number; note?: string } | null
  const amount = Number(body?.amount)
  if (!uuidPattern.test(body?.userId ?? '') || !Number.isInteger(amount) || amount < 1 || amount > MAX_STAFF_POINTS) {
    return NextResponse.json({ error: `Podaj liczbę punktów od 1 do ${MAX_STAFF_POINTS}.` }, { status: 400 })
  }

  const { data, error } = await createAdminClient().rpc('staff_add_points', {
    target: body!.userId,
    amount,
    actor: auth.user.id,
    note: typeof body?.note === 'string' ? body.note.slice(0, 120) : null,
  })
  if (error) {
    const notFound = error.message.includes('customer_not_found')
    return NextResponse.json(
      { error: notFound ? 'Nie znaleziono klienta.' : 'Nie udało się dodać punktów.' },
      { status: notFound ? 404 : 503 },
    )
  }
  return NextResponse.json({ points: data as number })
}
