import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'

export type CustomerProfile = { fullName: string | null; role: string; points: number; lastFreeSpinAt: string | null }

export async function ensureCustomerProfile(user: User): Promise<CustomerProfile> {
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('profiles')
    .select('full_name, role, points, last_free_spin_at')
    .eq('id', user.id)
    .maybeSingle()

  if (existing) {
    return { fullName: existing.full_name, role: existing.role, points: existing.points ?? 0, lastFreeSpinAt: existing.last_free_spin_at }
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

  return { fullName, role: 'klient', points: 0, lastFreeSpinAt: null }
}
