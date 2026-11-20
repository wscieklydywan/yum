import Image from 'next/image'

export function ClubHero() {
  return (
    <section aria-labelledby="club-hero-title" className="relative flex items-center gap-3 lg:items-start">
      <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-2.5 sm:gap-4">
        <p className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary sm:text-xs">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
          Yummy Club
        </p>
        <h1
          id="club-hero-title"
          className="text-[1.6rem] font-extrabold leading-[1.05] tracking-tight text-foreground text-balance sm:text-5xl lg:text-6xl"
        >
          Więcej smaku
          <span className="block font-script text-[1.45rem] font-normal leading-[1.15] text-primary sm:text-5xl lg:text-6xl">
            z każdym zamówieniem
          </span>
        </h1>
        <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground text-pretty sm:text-base lg:text-lg">
          Zbieraj Stars, odbieraj darmowe jedzenie i korzystaj z ofert tylko dla członków. Za darmo.
        </p>
      </div>

      <div className="relative -mr-4 w-[38%] max-w-[20rem] shrink-0 sm:mr-0 sm:w-[36%]">
        <Image
          src="/images/club-hero.webp"
          alt="Burger, frytki i napój Yummy z czerwoną koroną i złotymi monetami"
          width={900}
          height={900}
          priority
          sizes="(min-width: 1024px) 320px, 38vw"
          className="h-auto w-full mix-blend-multiply [mask-image:radial-gradient(circle_at_center,black_55%,transparent_72%)]"
        />
      </div>
    </section>
  )
}
