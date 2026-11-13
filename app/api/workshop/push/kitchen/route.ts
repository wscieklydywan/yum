import { after, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles } from '@/lib/workshop-auth'
import { kitchenOrderPush, sendStationPush } from '@/lib/push'

/** Called by the bar right after accepting an order; the server re-checks the order before pinging the kitchen. */
export async function POST(request: Request) {
  const auth = await authorizeRoles(['admin', 'szef', 'kelner'])
  if ('response' in auth) return auth.response
  const body = (await request.json().catch(() => null)) as { orderId?: string } | null
  if (!body?.orderId || typeof body.orderId !== 'string') return NextResponse.json({ error: 'Brak zamówienia.' }, { status: 400 })

  const { data: order } = await createAdminClient().from('orders').select('number, type, status, items').eq('id', body.orderId).maybeSingle()
  const items = (order?.items ?? []) as { station?: string }[]
  const hasKitchenWork = items.some((item) => (item.station ?? 'kitchen') === 'kitchen')
  if (order && order.status === 'preparing' && hasKitchenWork) {
    after(() => sendStationPush('kitchen', kitchenOrderPush(order.number, order.type)))
  }
  return NextResponse.json({ ok: true })
}
