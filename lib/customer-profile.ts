import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'

export type CustomerProfile = {
  fullName: string | null
  phone: string | null
  role: string
  points: number
  statusPoints: number
  savings: number
  lastFreeSpinAt: string | null
}

async function loadSavings(userId: string) {
  const { data, error } = await createAdminClient()
    .from('orders')
    .select('club_savings')
    .eq('customer_id', userId)
    .neq('status', 'cancelled')
    .gt('club_savings', 0)
  if (error || !data) return 0
  return Math.round(data.reduce((sum, row) => sum + Number(row.club_savings ?? 0), 0) * 100) / 100
}

export async function ensureCustomerProfile(user: User): Promise<CustomerProfile> {
  const admin = createAdminClient()
  const [{ data: existing }, savings] = await Promise.all([
    admin
      .from('profiles')
      .select('email, full_name, phone, role, points, status_points, last_free_spin_at')
      .eq('id', user.id)
      .maybeSingle(),
    loadSavings(user.id),
  ])

  if (existing) {
    if (user.email && existing.email !== user.email) {
      const { error } = await admin.from('profiles').update({ email: user.email }).eq('id', user.id)
      if (error) console.error('Failed to sync profile email', error.message)
    }
    return {
      fullName: existing.full_name,
      phone: existing.phone,
      role: existing.role,
      points: existing.points ?? 0,
      statusPoints: existing.status_points ?? 0,
      savings,
      lastFreeSpinAt: existing.last_free_spin_at,
    }
  }

  const metadataName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim().slice(0, 80) : ''
  const fullName = metadataName || null

  const { error } = await admin
    .from('profiles')
    .upsert(
      { id: user.id, email: user.email ?? '', full_name: fullName, role: 'klient' },
      { onConflict: 'id', ignoreDuplicates: true },
    )
  if (error) console.error('Failed to create customer profile', error.message)

  return { fullName, phone: null, role: 'klient', points: 0, statusPoints: 0, savings: 0, lastFreeSpinAt: null }
}
