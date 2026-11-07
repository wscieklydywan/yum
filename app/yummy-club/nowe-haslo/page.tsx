import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ClubPageHeader } from '@/components/club/club-page-header'
import { ClubNewPasswordForm } from '@/components/club/club-new-password-form'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Ustaw nowe hasło | Yummy Club',
  robots: { index: false, follow: false },
}

export default async function NewPasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/yummy-club?error=auth')
  const { data: profile } = await supabase.from('profiles').select('phone, full_name').eq('id', user.id).maybeSingle()
  const needsProfile = !profile?.phone

  return (
    <div className="min-h-svh bg-background">
      <ClubPageHeader />
      <main className="mx-auto w-full max-w-md px-4 pb-10 pt-4 sm:pt-10">
        <ClubNewPasswordForm needsProfile={needsProfile} defaultName={profile?.full_name ?? ''} />
      </main>
    </div>
  )
}
