'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  ChefHat,
  ChevronRight,
  Clock,
  Coins,
  Crown,
  Disc3,
  Gift,
  LoaderCircle,
  LogOut,
  Percent,
  ShoppingBag,
  Star,
  Tag,
  UserRound,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getTier, type PointTransaction } from '@/lib/loyalty'
import { useWheelPrizes } from '@/lib/use-wheel-prizes'
import { rewardSummary, wheelIcon } from '@/lib/wheel'

const staffRoles = ['admin', 'szef', 'kuchnia', 'kelner', 'kierowca']

const kindLabels: Record<PointTransaction['kind'], string> = {
  spin: 'Koło fortuny',
  spin_cost: 'Dodatkowe zakręcenie',
  staff: 'Punkty od obsługi',
  redeem: 'Odebrana nagroda',
  promo: 'Kod promocyjny',
}

export const cardClass = 'rounded-2xl bg-card shadow-[0_8px_30px_rgba(80,30,10,0.06)] ring-1 ring-border/60 sm:rounded-3xl'

function initials(name: string) {
  return name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function ClubGreeting({ displayName }: { displayName: string }) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-extrabold tracking-tight sm:text-3xl">Cześć, {displayName}!</h1>
        <p className="text-sm text-muted-foreground sm:mt-0.5 sm:text-base">Miło Cię znowu widzieć</p>
      </div>
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-base font-extrabold text-primary sm:size-16 sm:text-xl">
        {initials(displayName) || <UserRound className="size-5" aria-hidden="true" />}
      </span>
    </header>
  )
}

export function ClubPointsCard({ points }: { points: number }) {
  const tier = getTier(points)
  return (
    <section
      aria-label="Twoje punkty"
      className="rounded-2xl bg-[#191513] p-4 text-white shadow-[0_14px_34px_rgba(25,21,19,0.25)] sm:rounded-3xl sm:p-6"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/65 sm:text-xs">Twoje punkty</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-3xl font-extrabold tabular-nums sm:gap-2.5 sm:text-4xl">
          <Coins className="size-6 text-[#f5b936] sm:size-8" aria-hidden="true" />
          {points.toLocaleString('pl-PL')}
        </p>
        <p className={`flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1.5 text-xs font-bold ring-1 ring-white/10 sm:px-3.5 sm:py-2 sm:text-sm ${tier.color}`}>
          <Crown className="size-3.5 sm:size-4" aria-hidden="true" />
          {tier.name}
          <ChevronRight className="size-3.5 opacity-70 sm:size-4" aria-hidden="true" />
        </p>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-white/15 sm:mt-4 sm:h-2.5"
        role="progressbar"
        aria-label="Postęp do kolejnego poziomu"
        aria-valuenow={tier.progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#e89c43] to-[#ffd36f] transition-[width] duration-700"
          style={{ width: `${tier.progress}%` }}
        />
      </div>
      <p className="mt-2.5 flex items-center justify-between gap-2 text-xs text-white/80 sm:mt-3 sm:text-sm">
        {tier.missing > 0 ? `Jeszcze ${tier.missing} pkt do kolejnego poziomu` : 'Masz najwyższy poziom. Brawo!'}
        <ChevronRight className="size-4 shrink-0 text-[#f5b936]" aria-hidden="true" />
      </p>
    </section>
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
    <section aria-labelledby="club-activity-title">
      <h2 id="club-activity-title" className="text-base font-bold sm:text-lg">Ostatnia aktywność</h2>
      {transactions.length === 0 ? (
        <p className={`mt-2.5 p-4 text-sm leading-relaxed text-muted-foreground ${cardClass}`}>
          Nie masz jeszcze punktów. Zakręć kołem albo poproś obsługę o dopisanie punktów za zamówienie.
        </p>
      ) : (
        <ul className={`mt-2.5 flex flex-col divide-y divide-border overflow-hidden ${cardClass}`}>
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
    </section>
  )
}

export function ClubAccountActions({ email, role }: { email: string; role: string }) {
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    await createClient().auth.signOut()
    window.location.assign('/yummy-club')
  }

  return (
    <section id="konto" aria-label="Konto" className="flex scroll-mt-20 flex-col gap-2">
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
      <button
        type="button"
        onClick={signOut}
        disabled={signingOut}
        className="flex h-11 items-center justify-center gap-2 rounded-full text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
      >
        {signingOut ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <LogOut className="size-4" aria-hidden="true" />}
        Wyloguj się
        <span className="sr-only">({email})</span>
      </button>
    </section>
  )
}
