import Image from 'next/image'
import type { ReactNode } from 'react'
import { Gift, Percent, Sparkles, Star } from 'lucide-react'
import { PrizeWheel } from '@/components/yummy/prize-wheel'
import type { LoyaltyRate } from '@/lib/loyalty-rate'

const formatSpend = (spend: number) => (Number.isInteger(spend) ? String(spend) : spend.toFixed(2).replace('.', ','))

function PerkImage({ src }: { src: string }) {
  return (
    <Image
      src={src}
      alt=""
      fill
      sizes="(min-width: 640px) 112px, 80px"
      className="object-contain mix-blend-multiply transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105"
    />
  )
}

const perks: { icon: typeof Gift; title: string; text: string; tag: string; visual: ReactNode }[] = [
  {
    icon: Gift,
    title: 'Darmowe jedzenie',
    text: 'Wymieniaj Stars na nagrody',
    tag: 'Burgery, frytki, napoje',
    visual: <PerkImage src="/images/perk-burger.webp" />,
  },
  {
    icon: Percent,
    title: 'Rabaty',
    text: 'Kupony tylko dla członków',
    tag: 'Prosto na Twoje konto',
    visual: <PerkImage src="/images/perk-coupon-v2.webp" />,
  },
  {
    icon: Sparkles,
    title: 'Wydarzenia',
    text: 'Gry, koło fortuny i akcje specjalne',
    tag: 'Darmowy spin codziennie',
    visual: (
      <div className="absolute inset-[4%] transition-transform duration-700 group-hover:rotate-[30deg]">
        <PrizeWheel className="max-w-none" />
      </div>
    ),
  },
]

export function ClubBenefits({ rate }: { rate: LoyaltyRate }) {
  return (
    <section aria-labelledby="club-benefits-title" className="lg:col-start-1">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-5">
        <div>
          <h2 id="club-benefits-title" className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Co zyskujesz?
          </h2>
          <svg viewBox="0 0 160 12" className="mt-1 h-2 w-24 text-primary sm:w-28" aria-hidden="true">
            <path d="M3 9C45 2 110 1 157 5" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </div>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-foreground/80">
          <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
          {rate.points} {rate.points === 1 ? 'Star' : 'Stars'} za każde {formatSpend(rate.spend)} zł
        </p>
      </div>

      <ul className="flex flex-col gap-2.5 sm:gap-3">
        {perks.map(({ icon: Icon, title, text, tag, visual }) => (
          <li
            key={title}
            className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border/70 bg-card py-3 pl-3 pr-2 shadow-[0_6px_20px_-14px_rgba(20,10,10,0.25)] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_26px_-14px_rgba(20,10,10,0.3)] sm:gap-4 sm:rounded-3xl sm:py-4 sm:pl-4"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-primary sm:size-12 sm:rounded-2xl">
              <Icon className="size-5 sm:size-6" strokeWidth={1.9} aria-hidden="true" />
            </span>

            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-extrabold leading-tight tracking-tight text-foreground sm:text-lg">{title}</h3>
              <p className="mt-0.5 text-pretty text-xs leading-snug text-muted-foreground sm:text-sm">{text}</p>
              <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary sm:text-xs">
                <span className="size-1 rounded-full bg-primary" aria-hidden="true" />
                {tag}
              </p>
            </div>

            <div className="relative size-20 shrink-0 sm:size-28">{visual}</div>
          </li>
        ))}
      </ul>
    </section>
  )
}
