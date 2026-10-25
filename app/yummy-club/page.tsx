import type { Metadata } from 'next'
import { ClubPageHeader } from '@/components/club/club-page-header'
import { ClubHero } from '@/components/club/club-hero'
import { ClubBenefits } from '@/components/club/club-benefits'
import { ClubAuthPanel } from '@/components/club/club-auth-panel'
import { ClubMemberArea } from '@/components/club/club-member-area'
import { ClubPhoneGate } from '@/components/club/club-phone-gate'
import { createClient } from '@/lib/supabase/server'
import { getCachedPromotions } from '@/lib/public-cache'
import { ensureCustomerProfile } from '@/lib/customer-profile'
import { isFreeSpinAvailable, type PointTransaction } from '@/lib/loyalty'

export const metadata: Metadata = {
  title: 'Yummy Club – program lojalnościowy, kupony i punkty',
  description:
    'Yummy Club to darmowy program lojalnościowy Yummy Rybnik. Zamawiaj burgery online, zbieraj Stars, odbieraj nagrody i kupony rabatowe.',
  alternates: { canonical: '/yummy-club' },
  openGraph: { url: '/yummy-club', title: 'Yummy Club – Yummy Rybnik' },
}

export default async function YummyClubPage({ searchParams }: { searchParams: Promise<{ error?: string; sledz?: string }> }) {
  const { error, sledz } = await searchParams
  const trackOrder = typeof sledz === 'string' && /^\d{1,10}$/.test(sledz) ? sledz : null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [profile, transactionsResult, promotions] = user
    ? await Promise.all([
        ensureCustomerProfile(user),
        supabase
          .from('point_transactions')
          .select('id, amount, kind, note, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        getCachedPromotions(),
      ])
    : [null, null, []]

  return (
    <div className="min-h-svh bg-background">
      <ClubPageHeader isMember={Boolean(user && profile)} />
      <main className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6 lg:px-8 lg:pb-16">
        {user && profile && !profile.phone ? (
          <ClubPhoneGate defaultName={profile.fullName ?? ''} />
        ) : user && profile ? (
          <ClubMemberArea
            email={user.email ?? ''}
            fullName={profile.fullName}
            phone={profile.phone}
            role={profile.role}
            initialPoints={profile.points}
            statusPoints={profile.statusPoints}
            savings={profile.savings}
            promotions={promotions.filter((promotion) => promotion.online || promotion.in_store)}
            freeSpinAvailable={isFreeSpinAvailable(profile.lastFreeSpinAt)}
            initialTransactions={(transactionsResult?.data ?? []) as PointTransaction[]}
            trackOrder={trackOrder}
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start lg:gap-12">
            <div className="flex flex-col gap-5 lg:gap-8 lg:pt-6">
              <ClubHero />
              <ClubBenefits />
            </div>
            <ClubAuthPanel
              initialNotice={error === 'auth' ? 'Link wygasł lub jest nieprawidłowy. Zaloguj się lub poproś o nowy.' : ''}
            />
          </div>
        )}
      </main>
    </div>
  )
}
