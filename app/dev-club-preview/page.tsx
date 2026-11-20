import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ClubPageHeader } from '@/components/club/club-page-header'
import { ClubMemberArea } from '@/components/club/club-member-area'
import { ClubHeroSlider } from '@/components/yummy/hero'
import { getCachedPromotions } from '@/lib/public-cache'
import { MockSwr } from './mock-swr'

export const metadata: Metadata = {
  title: 'Podgląd testowy Yummy Club',
  robots: { index: false, follow: false },
}

export default async function DevClubPreview() {
  if (process.env.NODE_ENV !== 'development') notFound()
  const promotions = await getCachedPromotions()
  return (
    <div id="club-scroll" className="club-member-page relative isolate min-h-svh overflow-x-clip bg-background">
      <p className="bg-ink px-4 py-2 text-center text-[11px] text-ink-foreground">Podgląd UI · przykładowe konto · bez logowania</p>
      <ClubPageHeader isMember />
      <main className="mx-auto w-full max-w-[1440px] px-4 pb-0 pt-5 sm:px-6 sm:pt-7 lg:px-8 lg:pb-16 lg:pt-10">
        <MockSwr>
          <ClubMemberArea
            email="test@example.com"
            fullName="Ania Test"
            phone="500600700"
            role="customer"
            initialPoints={180}
            statusPoints={260}
            savings={12}
            promotions={promotions.filter((promotion) => promotion.online || promotion.in_store)}
            freeSpinAvailable
            initialTransactions={[]}
            slider={<ClubHeroSlider />}
          />
        </MockSwr>
      </main>
    </div>
  )
}
