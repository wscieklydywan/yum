import type { Metadata } from 'next'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WorkshopDashboard } from '@/components/warsztat/workshop-dashboard'
import { WorkshopSignIn, type UserRole } from '@/components/warsztat/workshop-access'
import { WorkshopInstallGuard } from '@/components/warsztat/workshop-pwa-controls'

/** Per-request: metadata and the page share one verified getUser() instead of asking Supabase Auth twice. */
const getVerifiedUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export async function generateMetadata(): Promise<Metadata> {
  const user = await getVerifiedUser()
  const base: Metadata = { robots: { index: false, follow: false, nocache: true }, manifest: '/warsztat/manifest.webmanifest' }
  if (!user) return { ...base, title: { absolute: '\u200b' }, description: null }
  return { ...base, title: 'Warsztat – Yummy', description: 'Warsztat Yummy: obsługa zamówień, użytkowników i ról pracowników.' }
}

const staffRoles: UserRole[] = ['admin', 'szef', 'kuchnia', 'kelner', 'kierowca']

export default async function WorkshopPage() {
  const user = await getVerifiedUser()
  if (!user) return <><WorkshopInstallGuard /><WorkshopSignIn /></>

  const supabase = await createClient()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = (profile?.role ?? 'klient') as UserRole
  if (!staffRoles.includes(role)) redirect('/')

  return <WorkshopDashboard userRole={role} userEmail={user.email ?? ''} userId={user.id} />
}
