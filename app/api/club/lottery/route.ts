import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { LOTTERY_END, LOTTERY_START, countSets, isLotteryOpen, type LotteryStatus } from '@/lib/vice-lottery'

const NO_STORE = { 'Cache-Control': 'no-store' }

async function statusFor(userId: string | null): Promise<LotteryStatus> {
  const open = isLotteryOpen()
  if (!userId) return { signedIn: false, joined: false, tickets: 0, open }
  const admin = createAdminClient()
  const [{ data: entry }, { data: orders }] = await Promise.all([
    admin.from('vice_lottery_entries').select('user_id').eq('user_id', userId).maybeSingle(),
    admin
      .from('orders')
      .select('items')
      .eq('customer_id', userId)
      .eq('status', 'handed_off')
      .gte('created_at', LOTTERY_START)
      .lte('created_at', LOTTERY_END),
  ])
  const tickets = (orders ?? []).reduce((sum, order) => sum + countSets(order.items), 0)
  return { signedIn: true, joined: Boolean(entry), tickets, open }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return NextResponse.json(await statusFor(user?.id ?? null), { headers: NO_STORE })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Zaloguj się do Yummy Club, aby wziąć udział.' }, { status: 401, headers: NO_STORE })
  if (!isLotteryOpen()) return NextResponse.json({ error: 'Zgłoszenia są już zamknięte.' }, { status: 400, headers: NO_STORE })

  const body = (await request.json().catch(() => null)) as { acceptTerms?: unknown } | null
  if (body?.acceptTerms !== true) return NextResponse.json({ error: 'Zaakceptuj regulamin losowania.' }, { status: 400, headers: NO_STORE })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role && profile.role !== 'klient') {
    return NextResponse.json({ error: 'Konta pracowników nie biorą udziału w losowaniu.' }, { status: 403, headers: NO_STORE })
  }

  const { error } = await admin.from('vice_lottery_entries').upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true })
  if (error) return NextResponse.json({ error: 'Nie udało się zapisać zgłoszenia.' }, { status: 500, headers: NO_STORE })
  return NextResponse.json(await statusFor(user.id), { headers: NO_STORE })
}
