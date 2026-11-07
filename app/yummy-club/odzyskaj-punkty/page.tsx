import type { Metadata } from 'next'
import { ClubPageHeader } from '@/components/club/club-page-header'
import { RecoveryHero } from '@/components/club/recovery/recovery-hero'
import { RecoverySteps, type RecoveryStage } from '@/components/club/recovery/recovery-steps'
import { RecoveryAction } from '@/components/club/recovery/recovery-action'
import { RecoveryFaq } from '@/components/club/recovery/recovery-faq'
import { createClient } from '@/lib/supabase/server'
import { ensureCustomerProfile } from '@/lib/customer-profile'

export const metadata: Metadata = {
  title: 'Przenieś punkty ze starej aplikacji | Yummy Club',
  description:
    'Masz punkty w starej aplikacji Yummy? Załóż konto w nowym Yummy Club, kliknij „Odzyskaj punkty” i odbierz je na nowym koncie.',
  alternates: { canonical: '/yummy-club/odzyskaj-punkty' },
  openGraph: {
    url: '/yummy-club/odzyskaj-punkty',
    title: 'Twoje punkty czekają – przenieś je do nowego Yummy Club',
    images: ['/images/club-points-move.png'],
  },
}

const RETURN_PATH = '/yummy-club/odzyskaj-punkty'

export default async function PointsRecoveryLandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user ? await ensureCustomerProfile(user) : null

  const stage: RecoveryStage = !user || !profile ? 'account' : !profile.phone ? 'phone' : 'recover'
  const firstName = profile?.fullName?.trim().split(/\s+/)[0] ?? ''

  return (
    <div className="min-h-svh overflow-x-clip bg-background">
      <ClubPageHeader />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 pt-2 lg:grid-cols-[minmax(0,1fr)_27rem] lg:gap-x-16 lg:pt-10">
          <div className="flex flex-col gap-8">
            <RecoveryHero firstName={firstName} />
            <RecoverySteps stage={stage} />
          </div>
          <div className="lg:sticky lg:top-24 lg:self-start" id="dzialaj">
            <RecoveryAction stage={stage} phone={profile?.phone ?? null} returnPath={RETURN_PATH} />
          </div>
        </div>
        <RecoveryFaq />
      </main>
    </div>
  )
}
