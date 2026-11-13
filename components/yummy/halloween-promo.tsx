'use client'

import Image from 'next/image'
import Link from 'next/link'
import useSWR from 'swr'
import { ArrowRight, Crown, Trophy } from 'lucide-react'
import { fetchHalloweenPublic, halloweenEndsLabel, HALLOWEEN_PUBLIC_KEY } from '@/lib/halloween'
import { cn } from '@/lib/utils'

const medalColors = ['text-[#f5b936]', 'text-[#d3d8de]', 'text-[#e09a6a]']

export function HalloweenHeroSlide() {
  const { data } = useSWR(HALLOWEEN_PUBLIC_KEY, fetchHalloweenPublic, { revalidateOnFocus: false })
  const ended = Boolean(data?.ended)
  const winners = data?.winners ?? []

  return (
    <div className="relative grid items-center bg-[#1a0b2e] px-5 py-6 text-white sm:px-10 sm:py-16 lg:px-16">
      <Image
        src="/images/club-halloween-hero.webp"
        alt="Halloween w Yummy Club"
        fill
        sizes="(min-width: 1280px) 1280px, 100vw"
        className="object-cover object-[62%_center]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-[#140a20] via-[#140a20]/80 to-[#140a20]/10 md:via-[#140a20]/60 md:to-transparent"
      />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#140a20] to-transparent" />

      <div className="relative max-w-xl">
        <p className="inline-flex items-center rounded-full bg-[#f07b1d]/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#ffb46a] ring-1 ring-[#f07b1d]/40 sm:px-3 sm:py-1.5 sm:text-xs">
          {ended ? 'Halloween · wyniki' : `Halloween · do ${halloweenEndsLabel(data?.ends_at)}`}
        </p>
        <h2 className="mt-2 max-w-[12rem] text-[1.75rem] font-extrabold leading-[1.02] text-balance sm:mt-6 sm:max-w-xl sm:text-7xl sm:font-black sm:tracking-tight lg:text-8xl">
          Dyniowe <span className="text-[#f7a93b]">Łowy</span>
        </h2>

        {ended && winners.length > 0 ? (
          <ol aria-label="Zwycięzcy" className="mt-2 flex max-w-xs flex-col gap-1 sm:mt-6 sm:gap-2">
            {winners.map((winner) => (
              <li key={winner.place} className="flex items-center gap-2 text-xs sm:text-base">
                <Crown className={cn('size-3.5 shrink-0 sm:size-5', medalColors[winner.place - 1])} aria-hidden="true" />
                <span className="sr-only">{winner.place}. miejsce:</span>
                <span className="truncate font-bold">{winner.name}</span>
                <span className="ml-auto shrink-0 font-black tabular-nums text-white/80">{winner.score} pkt</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-white/80 sm:mt-6 sm:text-lg">
            <Trophy className="size-3.5 shrink-0 text-[#f7c948] sm:size-5" aria-hidden="true" />
            {ended ? (
              'Gra zakończona – zwycięzcy wkrótce'
            ) : (
              <>
                <span className="sm:hidden">Graj o Stars i nagrody top 3</span>
                <span className="hidden sm:inline">Zagraj w Yummy Club, zgarniaj Stars i walcz o darmowe jedzenie.</span>
              </>
            )}
          </p>
        )}

        <Link
          href="/yummy-club"
          className="group mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-[#f07b1d] pl-5 pr-1.5 text-sm font-bold text-white shadow-lg shadow-[#f07b1d]/30 transition-colors hover:bg-[#f07b1d]/90 sm:mt-8 sm:h-14 sm:gap-3 sm:pl-7 sm:pr-2 sm:text-base"
        >
          {ended ? 'Sprawdź swoje miejsce' : 'Zagraj teraz'}
          <span className="grid size-8 place-items-center rounded-full bg-white text-[#f07b1d] transition-transform group-hover:translate-x-0.5 sm:size-10">
            <ArrowRight className="size-4 sm:size-5" aria-hidden="true" />
          </span>
        </Link>
      </div>
    </div>
  )
}
