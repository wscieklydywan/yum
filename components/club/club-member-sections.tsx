'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Image from 'next/image'
import {
  ChefHat,
  ChevronRight,
  Clock,
  Crown,
  Disc3,
  Gift,
  LoaderCircle,
  LogOut,
  Percent,
  PiggyBank,
  ShoppingBag,
  Star,
  Tag,
  UserRound,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getTier, POINT_KIND_LABELS, tiers, type PointTransaction } from '@/lib/loyalty'
import { cn } from '@/lib/utils'
import { useWheelPrizes } from '@/lib/use-wheel-prizes'
import { rewardSummary, wheelIcon } from '@/lib/wheel'
import { ClubTierDialog } from './club-tier-dialog'

const staffRoles = ['admin', 'szef', 'kuchnia', 'kelner', 'kierowca']

const kindLabels = POINT_KIND_LABELS

export const cardClass = 'rounded-2xl bg-card shadow-[0_8px_30px_rgba(80,30,10,0.06)] ring-1 ring-border/60 sm:rounded-3xl'

function initials(name: string) {
  return name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function ClubSectionTitle({ id, title, description, aside }: { id: string; title: string; description?: string; aside?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="truncate text-lg font-extrabold leading-tight tracking-tight sm:text-xl">{title}</h2>
        {description ? <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">{description}</p> : null}
      </div>
      {aside ? <span className="flex shrink-0 items-center gap-1 pb-0.5 text-xs font-semibold text-muted-foreground">{aside}</span> : null}
    </div>
  )
}

export function ClubGroup({ id, title, description, aside, children, className }: {
  id: string
  title: string
  description?: string
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn('flex min-w-0 scroll-mt-20 flex-col gap-3', className)}>
      <ClubSectionTitle id={`${id}-title`} title={title} description={description} aside={aside} />
      {children}
    </section>
  )
}

export function ClubCollapsible({ id, icon: Icon, title, description, aside, children }: {
  id: string
  icon: typeof Star
  title: string
  description?: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <details id={id} className={cn('group scroll-mt-20 overflow-hidden', cardClass)}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 sm:px-4 [&::-webkit-details-marker]:hidden">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold sm:text-base">{title}</span>
          {description ? <span className="block truncate text-xs text-muted-foreground">{description}</span> : null}
        </span>
        {aside ? <span className="shrink-0 text-xs font-semibold text-muted-foreground">{aside}</span> : null}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
      </summary>
      <div className="border-t border-border/70 bg-background/40 p-3 sm:p-4">{children}</div>
    </details>
  )
}

export function ClubGreeting({ displayName }: { displayName: string }) {
  return (
    <header className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-black text-primary sm:size-12 sm:text-base">
        {initials(displayName) || <UserRound className="size-5" aria-hidden="true" />}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">Miło Cię znowu widzieć</p>
        <h1 className="truncate text-xl font-black leading-tight tracking-tight sm:text-2xl">Cześć, {displayName}!</h1>
      </div>
    </header>
  )
}

const moneyFormat = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })

const tierThemes: Record<(typeof tiers)[number]['name'], { bar: string; accent: string; chip: string; glow: string }> = {
  Fan: { bar: 'from-[#a85a2c] via-[#d98a52] to-[#f4c39a]', accent: 'text-[#f4c39a]', chip: 'bg-[#d98a52]/18', glow: 'rgba(217,138,82,0.34)' },
  'Srebrny Fan': { bar: 'from-[#7f8995] via-[#c4cbd3] to-[#f3f5f7]', accent: 'text-[#e3e8ee]', chip: 'bg-white/12', glow: 'rgba(196,203,211,0.3)' },
  'Złoty Fan': { bar: 'from-[#e8952c] via-[#f8c64a] to-[#ffe7a0]', accent: 'text-[#ffd76e]', chip: 'bg-[#f5b936]/18', glow: 'rgba(245,185,54,0.34)' },
}

export function ClubPointsCard({ points, statusPoints, savings }: { points: number; statusPoints: number; savings: number }) {
  const [tiersOpen, setTiersOpen] = useState(false)
  const [filled, setFilled] = useState(false)
  const tier = getTier(statusPoints)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setFilled(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const theme = tierThemes[tier.name]
  const exactProgress = tier.next ? Math.min(100, Math.max(0, ((statusPoints - tier.min) / (tier.next - tier.min)) * 100)) : 100
  const barWidth = filled ? (exactProgress > 0 ? Math.max(exactProgress, 2) : 0) : 0
  const firstPerk = tiers.find((item) => item.percent > 0)

  return (
    <section
      aria-label="Twój poziom Yummy Club"
      className="relative isolate -mx-4 min-w-0 overflow-hidden bg-[#17110d] text-white sm:mx-0 sm:rounded-2xl sm:shadow-[0_10px_28px_rgba(40,22,8,0.16)]"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0" style={{ background: `radial-gradient(90% 130% at 100% 0%, ${theme.glow}, transparent 62%)` }} />
      <div className="relative z-10 flex flex-col gap-3 px-4 pb-3.5 pt-3.5 sm:px-5 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">Twoje Stars</p>
            <p className="mt-1 flex items-baseline gap-1.5 leading-none">
              <span className="text-[28px] font-black tracking-tight tabular-nums">{points.toLocaleString('pl-PL')}</span>
              <span className={cn('text-xs font-bold', theme.accent)}>do wydania</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTiersOpen(true)}
            aria-haspopup="dialog"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/8 py-1 pl-1 pr-2 ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <span className={cn('grid size-7 shrink-0 place-items-center rounded-full', theme.chip)}>
              <Crown className={cn('size-3.5 fill-current', theme.accent)} aria-hidden="true" />
            </span>
            <span className={cn('text-xs font-extrabold', theme.accent)}>{tier.name}</span>
            <ChevronRight className="size-3.5 text-white/50" aria-hidden="true" />
            <span className="sr-only">– zobacz poziomy Yummy Club</span>
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2 text-[11px] leading-tight text-white/70">
            <span className="min-w-0 truncate">
              {tier.nextTier ? (
                <>Jeszcze <b className="font-extrabold text-white tabular-nums">{tier.missing}</b> Stars z zakupów do <b className={cn('font-bold', tierThemes[tier.nextTier.name].accent)}>{tier.nextTier.name}</b></>
              ) : (
                'Masz najwyższy poziom – gratulacje!'
              )}
            </span>
            <span className="shrink-0 font-bold tabular-nums text-white/85">{statusPoints}{tier.next ? ` / ${tier.next}` : ''}</span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-white/12"
            role="progressbar"
            aria-label={tier.nextTier ? `Postęp do poziomu ${tier.nextTier.name}` : 'Najwyższy poziom osiągnięty'}
            aria-valuenow={Math.round(exactProgress)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className={cn('h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out', theme.bar)} style={{ width: `${barWidth}%` }} />
          </div>
          <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wide text-white/45">
            <span>{tier.name}</span>
            <span>{tier.nextTier ? `${tier.nextTier.name} · -${tier.nextTier.percent}%` : `-${tier.percent}% na zamówienia`}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 border-t border-white/10 pt-3">
          <span className={cn('grid size-8 shrink-0 place-items-center rounded-full', theme.chip)}>
            <Percent className={cn('size-4', theme.accent)} aria-hidden="true" />
          </span>
          <p className="min-w-0 flex-1 text-xs leading-snug">
            {tier.percent > 0 ? (
              <>
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/55">Twoja aktywna korzyść</span>
                <b className="font-extrabold">-{tier.percent}% na każde zamówienie</b>
              </>
            ) : (
              <>
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/55">Do odblokowania</span>
                <b className="font-extrabold">-{firstPerk?.percent ?? 5}% na zamówienia</b>
                <span className="text-white/65"> od {firstPerk?.min ?? 100} Stars</span>
              </>
            )}
          </p>
          <span className="flex shrink-0 flex-col items-end text-right leading-tight">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/55">Oszczędziłeś</span>
            <span className="flex items-center gap-1 text-xs font-extrabold tabular-nums">
              <PiggyBank className={cn('size-3.5', theme.accent)} aria-hidden="true" />{moneyFormat.format(savings)}
            </span>
          </span>
        </div>
      </div>
      <ClubTierDialog open={tiersOpen} onOpenChange={setTiersOpen} statusPoints={statusPoints} />
    </section>
  )
}

export function ClubRewardsBanner() {
  return (
    <a
      href="#nagrody"
      className="relative flex min-w-0 items-center gap-3 overflow-hidden rounded-3xl bg-gradient-to-r from-[#fff4f2] via-[#ffe9e8] to-[#ffdfe0] p-3 pr-3 ring-1 ring-primary/15 transition-shadow hover:shadow-md sm:gap-4 sm:p-4"
    >
      <span className="relative size-14 shrink-0 sm:size-20">
        <Image src="/images/club/gift.webp" alt="" fill sizes="80px" className="object-contain mix-blend-multiply" />
      </span>
      <span className="min-w-0 flex-1 text-sm font-bold leading-snug text-balance sm:text-lg">Odbieraj nagrody za swoje Stars</span>
      <span className="flex h-10 shrink-0 items-center gap-1 rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-[0_8px_18px_rgba(226,38,28,0.3)] sm:h-12 sm:px-5 sm:text-sm">
        Zobacz
        <span className="hidden sm:inline">nagrody</span>
        <ChevronRight className="size-4" aria-hidden="true" />
      </span>
    </a>
  )
}

const quickLinks = [
  { label: 'Zbieraj punkty', href: '/#menu', icon: Crown },
  { label: 'Darmowe jedzenie', href: '#nagrody', icon: Gift },
  { label: 'Oferty dla Ciebie', href: '/#promocje', icon: Percent },
  { label: 'Specjalne wydarzenia', href: '/#promocje', icon: Star },
]

export function ClubQuickLinks() {
  return (
    <nav aria-label="Skróty Yummy Club">
      <ul className="grid grid-cols-4 gap-2 sm:gap-3">
        {quickLinks.map(({ label, href, icon: Icon }) => (
          <li key={label}>
            <a
              href={href}
              className={`flex h-full flex-col items-center gap-1.5 px-1 py-2.5 text-center transition-colors hover:bg-muted sm:gap-2 sm:py-4 ${cardClass}`}
            >
              <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary sm:size-11">
                <Icon className="size-[18px] sm:size-5" strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="text-[10.5px] font-medium leading-tight text-balance sm:text-sm">{label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function ClubPrizeList() {
  const { data: prizes } = useWheelPrizes()
  return (
    <section aria-labelledby="club-prizes-title">
      <h3 id="club-prizes-title" className="text-base font-bold sm:text-lg">Możliwe nagrody</h3>
      <ul className="mt-2.5 grid gap-2">
        {prizes.map((prize) => {
          const Icon = wheelIcon(prize.icon)
          return (
            <li key={prize.id} className={`flex items-center gap-3 p-2 pr-3.5 ${cardClass}`}>
              <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-primary sm:size-12">
                {prize.visual === 'image' && prize.image ? (
                  <Image src={prize.image} alt="" fill sizes="48px" className="object-cover" />
                ) : (
                  <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{prize.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{prize.description}</span>
              </span>
              <span className="max-w-[45%] shrink-0 truncate text-sm font-bold tabular-nums text-primary">{rewardSummary(prize)}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function secondsToWarsawMidnight() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  return 86400 - (get('hour') * 3600 + get('minute') * 60 + get('second'))
}

function formatCountdown(total: number) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}

export function ClubFreeSpinCountdown({ onReady }: { onReady: () => void }) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    const tick = () => {
      const seconds = secondsToWarsawMidnight()
      setRemaining(seconds)
      if (seconds <= 1) onReady()
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [onReady])

  return (
    <div className={`flex items-center gap-3.5 px-4 py-3 ${cardClass}`}>
      <Clock className="size-6 shrink-0" aria-hidden="true" />
      <div>
        <p className="text-xs text-muted-foreground sm:text-sm">Darmowe zakręcenie dostępne za:</p>
        <p className="text-xl font-extrabold tabular-nums" aria-live="off">
          {remaining === null ? '--:--:--' : formatCountdown(remaining)}
        </p>
      </div>
    </div>
  )
}

function activityIcon(kind: PointTransaction['kind']) {
  if (kind === 'staff') return ShoppingBag
  if (kind === 'redeem') return Gift
  return Disc3
}

export function ClubActivity({ transactions }: { transactions: PointTransaction[] }) {
  return (
    <ClubCollapsible id="aktywnosc" icon={Star} title="Historia Stars" description="Zdobyte i wydane punkty" aside={transactions.length || undefined}>
      {transactions.length === 0 ? (
        <p className="p-1 text-sm leading-relaxed text-muted-foreground">
          Nie masz jeszcze punktów. Zakręć kołem albo poproś obsługę o dopisanie punktów za zamówienie.
        </p>
      ) : (
        <ul className={`flex flex-col divide-y divide-border overflow-hidden ${cardClass}`}>
          {transactions.map((item) => {
            const Icon = activityIcon(item.kind)
            const title = (item.kind === 'staff' || item.kind === 'redeem') && item.note ? item.note : kindLabels[item.kind]
            return (
              <li key={item.id} className="flex items-center gap-3 px-3.5 py-2.5 sm:px-4 sm:py-3">
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full sm:size-11 ${item.kind === 'staff' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}
                >
                  <Icon className="size-[18px] sm:size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold sm:text-base">{title}</span>
                  <span className="block text-xs text-muted-foreground sm:text-sm">
                    {new Date(item.created_at).toLocaleString('pl-PL', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Europe/Warsaw',
                    })}
                  </span>
                </span>
                <span className={`shrink-0 text-sm font-bold tabular-nums sm:text-base ${item.amount > 0 ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                  {item.amount > 0 ? '+' : ''}
                  {item.amount} pkt
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </ClubCollapsible>
  )
}

export function ClubProfileShortcuts({ role }: { role: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <a
        href="/#menu"
        className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_8px_20px_rgba(226,38,28,0.25)] transition-colors hover:bg-primary/90 sm:text-base"
      >
        <ShoppingBag className="size-4" aria-hidden="true" />
        Zamów teraz
      </a>
      {staffRoles.includes(role) && (
        <a
          href="/warsztat"
          className="flex h-11 items-center justify-center gap-2 rounded-full bg-card text-sm font-medium ring-1 ring-border transition-colors hover:bg-muted"
        >
          <ChefHat className="size-4" aria-hidden="true" />
          Przejdź do warsztatu
          <ChevronRight className="size-4" aria-hidden="true" />
        </a>
      )}
    </div>
  )
}

export function ClubAccountActions({ email, children }: { email: string; children?: ReactNode }) {
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    await createClient().auth.signOut()
    window.location.assign('/yummy-club')
  }

  return (
    <section id="konto" aria-label="Wylogowanie i usuwanie konta" className="mt-4 flex scroll-mt-20 flex-col items-center gap-1 border-t border-border/70 pt-5">
      <p className="mb-1 max-w-full truncate text-xs text-muted-foreground">
        Zalogowano jako <span className="font-semibold text-foreground">{email}</span>
      </p>
      <button
        type="button"
        onClick={signOut}
        disabled={signingOut}
        className="flex h-11 w-full max-w-xs items-center justify-center gap-2 rounded-full bg-card text-sm font-semibold ring-1 ring-border transition-colors hover:bg-muted disabled:opacity-60"
      >
        {signingOut ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <LogOut className="size-4" aria-hidden="true" />}
        Wyloguj się
      </button>
      {children}
    </section>
  )
}
