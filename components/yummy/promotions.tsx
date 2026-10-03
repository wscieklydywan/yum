import Image from 'next/image'
import { ArrowRight, Bike, Clock, GraduationCap } from 'lucide-react'
import { SectionHeading } from './section-heading'

const smallPromos = [
  {
    icon: Clock,
    title: 'Happy Hours',
    highlight: '-15% na zestawy',
    text: 'Codziennie 12:00 – 16:00',
  },
  {
    icon: Bike,
    title: 'Darmowa dostawa',
    highlight: 'od 80 zł',
    text: 'Na terenie całego Rybnika',
  },
  {
    icon: GraduationCap,
    title: 'Student Deal',
    highlight: '-20% z legitymacją',
    text: 'Poniedziałek – czwartek',
  },
]

export function Promotions() {
  return (
    <section id="promocje" aria-labelledby="promo-title" className="bg-ink py-6 text-ink-foreground sm:py-20">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <SectionHeading
          id="promo-title"
          tone="dark"
          eyebrow="Tylko w Yummy"
          title="Promocje"
          description="Smakuje lepiej, kiedy kosztuje mniej. Sprawdź, co dziś dla Ciebie mamy."
          compactMobile
        />

        <div className="mt-4 grid gap-2.5 sm:mt-12 sm:gap-6 lg:grid-cols-5">
          <article className="relative overflow-hidden rounded-3xl bg-primary lg:col-span-3">
            <Image
              src="/images/spicy-jalapeno.webp"
              alt=""
              fill
              sizes="(min-width: 1024px) 60vw, 100vw"
              className="object-cover object-right opacity-90"
            />
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-transparent" />
            <div className="relative flex min-h-[205px] flex-col justify-end p-4 sm:min-h-[380px] sm:p-10">
              <p className="font-script text-2xl leading-none text-white sm:text-5xl">Burgerowe</p>
              <p className="mt-1 text-3xl font-black uppercase italic leading-none text-primary sm:text-6xl">
                Środy
              </p>
              <p className="mt-1.5 text-4xl font-black italic leading-none text-white sm:mt-2 sm:text-8xl">-20%</p>
              <p className="mt-2.5 max-w-xs text-sm leading-snug text-ink-foreground/80 sm:mt-4 sm:text-base">
                Na wszystkie burgery. Co środę, cały dzień – bez kodów i bez haczyków.
              </p>
              <a
                href="#menu"
                className="mt-3 inline-flex h-10 w-fit items-center gap-2 rounded-full bg-white px-4 text-xs font-bold text-primary transition-colors hover:bg-cream sm:mt-6 sm:h-12 sm:px-6 sm:text-sm"
              >
                Skorzystaj
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            </div>
          </article>

          <div className="grid gap-3 sm:gap-6 lg:col-span-2">
            <article className="relative overflow-hidden rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 sm:rounded-3xl sm:p-6">
              <p className="font-script text-2xl text-white sm:text-3xl">Drugi burger</p>
              <p className="text-4xl font-black italic text-primary sm:text-5xl">-50%</p>
              <p className="mt-2 text-xs text-ink-foreground/70 sm:mt-3 sm:text-sm">
                Z kodem{' '}
                <span className="rounded-md bg-primary px-2 py-0.5 font-mono font-bold text-primary-foreground">DRUGI50</span>
              </p>
              <Image
                src="/images/zacny.webp"
                alt=""
                width={180}
                height={180}
                className="absolute -bottom-5 -right-5 size-32 rounded-full object-cover opacity-90 ring-2 ring-ink sm:-bottom-6 sm:-right-6 sm:size-40 sm:ring-4"
              />
            </article>

            <ul className="grid gap-2 sm:gap-3">
              {smallPromos.map(({ icon: Icon, title, highlight, text }) => (
                <li key={title} className="flex items-center gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10 sm:gap-4 sm:rounded-2xl sm:p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground sm:size-12 sm:rounded-xl">
                    <Icon className="size-5 sm:size-6" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white sm:text-base">{title}</h3>
                    <p className="text-xs leading-snug sm:text-sm">
                      <span className="font-semibold text-primary">{highlight}</span>
                      <span className="text-ink-foreground/60"> · {text}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
