'use client'

import { useCallback, useState } from 'react'
import { CartSheet } from '@/components/cart/cart-sheet'
import { ProductDialog } from '@/components/yummy/product-dialog'
import { ClubWheelDialog, type SpinResult } from './club-spin-wheel'
import { ClubRewards, type RedeemResult } from './club-rewards'
import { ClubBottomNav, type ClubTab } from './club-bottom-nav'
import { ClubInstallBanner } from './club-install-banner'
import { ClubActiveCoupons } from './club-active-coupons'
import { ClubPromoCode, type PromoRedeemResult } from './club-promo-code'
import { ClubOrderHistory } from './club-order-history'
import { ClubOrderTracking } from './club-order-tracking'
import { ClubOrderMenu } from './club-order-menu'
import { ClubOffers } from './club-perks'
import { ClubAccountActions, ClubActivity, ClubGroup, ClubProfileShortcuts } from './club-member-sections'
import { ClubHomeHero } from './club-points-card'
import { ClubQuickActions } from './club-quick-actions'
import { ClubAccountSettings, DeleteAccount, type AccountDetails } from './club-account-settings'

const staffRoles = ['admin', 'szef', 'kuchnia', 'kelner', 'kierowca']
import { getTier, type PointTransaction } from '@/lib/loyalty'
import { useWheelConfig } from '@/lib/use-wheel-config'
import { useClubTiers } from '@/lib/use-public-loyalty'
import type { Promotion } from '@/lib/promotions'
import type { GameFinishResult } from '@/lib/halloween'
import { HalloweenSection, HalloweenTeaser } from './halloween/halloween-section'
import { AdventCalendarBanner } from '@/components/yummy/advent-calendar'

export function ClubMemberArea({
  email,
  fullName,
  phone,
  role,
  initialPoints,
  statusPoints,
  savings,
  promotions,
  freeSpinAvailable: initialFreeSpin,
  initialTransactions,
  trackOrder = null,
}: {
  trackOrder?: string | null
  email: string
  fullName: string | null
  phone: string | null
  role: string
  initialPoints: number
  statusPoints: number
  savings: number
  promotions: Promotion[]
  freeSpinAvailable: boolean
  initialTransactions: PointTransaction[]
}) {
  const { extraSpinCost } = useWheelConfig()
  const clubTiers = useClubTiers()
  const [points, setPoints] = useState(initialPoints)
  const [freeSpinAvailable, setFreeSpinAvailable] = useState(initialFreeSpin)
  const [transactions, setTransactions] = useState(initialTransactions)
  const [wheelOpen, setWheelOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<ClubTab>('home')
  const [lastTrackOrder, setLastTrackOrder] = useState(trackOrder)
  if (trackOrder !== lastTrackOrder) {
    setLastTrackOrder(trackOrder)
    if (trackOrder) setActiveTab('home')
  }
  const [details, setDetails] = useState<AccountDetails>({ fullName, phone, email })
  const displayName = details.fullName?.split(/\s+/)[0] || email.split('@')[0]
  const enableFreeSpin = useCallback(() => setFreeSpinAvailable(true), [])
  const openWheel = () => setWheelOpen(true)
  const showTab = (tab: ClubTab) => {
    setActiveTab(tab)
    // Instant jump: smooth-scrolling while the tab content swaps underneath makes the page jump and stutter.
    document.getElementById('club-scroll')?.scrollTo({ top: 0, behavior: 'instant' })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  const showCoupons = () => showTab('coupons')

  function handleGame(result: GameFinishResult) {
    setPoints(result.points)
    if (result.stars > 0) {
      addTransactions([{ id: Date.now(), amount: result.stars, kind: 'game', note: `Dyniowe Łowy · ${result.score} pkt`, created_at: new Date().toISOString() }])
    }
  }

  function addTransactions(items: PointTransaction[]) {
    setTransactions((current) => [...items, ...current].slice(0, 5))
  }

  function handleSpin(result: SpinResult) {
    setPoints(result.points)
    setFreeSpinAvailable(false)
    const now = new Date().toISOString()
    addTransactions([
      ...(result.prize > 0 ? [{ id: Date.now(), amount: result.prize, kind: 'spin' as const, note: `Koło fortuny · ${result.label}`, created_at: now }] : []),
      ...(result.free
        ? []
        : [{ id: Date.now() - 1, amount: -extraSpinCost, kind: 'spin_cost' as const, note: 'Dodatkowe zakręcenie', created_at: now }]),
    ])
  }

  function handleRedeem(result: RedeemResult) {
    setPoints(result.points)
    addTransactions([{ id: Date.now(), amount: -result.cost, kind: 'redeem', note: result.reward, created_at: new Date().toISOString() }])
  }

  function handlePromo(result: PromoRedeemResult, promoCode: string) {
    setPoints(result.totalPoints)
    if (result.type === 'points') {
      addTransactions([{ id: Date.now(), amount: result.points, kind: 'promo', note: `Kod ${promoCode}`, created_at: new Date().toISOString() }])
    }
  }

  return (
    <>
      <div className="mx-auto flex min-w-0 max-w-7xl flex-col gap-3.5 pb-[calc(4.75rem+env(safe-area-inset-bottom))] sm:gap-4">
        {activeTab === 'home' && (
          <div className="grid min-w-0 grid-cols-1 gap-9 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start lg:gap-10">
            <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24">
              <ClubHomeHero
                displayName={displayName}
                points={points}
                statusPoints={statusPoints}
                savings={savings}
                onOrder={() => showTab('menu')}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-9 sm:gap-10">
              <ClubOrderTracking highlight={trackOrder} />
              <ClubQuickActions
                freeSpinAvailable={freeSpinAvailable}
                onSpin={openWheel}
                onRewards={() => document.getElementById('nagrody')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                onCoupons={showCoupons}
              />
              <ClubGroup id="club-seasonal" title="Na czasie" description="Akcje sezonowe i gry">
                <div className="flex min-w-0 flex-col gap-3">
                  <AdventCalendarBanner onPointsChange={setPoints} />
                  <HalloweenTeaser onOpen={() => showTab('game')} />
                </div>
              </ClubGroup>
              <ClubRewards points={points} onRedeemed={handleRedeem} />
              <ClubOffers promotions={promotions} onShowCoupons={showCoupons} />
            </div>
          </div>
        )}
        {activeTab === 'menu' && <ClubOrderMenu />}
        {activeTab === 'coupons' && (
          <ClubActiveCoupons promotions={promotions} tierPercent={getTier(statusPoints, clubTiers).percent}>
            <ClubPromoCode onRedeemed={handlePromo} />
          </ClubActiveCoupons>
        )}
        {activeTab === 'game' && <HalloweenSection onPointsChange={handleGame} />}
        {activeTab === 'profile' && (
          <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-5">
            <header>
              <h1 className="text-xl font-black tracking-tight sm:text-2xl">Profil</h1>
              <p className="text-xs text-muted-foreground sm:text-sm">Twoje dane, historia zamówień i ustawienia konta</p>
            </header>
            <ClubProfileShortcuts role={role} />
            <div className="flex min-w-0 flex-col gap-2.5">
              <ClubOrderHistory onStartOrdering={() => showTab('menu')} />
              <ClubActivity transactions={transactions} />
            </div>
            <ClubAccountSettings details={details} onDetailsChange={setDetails} />
            <ClubAccountActions email={email}>
              <DeleteAccount isStaff={staffRoles.includes(role)} />
            </ClubAccountActions>
          </div>
        )}
      </div>
      <ProductDialog />
      <CartSheet />
      <ClubWheelDialog
        open={wheelOpen}
        onOpenChange={setWheelOpen}
        points={points}
        freeSpinAvailable={freeSpinAvailable}
        onFreeSpinReady={enableFreeSpin}
        onSpinComplete={handleSpin}
      />
      <ClubInstallBanner floating />
      <ClubBottomNav activeTab={activeTab} onNavigate={showTab} />
    </>
  )
}
