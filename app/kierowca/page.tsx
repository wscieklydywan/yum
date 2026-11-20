import type { Metadata, Viewport } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WorkshopSignIn } from '@/components/warsztat/workshop-access'
import { WorkshopInstallGuard } from '@/components/warsztat/workshop-pwa-controls'
import { DriverBoard } from '@/components/kierowca/driver-board'

export const metadata: Metadata = {
  title: 'Kierowca – Yummy',
  description: 'Dowozy Yummy: zamówienia gotowe do wyjazdu i w trasie.',
  robots: { index: false, follow: false, nocache: true },
  manifest: '/kierowca/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Kierowca', statusBarStyle: 'default' },
}

export const viewport: Viewport = { themeColor: '#f6f3ef', width: 'device-width', initialScale: 1 }

const driverRoles = ['admin', 'szef', 'kelner', 'kierowca']

export default async function DriverPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <><WorkshopInstallGuard /><WorkshopSignIn redirectTo="/kierowca" /></>

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = profile?.role ?? 'klient'
  if (!driverRoles.includes(role)) redirect('/')

  return <DriverBoard userId={user.id} userEmail={user.email ?? ''} role={role} />
}
