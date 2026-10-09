import type { Metadata } from 'next'
import { ClubPageHeader } from '@/components/club/club-page-header'
import { ClubHero } from '@/components/club/club-hero'
import { ClubBenefits } from '@/components/club/club-benefits'
import { ClubAuthPanel } from '@/components/club/club-auth-panel'
import { ClubMemberArea } from '@/components/club/club-member-area'
import { createClient } from '@/lib/supabase/server'
import { ensureCustomerProfile } from '@/lib/customer-profile'
import { isFreeSpinAvailable, type PointTransaction } from '@/lib/loyalty'

export const metadata: Metadata = {
  title: 'Yummy Club – zbieraj punkty i odbieraj nagrody | Yummy',
  description:
    'Dołącz do Yummy Club, zbieraj punkty za każde zamówienie, kręć kołem fortuny i odbieraj darmowe jedzenie oraz wyjątkowe oferty.',
}

export default async function YummyClubPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [profile, transactionsResult] = user
    ? await Promise.all([
        ensureCustomerProfile(user),
        supabase
          .from('point_transactions')
          .select('id, amount, kind, note, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ])
    : [null, null]

  return (
    <div className="min-h-[100dvh] bg-background">
      <ClubPageHeader />
      <main className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6 lg:px-8 lg:pb-16">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start lg:gap-12">
          {user && profile ? (
            <ClubMemberArea
              email={user.email ?? ''}
              fullName={profile.fullName}
              role={profile.role}
              initialPoints={profile.points}
              freeSpinAvailable={isFreeSpinAvailable(profile.lastFreeSpinAt)}
              initialTransactions={(transactionsResult?.data ?? []) as PointTransaction[]}
            />
          ) : (
            <>
              <div className="flex flex-col gap-5 lg:gap-8 lg:pt-6">
                <ClubHero />
                <ClubBenefits />
              </div>
              <ClubAuthPanel
                initialNotice={error === 'auth' ? 'Link wygasł lub jest nieprawidłowy. Zaloguj się lub poproś o nowy.' : ''}
              />
            </>
          )}
        </div>
      </main>
    </div>
  )
}
