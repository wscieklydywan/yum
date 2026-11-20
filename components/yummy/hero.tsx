import { getImageProps } from 'next/image'
import { ArrowRight, Heart, Leaf, ShieldCheck, Star } from 'lucide-react'
import { HomeHeroCarousel } from './home-hero-carousel'
import { HeroCtaArrow, HeroCtaRow, heroCtaClass } from './hero-slide-cta'
import { loadPublicHomeSlides } from '@/lib/home-slides-public'
import { customSlideKey, type PublicHomeSlides } from '@/lib/home-slides'

/** Slider data comes from the server cache and is baked into the page, so the first paint already shows the right slides. */
export async function Hero() {
  const { body: config } = await loadPublicHomeSlides()
  const firstSlide = firstServerSlide(config, config.hidden)
  const burgersNeeded = !config.hidden.includes('burgers') || firstSlide === 'burgers'

  return (
    <section id="top" aria-labelledby="hero-title" className="px-3 pt-3 sm:px-6 sm:pt-4 lg:px-8">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-ink text-ink-foreground sm:rounded-[2rem]">
        <HomeHeroCarousel initialConfig={config} priorityId={firstSlide} burgerSlide={burgersNeeded ? <BurgerSlide priority={firstSlide === 'burgers'} /> : null} />
      </div>
    </section>
  )
}

/** Copy of the home slider for the Yummy Club app, with its own visibility set in the workshop. */
export async function ClubHeroSlider() {
  const { body: config } = await loadPublicHomeSlides()
  const hidden = config.clubHidden ?? []
  const visible = config.order.filter((id) => !hidden.includes(id))
  if (visible.length === 0) return null
  const firstSlide = firstServerSlide(config, hidden)
  const burgersNeeded = !hidden.includes('burgers')

  return (
    <section aria-label="Aktualności Yummy" className="relative overflow-hidden rounded-3xl bg-ink text-ink-foreground [&_h1]:text-[1.375rem]">
      <HomeHeroCarousel variant="club" initialConfig={config} priorityId={firstSlide} burgerSlide={burgersNeeded ? <BurgerSlide priority={false} /> : null} />
    </section>
  )
}

/** First visible slide known on the server (advent/Halloween are decided in the browser). Gets the preloaded image. */
function firstServerSlide(config: PublicHomeSlides, hidden: string[]): string {
  const known = new Set<string>(['burgers', ...(config.burgerWeek ? ['burger_week'] : []), ...config.custom.map((slide) => customSlideKey(slide.id))])
  return config.order.find((id) => !hidden.includes(id) && known.has(id)) ?? 'burgers'
}

/**
 * Art direction: phones get a crop with the burger pushed to the right edge, so the headline
 * and CTA sit on empty dark background instead of on top of the burger.
 */
function BurgerSlideImage({ priority }: { priority: boolean }) {
  const common = { alt: 'Podwójny burger z bekonem i roztopionym cheddarem na drewnianej desce', fill: true, priority }
  const { props: { srcSet: mobileSrcSet } } = getImageProps({ ...common, src: '/images/hero-burger-mobile.webp', sizes: '100vw' })
  const { props: { srcSet: desktopSrcSet, ...rest } } = getImageProps({ ...common, src: '/images/hero-burger.webp', sizes: '(min-width: 1280px) 1280px, 100vw' })
  return (
    <picture>
      <source media="(max-width: 639px)" srcSet={mobileSrcSet} sizes="100vw" />
      <source media="(min-width: 640px)" srcSet={desktopSrcSet} />
      {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from getImageProps */}
      <img {...rest} className="object-cover object-right sm:object-[70%_center]" />
    </picture>
  )
}

function BurgerSlide({ priority }: { priority: boolean }) {
  return (
    <div className="relative grid min-h-[250px] bg-ink text-ink-foreground sm:min-h-[620px] md:min-h-[680px]">
          <BurgerSlideImage priority={priority} />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/40 to-transparent sm:from-ink sm:via-ink/85 sm:to-ink/10 md:via-ink/70 md:to-transparent"
          />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />

          <div className="relative grid items-end px-5 pb-8 pt-6 sm:px-10 sm:pb-16 sm:pt-16 lg:px-16">
            <div className="max-w-xl">
              <p className="hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-ink-foreground/90 ring-1 ring-white/15 backdrop-blur sm:inline-flex">
                <Star className="size-3.5 fill-primary text-primary" aria-hidden="true" />
                4,9 · ponad 2 000 opinii w Rybniku
              </p>

              <h1 id="hero-title" className="mt-2 max-w-[12rem] font-sans text-[1.375rem] font-extrabold leading-[1.02] text-balance sm:mt-6 sm:max-w-xl sm:font-script sm:text-7xl sm:font-normal sm:leading-[0.98] lg:text-8xl">
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

              <HeroCtaRow
                secondary={
                  <a
                    href="#promocje"
                    className="hidden h-14 items-center rounded-full px-6 text-base font-semibold text-white ring-1 ring-white/30 transition-colors hover:bg-white/10 sm:inline-flex"
                  >
                    Zobacz promocje
                  </a>
                }
              >
                <a href="#menu" className={`${heroCtaClass} bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90`}>
                  Zamów teraz
                  <HeroCtaArrow />
                </a>
              </HeroCtaRow>
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
  )
}
