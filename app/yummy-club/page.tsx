import type { Metadata } from 'next'
import { ClubPageHeader } from '@/components/club/club-page-header'
import { ClubHero } from '@/components/club/club-hero'
import { ClubBenefits } from '@/components/club/club-benefits'
import { ClubAuthPanel } from '@/components/club/club-auth-panel'
import { ClubMemberArea } from '@/components/club/club-member-area'
import { ClubPhoneGate } from '@/components/club/club-phone-gate'
import { ClubInstallBanner } from '@/components/club/club-install-banner'
import { createClient } from '@/lib/supabase/server'
import { getCachedPromotions } from '@/lib/public-cache'
import { getPublicInfo } from '@/lib/public-info'
import { ensureCustomerProfile } from '@/lib/customer-profile'
import { isFreeSpinAvailable, type PointTransaction } from '@/lib/loyalty'

export const metadata: Metadata = {
  title: 'Yummy Club – program lojalnościowy, kupony i punkty',
  description:
    'Yummy Club to darmowy program lojalnościowy Yummy Rybnik. Zamawiaj burgery online, zbieraj Stars, odbieraj nagrody i kupony rabatowe.',
  alternates: { canonical: '/yummy-club' },
  openGraph: { url: '/yummy-club', title: 'Yummy Club – Yummy Rybnik' },
  manifest: '/yummy-club/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Yummy Club', statusBarStyle: 'default' },
  icons: { apple: '/club-apple-icon.png' },
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
    // On mobile the page scrolls inside this box instead of the document, so the browser toolbar never
    // collapses/expands and the fixed bottom nav stays pinned (same approach as krainagrzybow.pl).
    <div id="club-scroll" className="min-h-svh overflow-x-clip bg-background max-lg:h-svh max-lg:overflow-x-hidden max-lg:overflow-y-auto">
      <ClubPageHeader isMember={Boolean(user && profile)} />
      <main className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6 lg:px-8 lg:pb-16">
        {!(user && profile?.phone) && <ClubInstallBanner />}
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
          <div className="grid grid-cols-1 gap-6 pt-2 lg:grid-cols-[minmax(0,1fr)_27rem] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-10 lg:pt-10">
            <ClubHero />
            <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <ClubAuthPanel
                initialNotice={error === 'auth' ? 'Link wygasł lub jest nieprawidłowy. Zaloguj się lub poproś o nowy.' : ''}
              />
            </div>
            <ClubBenefits rate={(await getPublicInfo()).loyalty.rate} />
          </div>
        )}
      </main>
    </div>
  )
}
