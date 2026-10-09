import Image from 'next/image'
import { ArrowRight, Heart, Leaf, ShieldCheck, Star } from 'lucide-react'

const perks = [
  { icon: ShieldCheck, title: 'Świeże produkty', text: 'Codziennie dostarczane' },
  { icon: Leaf, title: 'Lokalne składniki', text: 'Od sprawdzonych dostawców' },
  { icon: Heart, title: 'Smak, który łączy', text: 'Autorskie receptury' },
]

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-title" className="px-3 pt-3 sm:px-6 sm:pt-4 lg:px-8">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-ink text-ink-foreground sm:rounded-[2rem]">
        <Image
          src="/images/hero-burger.webp"
          alt="Podwójny burger z bekonem i roztopionym cheddarem na drewnianej desce"
          fill
          priority
          sizes="(min-width: 1280px) 1280px, 100vw"
          className="object-cover object-[70%_center]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/10 md:via-ink/70 md:to-transparent"
        />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />

        <div className="relative grid min-h-[235px] items-center px-5 py-6 sm:min-h-[620px] sm:px-10 sm:py-16 md:min-h-[680px] lg:px-16">
          <div className="max-w-xl">
            <p className="hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-ink-foreground/90 ring-1 ring-white/15 backdrop-blur sm:inline-flex">
              <Star className="size-3.5 fill-primary text-primary" aria-hidden="true" />
              4,9 · ponad 2 000 opinii w Rybniku
            </p>

            <h1 id="hero-title" className="mt-2 max-w-[12rem] font-sans text-[1.75rem] font-extrabold leading-[1.02] text-balance sm:mt-6 sm:max-w-xl sm:font-script sm:text-7xl sm:font-normal sm:leading-[0.98] lg:text-8xl">
              <span className="hidden sm:block sm:text-white">Burgery,</span>
              <span className="hidden sm:block sm:text-primary">które robią dzień.</span>
              <span className="block text-white sm:hidden">Burgery,</span>
              <span className="block text-white sm:hidden">które zawsze</span>
              <span className="block text-white sm:hidden">smakują.</span>
            </h1>
            <svg
              aria-hidden="true"
              viewBox="0 0 300 20"
              className="mt-2 hidden h-4 w-56 text-primary sm:block sm:w-72"
              fill="none"
            >
              <path d="M4 15C80 5 180 2 296 6" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
            </svg>

            <p className="mt-4 hidden max-w-md text-base leading-relaxed text-ink-foreground/80 sm:mt-6 sm:block sm:text-lg">
              100% wołowiny. Świeże dodatki. Autorskie sosy. Zero kompromisów – dostawa pod drzwi w około 30 minut.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-8">
              <a
                href="#menu"
                className="group inline-flex size-11 items-center justify-center rounded-full bg-white text-sm font-bold uppercase tracking-wide text-primary shadow-lg shadow-primary/30 transition-colors hover:bg-cream sm:h-14 sm:w-auto sm:justify-start sm:gap-3 sm:rounded-full sm:bg-primary sm:pl-7 sm:pr-2 sm:text-primary-foreground sm:hover:bg-primary/90 sm:text-base"
              >
                <span className="sr-only sm:not-sr-only">Zamów teraz</span>
                <span className="grid size-9 place-items-center rounded-full text-primary transition-transform group-hover:translate-x-0.5 sm:size-10 sm:bg-white">
                  <ArrowRight className="size-5" aria-hidden="true" />
                </span>
              </a>
              <a
                href="#promocje"
                className="hidden h-12 items-center rounded-full px-4 text-sm font-semibold text-white ring-1 ring-white/30 transition-colors hover:bg-white/10 sm:inline-flex sm:h-14 sm:px-6 sm:text-base"
              >
                Zobacz promocje
              </a>
            </div>
          </div>

          <p
            aria-hidden="true"
            className="pointer-events-none absolute bottom-28 right-8 hidden -rotate-12 font-script text-3xl leading-tight text-white/90 md:block lg:right-16 lg:text-4xl"
          >
            Good Burgers
            <br />
            Better Days
          </p>
        </div>
      </div>

      <div className="relative z-10 mx-auto -mt-8 hidden max-w-5xl px-1 md:block md:-mt-12 md:px-6">
        <ul className="grid grid-cols-1 divide-y divide-border rounded-3xl bg-card p-2 shadow-xl shadow-ink/10 ring-1 ring-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {perks.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-5 sm:py-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary sm:size-12 sm:rounded-2xl">
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-bold uppercase tracking-wide">{title}</span>
                <span className="block text-sm text-muted-foreground">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
