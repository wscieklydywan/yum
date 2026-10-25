import Image from 'next/image'

export function ClubHero() {
  return (
    <section aria-labelledby="club-hero-title" className="relative flex items-center gap-2 overflow-hidden">
      <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-3 sm:gap-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary sm:text-xs">Yummy Club</p>
        <h1
          id="club-hero-title"
          className="text-[1.75rem] font-extrabold leading-[1.02] tracking-tight text-foreground text-balance sm:text-5xl lg:text-6xl"
        >
          Więcej smaku
          <span className="mt-1 block font-script text-[1.6rem] font-normal italic leading-[1.1] text-primary sm:text-5xl lg:text-6xl">
            z każdym zamówieniem!
          </span>
          <span aria-hidden="true" className="mt-2 block h-1 w-24 -rotate-2 rounded-full bg-primary sm:w-40" />
        </h1>
        <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground text-pretty sm:text-base">
          Dołącz do Yummy Club, zbieraj punkty i odbieraj darmowe jedzenie oraz wyjątkowe oferty.
        </p>
      </div>

      <div className="relative -mr-6 w-[46%] max-w-[22rem] shrink-0 sm:mr-0 sm:w-[42%]">
        <Image
          src="/images/club-hero.webp"
          alt="Burger, frytki i napój Yummy z czerwoną koroną i złotymi monetami"
          width={900}
          height={900}
          priority
          sizes="(min-width: 1024px) 352px, 46vw"
          className="h-auto w-full mix-blend-multiply [mask-image:radial-gradient(circle_at_center,black_55%,transparent_72%)]"
        />
      </div>
    </section>
  )
}
