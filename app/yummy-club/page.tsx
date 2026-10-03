import type { Metadata } from 'next'
import { ClubPageHeader } from '@/components/club/club-page-header'
import { ClubHero } from '@/components/club/club-hero'
import { ClubBenefits } from '@/components/club/club-benefits'
import { ClubAuthPanel } from '@/components/club/club-auth-panel'

export const metadata: Metadata = {
  title: 'Yummy Club – zbieraj punkty i odbieraj nagrody | Yummy',
  description:
    'Dołącz do Yummy Club, zbieraj punkty za każde zamówienie i odbieraj darmowe jedzenie oraz wyjątkowe oferty.',
}

export default function YummyClubPage() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <ClubPageHeader />
      <main className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6 lg:px-8 lg:pb-16">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start lg:gap-12">
          <div className="flex flex-col gap-5 lg:gap-8 lg:pt-6">
            <ClubHero />
            <ClubBenefits />
          </div>
          <ClubAuthPanel />
        </div>
      </main>
    </div>
  )
}
