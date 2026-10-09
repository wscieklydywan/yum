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

  return (
    <div className="min-h-[100dvh] bg-background">
      <ClubPageHeader />
      <main className="mx-auto w-full max-w-md px-4 pb-10 pt-4 sm:pt-10">
        <ClubNewPasswordForm />
      </main>
    </div>
  )
}
