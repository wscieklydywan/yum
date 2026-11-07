'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronRight, Crown, ShoppingBag, Star } from 'lucide-react'
import { getTier, type ClubTierName } from '@/lib/loyalty'
import { useClubTiers } from '@/lib/use-public-loyalty'
import { cn } from '@/lib/utils'
import { ClubTierDialog } from './club-tier-dialog'

type TierName = ClubTierName

const tierStyles: Record<TierName, { pill: string; crown: string; bar: string }> = {
  Fan: {
    pill: 'bg-[#f6e4d6] text-[#7a3f1d] hover:bg-[#f0d6c2]',
    crown: 'text-[#b8682f]',
    bar: 'bg-gradient-to-r from-[#d08a52] to-[#8f4a22]',
  },
  'Srebrny Fan': {
    pill: 'bg-[#e8ecf0] text-[#3f4852] hover:bg-[#dde2e8]',
    crown: 'text-[#7d8894]',
    bar: 'bg-gradient-to-r from-[#aab4bf] to-[#5d6672]',
  },
  'Złoty Fan': {
    pill: 'bg-[#fcefc8] text-[#7a5205] hover:bg-[#f8e5ad]',
    crown: 'text-[#d69a17]',
    bar: 'bg-gradient-to-r from-[#f5c242] to-[#c48a12]',
  },
}

export function ClubHomeHero({
  displayName,
  points,
  statusPoints,
  savings,
  onOrder,
}: {
  displayName: string
  points: number
  statusPoints: number
  savings: number
  onOrder: () => void
}) {
  const [tiersOpen, setTiersOpen] = useState(false)
  const [filled, setFilled] = useState(false)
  const tiers = useClubTiers()
  const tier = getTier(statusPoints, tiers)
  const style = tierStyles[tier.name]

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setFilled(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const progress = tier.next ? Math.min(100, Math.max(0, ((statusPoints - tier.min) / (tier.next - tier.min)) * 100)) : 100
  const barWidth = filled ? (progress > 0 ? Math.max(progress, 4) : 0) : 0
  const firstPerk = tiers.find((item) => item.percent > 0)
  const perkLabel = tier.percent > 0 ? `-${tier.percent}% na zamówienia` : `-${firstPerk?.percent ?? 5}% od ${firstPerk?.min ?? 100} Stars`

  return (
    <section aria-label="Twoje konto Yummy Club" className="relative isolate">
      <div aria-hidden="true" className="pointer-events-none absolute -right-8 top-6 -z-10 aspect-square w-[64%] max-w-80 sm:-right-6">
        <Image
          src="/images/club-home-burger.webp"
          alt=""
          fill
          priority
          sizes="320px"
          className="object-cover object-[65%_50%] mix-blend-multiply [mask-image:radial-gradient(circle_at_58%_50%,black_50%,transparent_72%)]"
        />
      </div>

      <div className="max-w-[60%] pt-1">
        <h1 className="text-balance text-[26px] font-black leading-tight tracking-tight sm:text-4xl">
          Cześć, <span className="break-words">{displayName}!</span>
        </h1>

        <p className="mt-4 text-xs font-semibold text-muted-foreground">Masz na koncie:</p>
        <p className="mt-1 flex items-center gap-2 leading-none">
          <Star className="size-8 shrink-0 fill-[#f6b21b] text-[#f6b21b] sm:size-9" aria-hidden="true" />
          <span className="text-[44px] font-black tracking-tight tabular-nums sm:text-5xl">{points.toLocaleString('pl-PL')}</span>
          <span className="mt-2 text-xl font-extrabold sm:text-2xl">Stars</span>
        </p>

        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-foreground/[0.08]"
          role="progressbar"
          aria-label={tier.nextTier ? `Postęp do poziomu ${tier.nextTier.name}` : 'Najwyższy poziom osiągnięty'}
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-gradient-to-r from-[#fbc94a] to-[#f6a21b] transition-[width] duration-700 ease-out" style={{ width: `${barWidth}%` }} />
        </div>
        <p className="mt-2 text-xs leading-snug text-muted-foreground">
          {tier.nextTier ? (
            <>
              Do poziomu {tier.nextTier.name}: <b className="font-extrabold text-foreground tabular-nums">{tier.missing} Stars</b>
            </>
          ) : (
            <b className="font-bold text-foreground">Masz najwyższy poziom</b>
          )}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTiersOpen(true)}
            aria-haspopup="dialog"
            className={cn(
              'flex items-center gap-1.5 rounded-full py-1.5 pl-3 pr-2 text-sm font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              style.pill,
            )}
          >
            <Crown className={cn('size-4 fill-current', style.crown)} aria-hidden="true" />
            {tier.name}
            <ChevronRight className="size-4 opacity-60" aria-hidden="true" />
            <span className="sr-only">, zobacz poziomy i oszczędności</span>
          </button>
          <span className="text-[11px] font-bold text-primary">{perkLabel}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onOrder}
        className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-extrabold text-primary-foreground shadow-[0_10px_24px_-10px_rgba(200,30,20,0.6)] transition-transform hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <ShoppingBag className="size-5" aria-hidden="true" />
        Zamów teraz
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>

      <ClubTierDialog open={tiersOpen} onOpenChange={setTiersOpen} statusPoints={statusPoints} savings={savings} />
    </section>
  )
}
