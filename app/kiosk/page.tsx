import type { Metadata, Viewport } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WorkshopSignIn } from '@/components/warsztat/workshop-access'
import { KioskApp } from '@/components/kiosk/kiosk-app'
import { KIOSK_ROLES } from '@/lib/kiosk'

export const metadata: Metadata = {
  title: 'Kiosk – Yummy',
  description: 'Samoobsługowy kiosk zamówień Yummy.',
  robots: { index: false, follow: false, nocache: true },
}

export const viewport: Viewport = { themeColor: '#d71f16', userScalable: false, maximumScale: 1 }

export default async function KioskPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <WorkshopSignIn redirectTo="/kiosk" />

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!(KIOSK_ROLES as readonly string[]).includes(profile?.role ?? '')) redirect('/')

  return <KioskApp />
}
