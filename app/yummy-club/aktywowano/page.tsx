import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ClubPageHeader } from '@/components/club/club-page-header'
import { ClubActivatedCard } from '@/components/club/club-activated-card'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Konto aktywowane | Yummy Club',
  robots: { index: false, follow: false },
}

export default async function AccountActivatedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/yummy-club?error=auth')

  const fullName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : ''
  const firstName = fullName.trim().split(/\s+/)[0] ?? ''

  return (
    <div className="min-h-[100dvh] bg-background">
      <ClubPageHeader />
      <main className="mx-auto w-full max-w-md px-4 pb-10 pt-4 sm:pt-10">
        <ClubActivatedCard firstName={firstName} email={user.email ?? ''} />
      </main>
    </div>
  )
}
