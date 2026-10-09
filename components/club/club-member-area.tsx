'use client'

import { useCallback, useState } from 'react'
import { ClubWheelDialog, type SpinResult } from './club-spin-wheel'
import { ClubWheelBanner } from './club-wheel-banner'
import { ClubRewards, type RedeemResult } from './club-rewards'
import { ClubBottomNav } from './club-bottom-nav'
import { ClubActiveCoupons } from './club-active-coupons'
import { ClubPromoCode, type PromoRedeemResult } from './club-promo-code'
import { ClubAccountActions, ClubActivity, ClubGreeting, ClubPointsCard, ClubQuickLinks } from './club-member-sections'
import { EXTRA_SPIN_COST, type PointTransaction } from '@/lib/loyalty'

export function ClubMemberArea({
  email,
  fullName,
  role,
  initialPoints,
  freeSpinAvailable: initialFreeSpin,
  initialTransactions,
}: {
  email: string
  fullName: string | null
  role: string
  initialPoints: number
  freeSpinAvailable: boolean
  initialTransactions: PointTransaction[]
}) {
  const [points, setPoints] = useState(initialPoints)
  const [freeSpinAvailable, setFreeSpinAvailable] = useState(initialFreeSpin)
  const [transactions, setTransactions] = useState(initialTransactions)
  const [wheelOpen, setWheelOpen] = useState(false)
  const displayName = fullName || email.split('@')[0]
  const enableFreeSpin = useCallback(() => setFreeSpinAvailable(true), [])

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
        : [{ id: Date.now() - 1, amount: -EXTRA_SPIN_COST, kind: 'spin_cost' as const, note: 'Dodatkowe zakręcenie', created_at: now }]),
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
      <div className="flex flex-col gap-4 sm:gap-5 lg:pt-6">
        <ClubGreeting displayName={displayName} />
        <ClubPointsCard points={points} />
        <ClubQuickLinks />
        <ClubWheelBanner freeSpinAvailable={freeSpinAvailable} onOpen={() => setWheelOpen(true)} />
      </div>
      <div className="flex flex-col gap-5 pb-16 sm:gap-6 lg:pb-0 lg:pt-6">
        <ClubRewards points={points} onRedeemed={handleRedeem} />
        <ClubPromoCode onRedeemed={handlePromo} />
        <ClubActiveCoupons />
        <ClubActivity transactions={transactions} />
        <ClubAccountActions email={email} role={role} />
      </div>
      <ClubWheelDialog
        open={wheelOpen}
        onOpenChange={setWheelOpen}
        points={points}
        freeSpinAvailable={freeSpinAvailable}
        onFreeSpinReady={enableFreeSpin}
        onSpinComplete={handleSpin}
      />
      <ClubBottomNav />
    </>
  )
}
