import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Trophy } from 'lucide-react'
import { HALLOWEEN_ENDS_LABEL } from '@/lib/halloween'

const HALLOWEEN_END = new Date('2026-11-02T00:00:00+01:00')

export const isHalloweenPromoActive = () => Date.now() < HALLOWEEN_END.getTime()

export function HalloweenHeroSlide() {
  return (
    <div className="relative grid items-center bg-[#1a0b2e] px-5 py-6 text-white sm:px-10 sm:py-16 lg:px-16">
      <Image
        src="/images/club-halloween-hero.webp"
        alt=""
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
          Halloween · do {HALLOWEEN_ENDS_LABEL}
        </p>
        <h2 className="mt-2 max-w-[12rem] text-[1.75rem] font-extrabold leading-[1.02] text-balance sm:mt-6 sm:max-w-xl sm:text-7xl sm:font-black sm:tracking-tight lg:text-8xl">
          Dyniowe <span className="text-[#f7a93b]">Łowy</span>
        </h2>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-white/80 sm:mt-6 sm:text-lg">
          <Trophy className="size-3.5 shrink-0 text-[#f7c948] sm:size-5" aria-hidden="true" />
          <span className="sm:hidden">Graj o Stars i nagrody top 3</span>
          <span className="hidden sm:inline">Zagraj w Yummy Club, zgarniaj Stars i walcz o darmowe jedzenie.</span>
        </p>
        <Link
          href="/yummy-club"
          className="group mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-[#f07b1d] pl-5 pr-1.5 text-sm font-bold text-white shadow-lg shadow-[#f07b1d]/30 transition-colors hover:bg-[#f07b1d]/90 sm:mt-8 sm:h-14 sm:gap-3 sm:pl-7 sm:pr-2 sm:text-base"
        >
          Zagraj teraz
          <span className="grid size-8 place-items-center rounded-full bg-white text-[#f07b1d] transition-transform group-hover:translate-x-0.5 sm:size-10">
            <ArrowRight className="size-4 sm:size-5" aria-hidden="true" />
          </span>
        </Link>
      </div>
    </div>
  )
}
