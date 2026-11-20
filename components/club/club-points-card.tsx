'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronRight, Crown, ShoppingBag, Star } from 'lucide-react'
import { getTier, type ClubTierName } from '@/lib/loyalty'
import { useClubTiers } from '@/lib/use-public-loyalty'
import { cn } from '@/lib/utils'
import { ClubTierDialog } from './club-tier-dialog'
import { ClubSectionHeader } from './club-section-header'

type TierName = ClubTierName

const tierStyles: Record<TierName, { pill: string; crown: string; bar: string }> = {
  Fan: {
    pill: 'bg-[#f6e4d6] text-[#7a3f1d] hover:bg-[#f0d6c2]',
    crown: 'text-[#b8682f]',
    bar: 'bg-gradient-to-r from-[#e0a06a] to-[#b8682f]',
  },
  'Srebrny Fan': {
    pill: 'bg-[#e8ecf0] text-[#3f4852] hover:bg-[#dde2e8]',
    crown: 'text-[#7d8894]',
    bar: 'bg-gradient-to-r from-[#c3cbd3] to-[#7d8894]',
  },
  'Złoty Fan': {
    pill: 'bg-[#fcefc8] text-[#7a5205] hover:bg-[#f8e5ad]',
    crown: 'text-[#d69a17]',
    bar: 'bg-gradient-to-r from-[#f8c94a] to-[#f2a522]',
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
    <section aria-label="Twoje konto Yummy Club" className="flex min-w-0 flex-col gap-5 sm:gap-6">
      <ClubSectionHeader eyebrow="Twój klub. Twoje korzyści." title={`Cześć, ${displayName}!`} description="Dobrze Cię widzieć. Na co dziś masz ochotę?" />

      <div className="relative isolate min-w-0">
        <div aria-hidden="true" className="pointer-events-none absolute -right-4 top-1/2 -z-10 aspect-square w-[46%] max-w-80 -translate-y-1/2 [mask-image:radial-gradient(closest-side,#000_62%,transparent)] sm:-right-6 lg:right-0">
          <Image
            src="/images/club-home-burger.webp"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 320px, 46vw"
            className="object-contain mix-blend-multiply"
          />
        </div>

        <div className="flex min-w-0 max-w-[68%] flex-col items-start sm:max-w-md">
          <p className="text-xs font-medium text-muted-foreground sm:text-sm">Masz na koncie:</p>
          <p className="mt-1.5 flex min-w-0 items-center gap-2 leading-none sm:gap-3">
            <Star className="size-7 shrink-0 fill-[#f5b936] text-[#f5b936] sm:size-9" aria-hidden="true" />
            <span className="text-[2.6rem] font-black tracking-tight tabular-nums sm:text-6xl">{points.toLocaleString('pl-PL')}</span>
            <span className="self-end pb-1 text-base font-extrabold sm:text-xl">Stars</span>
          </p>

          <div
            className="mt-4 h-2 w-full overflow-hidden rounded-full bg-foreground/10"
            role="progressbar"
            aria-label={tier.nextTier ? `Postęp do poziomu ${tier.nextTier.name}` : 'Najwyższy poziom osiągnięty'}
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className={cn('h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none', style.bar)} style={{ width: `${barWidth}%` }} />
          </div>
          <p className="mt-2.5 text-xs font-semibold leading-relaxed sm:text-sm">
            {tier.nextTier ? (
              <>
                Do poziomu {tier.nextTier.name}: <span className="font-extrabold tabular-nums">{tier.missing} Stars</span>
              </>
            ) : (
              'Masz najwyższy poziom'
            )}
          </p>

          <button
            type="button"
            onClick={() => setTiersOpen(true)}
            aria-haspopup="dialog"
            className={cn(
              'mt-3.5 flex items-center gap-1.5 rounded-full py-1.5 pl-3 pr-2 text-sm font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:py-2 sm:pl-3.5 sm:text-base',
              style.pill,
            )}
          >
            <Crown className={cn('size-4 fill-current sm:size-5', style.crown)} aria-hidden="true" />
            {tier.name}
            <ChevronRight className="size-4 opacity-60" aria-hidden="true" />
            <span className="sr-only">, zobacz poziomy i oszczędności</span>
          </button>
          <p className="mt-2 text-xs font-bold text-primary sm:text-sm">{perkLabel}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onOrder}
        className="flex min-h-13 w-full items-center justify-center gap-2.5 rounded-full bg-primary px-6 text-base font-extrabold text-primary-foreground shadow-[0_10px_24px_-12px_rgba(215,31,22,0.7)] transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.99] sm:min-h-14 sm:text-lg md:max-w-md"
      >
        <ShoppingBag className="size-5" aria-hidden="true" />
        Zamów teraz
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>

      <ClubTierDialog open={tiersOpen} onOpenChange={setTiersOpen} statusPoints={statusPoints} savings={savings} />
    </section>
  )
}
