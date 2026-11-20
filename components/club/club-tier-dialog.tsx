'use client'

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { ArrowLeft, Check, Crown, Lock, Percent, PiggyBank, Sparkles } from 'lucide-react'
import { getTier, type ClubTier, type ClubTierName } from '@/lib/loyalty'
import { describeStarRate } from '@/lib/loyalty-rate'
import { useClubTiers, usePublicLoyalty } from '@/lib/use-public-loyalty'
import { cn } from '@/lib/utils'
import { useBackButtonClose } from '@/lib/use-back-button-close'

type TierName = ClubTierName

const tierThemes: Record<TierName, { accent: string; chip: string; ring: string; bar: string; glow: string; line: string }> = {
  Fan: {
    accent: 'text-[#f4c39a]',
    chip: 'bg-[#d98a52]/18',
    ring: 'ring-[#d98a52]/60',
    bar: 'from-[#a85a2c] via-[#d98a52] to-[#f4c39a]',
    glow: 'rgba(217,138,82,0.38)',
    line: 'from-[#d98a52] to-[#c4cbd3]',
  },
  'Srebrny Fan': {
    accent: 'text-[#e3e8ee]',
    chip: 'bg-white/12',
    ring: 'ring-[#c4cbd3]/60',
    bar: 'from-[#7f8995] via-[#c4cbd3] to-[#f3f5f7]',
    glow: 'rgba(196,203,211,0.32)',
    line: 'from-[#c4cbd3] to-[#f5b936]',
  },
  'Złoty Fan': {
    accent: 'text-[#ffd76e]',
    chip: 'bg-[#f5b936]/18',
    ring: 'ring-[#f5b936]/70',
    bar: 'from-[#e8952c] via-[#f8c64a] to-[#ffe7a0]',
    glow: 'rgba(245,185,54,0.38)',
    line: 'from-[#f5b936] to-[#f5b936]',
  },
}

const moneyFormat = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })

function tierBenefits(tier: ClubTier, list: ClubTier[]) {
  const index = list.findIndex((item) => item.name === tier.name)
  const base = index === 0
    ? ['Stars za każde zamówienie', 'Darmowe zakręcenie kołem każdego dnia', 'Wymiana Stars na jedzenie', 'Kody i promocje w Yummy QPON']
    : [`Wszystko z poziomu ${list[index - 1].name}`, ...(tier.percent > 0 ? [`Stały rabat -${tier.percent}% na każde zamówienie`] : [])]
  return [...base, ...tier.perks]
}

export function ClubTierDialog({
  open,
  onOpenChange,
  statusPoints,
  savings,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  statusPoints: number
  savings?: number
}) {
  const tiers = useClubTiers()
  const current = getTier(statusPoints, tiers)
  const loyalty = usePublicLoyalty()
  const theme = tierThemes[current.name]
  const progress = current.next ? Math.min(100, Math.max(0, ((statusPoints - current.min) / (current.next - current.min)) * 100)) : 100
  useBackButtonClose(open, onOpenChange)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-[#17110d] transition-opacity sm:bg-black/60 sm:backdrop-blur-sm duration-300 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <DialogPrimitive.Popup className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#17110d] text-white outline-none transition-[opacity,translate,scale] duration-300 ease-out will-change-[opacity,translate] data-[ending-style]:translate-y-8 data-[ending-style]:opacity-0 data-[starting-style]:translate-y-8 data-[starting-style]:opacity-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-[min(90svh,52rem)] sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:shadow-2xl sm:data-[ending-style]:-translate-y-[46%] sm:data-[starting-style]:-translate-y-[46%]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-96"
            style={{ background: `radial-gradient(80% 100% at 50% 0%, ${theme.glow}, transparent 70%)` }}
          />

          <div className="relative z-10 flex shrink-0 items-center gap-2 px-3 pb-1 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <DialogPrimitive.Close
              aria-label="Wróć"
              className="grid size-9 place-items-center rounded-full bg-white/8 sm:size-10 ring-1 ring-inset ring-white/12 transition-colors hover:bg-white/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <ArrowLeft className="size-4 sm:size-5" aria-hidden="true" />
            </DialogPrimitive.Close>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">Yummy Club</span>
          </div>

          <div className="relative z-10 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <header className="flex flex-col items-center pt-2 text-center sm:pt-4">
              <span className={cn('grid size-14 place-items-center rounded-full ring-2 sm:size-20', theme.chip, theme.ring)}>
                <Crown className={cn('size-7 fill-current sm:size-10', theme.accent)} aria-hidden="true" />
              </span>
              <p className="mt-3 text-[11px] font-semibold uppercase sm:mt-4 tracking-[0.14em] text-white/55">Twój poziom</p>
              <DialogPrimitive.Title className={cn('mt-1 text-2xl font-black sm:text-3xl tracking-tight text-balance', theme.accent)}>
                {current.name}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-2 max-w-xs text-xs leading-relaxed sm:text-sm text-white/65 text-pretty">
                Twój poziom Yummy Club zależy wyłącznie od Stars zdobytych za zamówienia i nie spada, nawet gdy wymieniasz Stars na nagrody. Stars otrzymane za wydarzenia, gry, koło fortuny, kody promocyjne lub od obsługi możesz wykorzystać na nagrody, ale nie wpływają one na Twój poziom klubowy.
              </DialogPrimitive.Description>

              <div className="mt-4 w-full rounded-2xl bg-white/6 p-3 sm:mt-6 sm:p-4 ring-1 ring-inset ring-white/10">
                <div className="flex items-baseline justify-between gap-2 text-left">
                  <span className="text-xs text-white/70 sm:text-sm">
                    {current.nextTier ? (
                      <>
                        Jeszcze <b className="font-extrabold text-white tabular-nums">{current.missing}</b> Stars do{' '}
                        <b className={cn('font-bold', tierThemes[current.nextTier.name].accent)}>{current.nextTier.name}</b>
                      </>
                    ) : (
                      'Masz najwyższy poziom – gratulacje!'
                    )}
                  </span>
                  <span className="shrink-0 text-xs font-bold tabular-nums sm:text-sm">
                    {statusPoints}
                    {current.next ? <span className="text-white/50"> / {current.next}</span> : null}
                  </span>
                </div>
                <div
                  className="mt-2.5 h-2 w-full sm:mt-3 sm:h-2.5 overflow-hidden rounded-full bg-white/12"
                  role="progressbar"
                  aria-label={current.nextTier ? `Postęp do poziomu ${current.nextTier.name}` : 'Najwyższy poziom osiągnięty'}
                  aria-valuenow={Math.round(progress)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className={cn('h-full rounded-full bg-gradient-to-r', theme.bar)} style={{ width: `${progress > 0 ? Math.max(progress, 3) : 0}%` }} />
                </div>
              </div>

              {savings !== undefined ? (
                <div className="mt-2 grid w-full grid-cols-2 gap-2">
                  <div className="flex items-center gap-2.5 rounded-2xl bg-white/6 p-3 text-left ring-1 ring-inset ring-white/10">
                    <PiggyBank className={cn('size-5 shrink-0', theme.accent)} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-white/55">Zaoszczędzono</p>
                      <p className="text-sm font-extrabold tabular-nums">{moneyFormat.format(savings)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-2xl bg-white/6 p-3 text-left ring-1 ring-inset ring-white/10">
                    <Percent className={cn('size-5 shrink-0', theme.accent)} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-white/55">Twój rabat</p>
                      <p className="text-sm font-extrabold">{current.percent > 0 ? `-${current.percent}% stale` : `Od ${tiers[1].min} Stars`}</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </header>

            <h3 className="mt-6 text-[11px] font-semibold sm:mt-8 uppercase tracking-[0.14em] text-white/55">Wszystkie poziomy</h3>
            <ol className="mt-3 flex flex-col sm:mt-4">
              {tiers.map((tier, index) => {
                const isCurrent = tier.name === current.name
                const reached = statusPoints >= tier.min
                const tierTheme = tierThemes[tier.name]
                const isLast = index === tiers.length - 1
                return (
                  <li key={tier.name} className="flex gap-3 sm:gap-4">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          'grid size-9 shrink-0 place-items-center rounded-full ring-1 sm:size-11',
                          reached ? cn(tierTheme.chip, tierTheme.ring) : 'bg-white/5 ring-white/12',
                        )}
                      >
                        {reached ? (
                          <Crown className={cn('size-4 fill-current sm:size-5', tierTheme.accent)} aria-hidden="true" />
                        ) : (
                          <Lock className="size-3.5 text-white/45 sm:size-4" aria-hidden="true" />
                        )}
                      </span>
                      {!isLast ? (
                        <span
                          aria-hidden="true"
                          className={cn(
                            'my-1.5 w-0.5 flex-1 rounded-full',
                            statusPoints >= tiers[index + 1].min ? cn('bg-gradient-to-b', tierTheme.line) : 'bg-white/12',
                          )}
                        />
                      ) : null}
                    </div>

                    <div
                      className={cn(
                        'mb-3 min-w-0 flex-1 rounded-2xl p-3 ring-1 ring-inset sm:mb-5 sm:p-4',
                        isCurrent ? cn('bg-white/8', tierTheme.ring) : 'bg-white/[0.03] ring-white/8',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn('text-sm font-extrabold sm:text-base', reached ? tierTheme.accent : 'text-white/80')}>{tier.name}</span>
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                            <Sparkles className="size-3" aria-hidden="true" />
                            Jesteś tu
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-white/50 sm:text-xs">{tier.min === 0 ? 'Na start' : `od ${tier.min} Stars`}</span>
                        )}
                      </div>

                      {tier.percent > 0 ? (
                        <p className="mt-2 flex items-baseline gap-1.5">
                          <span className={cn('text-2xl font-black tracking-tight sm:text-3xl', reached ? tierTheme.accent : 'text-white')}>-{tier.percent}%</span>
                          <span className="text-xs font-semibold text-white/70 sm:text-sm">na każde zamówienie</span>
                        </p>
                      ) : null}

                      <ul className="mt-2 flex flex-col gap-1.5 sm:mt-3 sm:gap-2">
                        {tierBenefits(tier, tiers).map((benefit) => (
                          <li key={benefit} className="flex items-start gap-2 text-xs leading-snug text-white/85 sm:text-sm">
                            <Check className={cn('size-3.5 shrink-0 sm:mt-0.5 sm:size-4', reached ? 'text-emerald-400' : 'text-white/35')} aria-hidden="true" />
                            {benefit}
                          </li>
                        ))}
                      </ul>

                      {!reached ? (
                        <p className="mt-2 border-t border-white/8 pt-2 text-[11px] sm:mt-3 sm:pt-3 sm:text-xs font-semibold text-white/55">
                          Brakuje Ci <b className="text-white tabular-nums">{tier.min - statusPoints}</b> Stars
                        </p>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ol>

            <p className="mt-1 rounded-2xl bg-white/5 px-3 py-2.5 text-center text-[11px] sm:mt-2 sm:px-4 sm:py-3 sm:text-xs leading-relaxed text-white/60">
              {loyalty ? `${describeStarRate(loyalty.rate)}. ` : ''}Rabat nalicza się sam – online i w lokalu.
            </p>
            <p className="mt-2 px-1 text-[11px] leading-relaxed text-white/50 sm:text-xs">
              Twój poziom zależy wyłącznie od Stars zdobytych za zamówienia i nie spada, nawet gdy wymieniasz Stars na nagrody. Stars z wydarzeń, gier, koła fortuny, kodów promocyjnych lub od obsługi możesz wykorzystać na nagrody, ale nie wpływają na Twój poziom.
            </p>
            <section aria-labelledby="tier-discount-rules" className="mt-3 rounded-2xl bg-white/[0.03] px-3 py-3 ring-1 ring-inset ring-white/8 sm:px-4">
              <h3 id="tier-discount-rules" className="text-xs font-bold text-white/80 sm:text-sm">Zasady naliczania rabatu lojalnościowego</h3>
              <ul className="mt-2 flex flex-col gap-1.5 text-[11px] leading-relaxed text-white/55 sm:text-xs">
                <li>Rabat lojalnościowy naliczany jest wyłącznie od produktów oferowanych w cenach regularnych.</li>
                <li>Produkty promocyjne, przecenione oraz objęte innymi rabatami nie podlegają dodatkowemu rabatowi lojalnościowemu.</li>
                <li>Pozycje gratisowe, bezpłatne zestawy oraz produkty otrzymane w ramach kuponów i innych akcji promocyjnych nie wykluczają możliwości skorzystania z rabatu lojalnościowego na pozostałe produkty w cenach regularnych.</li>
              </ul>
            </section>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
