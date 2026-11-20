import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { getTier } from '@/lib/loyalty'
import { loadTiers } from '@/lib/club-tiers-server'

export type CartPerks = {
  signedIn: boolean
  tier: { name: string; percent: number } | null
  previousOrders: number | null
  /** Staff accounts never get the status discount, so the cart explains why it is missing. */
  staff?: boolean
  /** Lowest paid tier, used to tease the discount to guests and members below it. */
  /** `missing` is set only for signed-in members who haven't reached it yet. */
  firstPaidTier?: { name: string; percent: number; min: number; missing?: number } | null
}

export async function GET() {
  const supabase = await createClient()
  const admin = createAdminClient()
  const [{ data: { user } }, tiers] = await Promise.all([supabase.auth.getUser(), loadTiers(admin)])
  const firstPaid = tiers.find((tier) => tier.percent > 0) ?? null
  const body: CartPerks = {
    signedIn: Boolean(user),
    tier: null,
    previousOrders: null,
    staff: false,
    firstPaidTier: firstPaid ? { name: firstPaid.name, percent: firstPaid.percent, min: firstPaid.min } : null,
  }
  if (user) {
    const [{ data: member }, previous] = await Promise.all([
      admin.from('profiles').select('role, status_points').eq('id', user.id).maybeSingle(),
      admin.rpc('count_previous_site_orders', { p_customer: user.id, p_phone: null }).then(({ data, error }) => (error ? null : Number(data))),
    ])
    if (member?.role === 'klient') {
      const tier = getTier(member.status_points ?? 0, tiers)
      const points = member.status_points ?? 0
      if (tier.percent > 0) body.tier = { name: tier.name, percent: tier.percent }
      else if (body.firstPaidTier) body.firstPaidTier.missing = Math.max(0, body.firstPaidTier.min - points)
    } else if (member?.role) {
      body.staff = true
    }
    body.previousOrders = previous
  }
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
