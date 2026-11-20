'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { CartSheet } from '@/components/cart/cart-sheet'
import { ProductDialog } from '@/components/yummy/product-dialog'
import { ClubWheelDialog, type SpinResult } from './club-spin-wheel'
import { ClubRewards, type RedeemResult } from './club-rewards'
import { ClubBottomNav, ClubDesktopNav, type ClubTab } from './club-bottom-nav'
import { ClubInstallBanner } from './club-install-banner'
import { ClubActiveCoupons, type CouponsTab } from './club-active-coupons'
import { ClubHighlights } from './club-highlights'
import type { ClubFeedId } from '@/lib/home-slides'
import type { ClubTilesConfig } from '@/lib/club-tiles'
import { ClubPromoCode, type PromoRedeemResult } from './club-promo-code'
import { ClubOrderHistory } from './club-order-history'
import { ClubOrderTracking } from './club-order-tracking'
import { ClubOrderMenu } from './club-order-menu'
import { ClubOffers } from './club-perks'
import { ClubAccountActions, ClubActivity, ClubGroup } from './club-member-sections'
import { ClubProfileOverview } from './club-profile-overview'
import { ClubHomeHero } from './club-points-card'
import { ClubQuickActions } from './club-quick-actions'
import { ClubAccountSettings, DeleteAccount, type AccountDetails } from './club-account-settings'

const staffRoles = ['admin', 'szef', 'kuchnia', 'kelner', 'kierowca']
import { getTier, type PointTransaction } from '@/lib/loyalty'
import { useWheelConfig } from '@/lib/use-wheel-config'
import { useClubTiers } from '@/lib/use-public-loyalty'
import type { Promotion } from '@/lib/promotions'
import type { GameFinishResult } from '@/lib/halloween'
import { ClubGames } from './club-games'
import { ClubSectionHeader } from './club-section-header'

export function ClubMemberArea({
  email,
  fullName,
  phone,
  address = null,
  role,
  initialPoints,
  statusPoints,
  savings,
  promotions,
  freeSpinAvailable: initialFreeSpin,
  initialTransactions,
  trackOrder = null,
  slider = null,
  feedHidden = [],
  clubTiles,
}: {
  trackOrder?: string | null
  slider?: ReactNode
  feedHidden?: ClubFeedId[]
  clubTiles?: ClubTilesConfig
  email: string
  fullName: string | null
  phone: string | null
  address?: string | null
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
  const [couponsTab, setCouponsTab] = useState<CouponsTab>('rewards')
  const [lastTrackOrder, setLastTrackOrder] = useState(trackOrder)
  if (trackOrder !== lastTrackOrder) {
    setLastTrackOrder(trackOrder)
    if (trackOrder) setActiveTab('home')
  }
  const [details, setDetails] = useState<AccountDetails>({ fullName, phone, email, address })
  const displayName = details.fullName?.split(/\s+/)[0] || email.split('@')[0]
  const enableFreeSpin = useCallback(() => setFreeSpinAvailable(true), [])
  const openWheel = () => setWheelOpen(true)
  const showTab = (tab: ClubTab) => {
    setActiveTab(tab)
    // Instant jump: smooth-scrolling while the tab content swaps underneath makes the page jump and stutter.
    window.scrollTo({ top: 0, behavior: 'instant' })
    // Firefox (mobile) scrolls inside #club-scroll so its toolbar stays put – see globals.css.
    document.getElementById('club-scroll')?.scrollTo({ top: 0, behavior: 'instant' })
    window.requestAnimationFrame(() => document.getElementById('club-tab-content')?.focus({ preventScroll: true }))
  }
  const showCoupons = (tab: CouponsTab) => {
    setCouponsTab(tab)
    showTab('coupons')
  }

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
      <div className="grid min-w-0 gap-8 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-8 lg:pb-8 xl:gap-10">
        <ClubDesktopNav activeTab={activeTab} onNavigate={showTab} displayName={displayName} points={points} />
        <div id="club-tab-content" tabIndex={-1} className="min-w-0 outline-none">
        {activeTab === 'home' && (
          <div className="flex min-w-0 flex-col gap-7 sm:gap-8">
            <div className="min-w-0">
              <ClubHomeHero
                displayName={displayName}
                points={points}
                statusPoints={statusPoints}
                savings={savings}
                onOrder={() => showTab('menu')}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-7 sm:gap-8">
              <ClubOrderTracking highlight={trackOrder} />
              <ClubQuickActions
                freeSpinAvailable={freeSpinAvailable}
                onSpin={openWheel}
                onRewards={() => showCoupons('rewards')}
                onCoupons={() => showCoupons('mine')}
              />
              <ClubHighlights
                slider={slider}
                hidden={feedHidden}
                tiles={clubTiles}
                freeSpinAvailable={freeSpinAvailable}
                onSpin={openWheel}
                onOpenGame={() => showTab('game')}
                onPointsChange={setPoints}
              />
              <ClubOffers promotions={promotions} onShowPromotions={() => showCoupons('public')} onShowMine={() => showCoupons('mine')} />
              <ClubRewards points={points} onRedeemed={handleRedeem} variant="preview" onShowAll={() => showCoupons('rewards')} />
            </div>
          </div>
        )}
        {activeTab === 'menu' && <ClubOrderMenu />}
        {activeTab === 'coupons' && (
          <ClubActiveCoupons
            promotions={promotions}
            tierPercent={getTier(statusPoints, clubTiers).percent}
            points={points}
            tab={couponsTab}
            onTabChange={setCouponsTab}
            rewards={<ClubRewards points={points} onRedeemed={handleRedeem} />}
          >
            <ClubPromoCode onRedeemed={handlePromo} />
          </ClubActiveCoupons>
        )}
        {activeTab === 'game' && (
          <ClubGames freeSpinAvailable={freeSpinAvailable} onSpin={openWheel} onFreeSpinReady={enableFreeSpin} onGameFinished={handleGame} />
        )}
        {activeTab === 'profile' && (
          <div className="flex w-full min-w-0 flex-col gap-6 sm:gap-8">
            <ClubSectionHeader eyebrow="Po Twojemu" title="Mój profil" description="Twoje dane, zamówienia i zebrane Stars. Wszystko w jednym miejscu." />
            <ClubProfileOverview
              displayName={displayName}
              fullName={details.fullName}
              email={details.email}
              role={role}
              points={points}
              tierName={getTier(statusPoints, clubTiers).name}
              savings={savings}
              onOrder={() => showTab('menu')}
            />
            <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
              <ClubAccountSettings details={details} onDetailsChange={setDetails} />
              <div className="flex min-w-0 flex-col gap-3">
                <ClubGroup id="aktywnosc-sekcja" title="Twoja aktywność" description="Zamówienia i historia Twoich Stars">
                  <div className="flex min-w-0 flex-col divide-y divide-border/70 overflow-hidden rounded-3xl border border-border/70 bg-card">
                    <ClubOrderHistory flat onStartOrdering={() => showTab('menu')} />
                    <ClubActivity flat transactions={transactions} />
                  </div>
                </ClubGroup>
                <ClubAccountActions email={email}>
                  <DeleteAccount isStaff={staffRoles.includes(role)} />
                </ClubAccountActions>
              </div>
            </div>
          </div>
        )}
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-5 text-[11px] text-muted-foreground">
          <span className="font-semibold">Yummy Club</span><span>Good burgers. Better days.</span>
        </footer>
        </div>
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
