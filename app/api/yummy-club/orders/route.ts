import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  // getClaims verifies the ES256 JWT locally (cached JWKS) — no Supabase Auth round trip on every poll.
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub : null
  if (!userId) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
  }

  const { data, error } = await createAdminClient()
    .from('orders')
    .select('number, status, type, items, subtotal, discount, delivery_fee, total, loyalty_points, club_savings, payment_method, preferred_payment, paid_at, note, scheduled_for, created_at, ready_at, handed_off_at')
    .eq('customer_id', userId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    return NextResponse.json({ error: 'history_unavailable' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } })
  }

  const orders = (data ?? []).map((order) => ({
    number: order.number,
    status: order.status,
    type: order.type,
    subtotal: Number(order.subtotal ?? 0),
    discount: Number(order.discount ?? 0),
    delivery_fee: Number(order.delivery_fee ?? 0),
    total: Number(order.total ?? 0),
    club_savings: Number(order.club_savings ?? 0),
    loyalty_points: typeof order.loyalty_points === 'number' ? order.loyalty_points : null,
    payment_method: typeof order.payment_method === 'string' && order.paid_at ? order.payment_method.slice(0, 40) : null,
    preferred_payment: order.preferred_payment === 'cash' || order.preferred_payment === 'card' ? order.preferred_payment : null,
    note: typeof order.note === 'string' && order.note.trim() ? order.note.slice(0, 300) : null,
    scheduled_for: typeof order.scheduled_for === 'string' ? order.scheduled_for : null,
    created_at: order.created_at,
    ready_at: typeof order.ready_at === 'string' ? order.ready_at : null,
    handed_off_at: typeof order.handed_off_at === 'string' ? order.handed_off_at : null,
    items: Array.isArray(order.items)
      ? order.items.flatMap((item) => {
          if (!item || typeof item !== 'object') return []
          const line = item as { name?: unknown; quantity?: unknown; options?: unknown; unitPrice?: unknown }
          if (typeof line.name !== 'string') return []
          return [{
            name: line.name.slice(0, 120),
            quantity: Number.isInteger(line.quantity) ? Number(line.quantity) : 1,
            unitPrice: typeof line.unitPrice === 'number' && Number.isFinite(line.unitPrice) ? line.unitPrice : null,
            ...(typeof line.options === 'string' ? { options: line.options.slice(0, 160) } : {}),
          }]
        })
      : [],
  }))

  return NextResponse.json({ orders }, { headers: { 'Cache-Control': 'private, no-store' } })
}
