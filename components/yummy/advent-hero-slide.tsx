'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ArrowRight, CalendarDays } from 'lucide-react'
import { AdventCalendarDialog } from './advent-calendar'
import { ChristmasTree, FestiveLogo, SnowCap, SnowDrift, Snowfall, StringLights } from './christmas-decor'
import { adventDateLabel, type AdventCalendar } from '@/lib/advent'

export function AdventHeroSlide({ data }: { data: AdventCalendar }) {
  const [open, setOpen] = useState(false)
  const ADVENT_DAYS = data.days
  const ADVENT_START_LABEL = adventDateLabel(data.starts_on)
  const running = data.mode === 'live' && data.started && !data.ended

  return (
    <div className="relative grid min-h-[250px] items-center overflow-hidden bg-[#22050a] px-5 pb-6 pt-10 text-white sm:min-h-[620px] sm:px-10 sm:py-16 md:min-h-[680px] lg:px-16">
      <Image
        src="/images/advent-hero.webp"
        alt="Kalendarz adwentowy Yummy Rybnik"
        fill
        sizes="(min-width: 1280px) 1280px, 100vw"
        className="object-cover object-[70%_center]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-[#22050a] via-[#22050a]/80 to-[#22050a]/10 md:via-[#22050a]/60 md:to-transparent"
      />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#22050a] to-transparent" />
      <Snowfall count={28} className="[--fall:720px]" />

      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0">
        <SnowDrift position="top" className="hidden h-10 sm:block md:h-12" />
        <StringLights bulbs={16} className="-mt-3 hidden sm:block" />
        <StringLights bulbs={9} className="-mt-1.5 h-8 opacity-90 sm:hidden" />
      </div>
      <ChristmasTree className="absolute bottom-9 right-4 w-9 drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)] sm:bottom-5 sm:left-[44%] sm:right-auto sm:w-20 md:w-24" />
      <SnowDrift position="bottom" className="absolute inset-x-0 bottom-0 h-6 sm:h-12" />

      <div className="relative max-w-xl">
        <FestiveLogo className="mb-6 hidden h-12 sm:inline-block md:h-14" />
        <p className="flex w-fit items-center gap-1.5 rounded-full bg-[#f2c14e]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#f2c14e] ring-1 ring-[#f2c14e]/35 sm:px-3 sm:py-1.5 sm:text-xs">
          <CalendarDays className="size-3 sm:size-3.5" aria-hidden="true" />
          {running ? `Dziś okienko ${data.today}` : `Od ${ADVENT_START_LABEL}`}
        </p>
        <h2 className="mt-2 max-w-[13rem] text-[1.75rem] font-extrabold leading-[1.02] text-balance [text-shadow:0_3px_0_rgba(0,0,0,0.35)] sm:mt-5 sm:max-w-xl sm:text-7xl sm:font-black sm:tracking-tight lg:text-8xl">
          Kalendarz{' '}
          <span className="text-[#f2c14e] [text-shadow:0_0_28px_rgba(242,193,78,0.5),0_3px_0_#5c3a05]">adwentowy</span>
        </h2>
        <p className="mt-1.5 text-xs text-white/80 sm:mt-6 sm:text-lg">
          <span className="sm:hidden">{ADVENT_DAYS} dni niespodzianek</span>
          <span className="hidden sm:inline">
            {data.teaser_text || (running
              ? `${ADVENT_DAYS} okienka, ${ADVENT_DAYS} świąteczne niespodzianki. Dzisiejsze okienko już czeka w Yummy Club.`
              : `${ADVENT_DAYS} okienka, ${ADVENT_DAYS} świąteczne niespodzianki. Codziennie coś nowego – zajrzyj już ${ADVENT_START_LABEL}.`)}
          </span>
        </p>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-primary pl-5 pr-1.5 text-sm font-bold text-white shadow-[0_4px_0_#7a0d09,0_12px_24px_-6px_rgba(215,31,22,0.6)] transition-transform hover:-translate-y-0.5 active:translate-y-0.5 sm:mt-8 sm:h-14 sm:gap-3 sm:pl-7 sm:pr-2 sm:text-base"
        >
          <SnowCap className="-top-2 left-3 h-3.5 w-[85%] sm:h-4" />
          {running ? 'Otwórz okienko' : 'Zobacz kalendarz'}
          <span className="grid size-8 place-items-center rounded-full bg-white text-primary transition-transform group-hover:translate-x-0.5 sm:size-10">
            <ArrowRight className="size-4 sm:size-5" aria-hidden="true" />
          </span>
        </button>
      </div>
      <AdventCalendarDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}
