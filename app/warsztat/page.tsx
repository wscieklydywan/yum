import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WorkshopDashboard } from '@/components/warsztat/workshop-dashboard'
import { WorkshopSignIn, type UserRole } from '@/components/warsztat/workshop-access'

export const metadata: Metadata = {
  title: 'Warsztat – Yummy',
  description: 'Warsztat Yummy: obsługa zamówień, użytkowników i ról pracowników.',
  robots: { index: false, follow: false },
}

const staffRoles: UserRole[] = ['admin', 'szef', 'kuchnia', 'kelner', 'kierowca']

export default async function WorkshopPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <WorkshopSignIn />

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = (profile?.role ?? 'klient') as UserRole
  if (!staffRoles.includes(role)) redirect('/')

  return <WorkshopDashboard userRole={role} userEmail={user.email ?? ''} userId={user.id} />
}
