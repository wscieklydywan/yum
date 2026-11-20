import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ChevronLeft, Heart, Sparkles, UtensilsCrossed } from 'lucide-react'
import { Logo } from '@/components/yummy/logo'
import { SocialLinks } from '@/components/yummy/social-links'
import { SiteFooter } from '@/components/yummy/site-footer'
import { getCachedAbout } from '@/lib/public-cache'
import { DEFAULT_ABOUT, splitBold } from '@/lib/about'

// Rendered once and served as static HTML from the CDN until the workshop invalidates it on save.
export const revalidate = false

export const metadata: Metadata = {
  title: 'O nas – historia Yummy',
  description:
    'Yummy to burgerownia z Rybnika-Niedobczyc, która od 2019 roku łączy dobre jedzenie z klimatem amerykańskich dinerów. Poznaj naszą historię.',
  alternates: { canonical: '/o-nas' },
}

const valueIcons = [UtensilsCrossed, Sparkles, Heart]

function RichText({ text }: { text: string }) {
  return splitBold(text).map((part, index) =>
    part.bold ? <strong key={index} className="font-bold text-foreground">{part.text}</strong> : <span key={index}>{part.text}</span>,
  )
}

export default async function AboutPage() {
  const about = await getCachedAbout().catch(() => DEFAULT_ABOUT)

  return (
    <div className="min-h-dvh bg-cream">
      <header className="relative mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:h-20 sm:px-6">
        <Link
          href="/"
          aria-label="Wróć na stronę główną"
          className="grid size-9 place-items-center rounded-full bg-card shadow-sm ring-1 ring-border transition-colors hover:bg-muted sm:size-11"
        >
          <ChevronLeft className="size-4 sm:size-5" aria-hidden="true" />
        </Link>
        <Link href="/" aria-label="Yummy – strona główna" className="absolute left-1/2 -translate-x-1/2">
          <Logo priority className="h-9 sm:h-11" />
        </Link>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-10 pt-4 sm:px-6 sm:pb-16 sm:pt-8">
          <p className="text-sm font-bold uppercase tracking-widest text-primary">{about.eyebrow}</p>
          <h1 className="mt-3 max-w-3xl text-balance text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            {about.title}
          </h1>
          <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">{about.lead}</p>

          <div className="relative mt-8 overflow-hidden rounded-3xl sm:mt-12 sm:rounded-[2.5rem]">
            <Image
              src={about.hero.src}
              alt={about.hero.alt}
              width={about.hero.width}
              height={about.hero.height}
              priority
              sizes="(min-width: 1152px) 1104px, 100vw"
              className="aspect-[4/3] w-full object-cover sm:aspect-[21/9] sm:object-[center_60%]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-transparent" aria-hidden="true" />
            {(about.heroBadgeValue || about.heroBadgeText) && (
              <div className="absolute bottom-3 left-3 rounded-2xl bg-ink/85 px-4 py-3 text-ink-foreground backdrop-blur sm:bottom-6 sm:left-6 sm:px-6 sm:py-4">
                {about.heroBadgeValue && <p className="text-3xl font-extrabold leading-none tabular-nums sm:text-5xl">{about.heroBadgeValue}</p>}
                {about.heroBadgeText && <p className="mt-1 text-xs text-ink-foreground/75 sm:text-sm">{about.heroBadgeText}</p>}
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-8 px-4 pb-12 sm:px-6 sm:pb-20 md:grid-cols-2 md:items-center md:gap-14">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-4xl">{about.storyTitle}</h2>
            <div className="mt-5 space-y-4 text-pretty leading-relaxed text-foreground/80 sm:text-lg">
              {about.storyParagraphs.map((paragraph, index) => (
                <p key={index}><RichText text={paragraph} /></p>
              ))}
            </div>
          </div>
          <figure className="relative pb-6 pr-6 sm:pb-8 sm:pr-8">
            <Image
              src={about.terrace.src}
              alt={about.terrace.alt}
              width={about.terrace.width}
              height={about.terrace.height}
              sizes="(min-width: 768px) 50vw, 100vw"
              className="aspect-[4/3] w-full rounded-3xl object-cover object-[center_40%] md:aspect-[4/5]"
            />
            <div className="absolute bottom-0 right-0 flex items-center gap-3 rounded-2xl bg-card p-2.5 pr-4 shadow-xl ring-1 ring-border sm:p-3 sm:pr-5">
              <Image
                src={about.oldLogo.src}
                alt={about.oldLogo.alt}
                width={about.oldLogo.width}
                height={about.oldLogo.height}
                sizes="64px"
                className="size-12 rounded-xl object-contain sm:size-16"
              />
              <figcaption className="leading-tight">
                <span className="block text-xs font-bold uppercase tracking-wider text-primary">{about.oldLogoLabel}</span>
                <span className="block text-sm font-semibold">{about.oldLogoCaption}</span>
              </figcaption>
            </div>
          </figure>
        </section>

        <section aria-labelledby="values-heading" className="bg-ink text-ink-foreground">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
            <h2 id="values-heading" className="max-w-2xl text-balance text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
              {about.valuesTitle}
            </h2>
            <ul className="mt-6 flex flex-col gap-2.5 sm:mt-12 md:grid md:grid-cols-3 md:gap-4">
              {about.values.map(({ title, text }, index) => {
                const Icon = valueIcons[index] ?? Heart
                return (
                  <li
                    key={index}
                    className="flex items-start gap-3.5 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 md:flex-col md:gap-0 md:rounded-3xl md:p-6"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 md:size-11 md:rounded-full">
                      <Icon className="size-4 md:size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-bold leading-tight text-white md:mt-5 md:text-lg">{title}</h3>
                      {text && <p className="mt-1 text-sm leading-relaxed text-ink-foreground/70 md:mt-2 md:text-base">{text}</p>}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 sm:py-20 md:grid-cols-[2fr_3fr] md:items-center md:gap-14">
          <div className="grid grid-cols-[3fr_2fr] items-end gap-3 sm:gap-4">
            <Image
              src={about.burger.src}
              alt={about.burger.alt}
              width={about.burger.width}
              height={about.burger.height}
              sizes="(min-width: 768px) 24vw, 60vw"
              className="aspect-[4/5] w-full rounded-3xl object-cover"
            />
            <Image
              src={about.shake.src}
              alt={about.shake.alt}
              width={about.shake.width}
              height={about.shake.height}
              sizes="(min-width: 768px) 16vw, 40vw"
              className="mb-8 aspect-[3/4] w-full rounded-3xl object-cover sm:mb-12"
            />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-4xl">{about.thanksTitle}</h2>
            <div className="mt-5 space-y-4 text-pretty leading-relaxed text-foreground/80 sm:text-lg">
              {about.thanksParagraphs.map((paragraph, index) => (
                <p key={index}><RichText text={paragraph} /></p>
              ))}
            </div>
            {about.quote && (
              <blockquote className="mt-8 border-l-4 border-primary pl-5">
                <p className="text-pretty text-lg font-semibold leading-relaxed sm:text-xl">{about.quote}</p>
                {about.quoteAuthor && <footer className="mt-3 font-script text-xl text-primary">{about.quoteAuthor}</footer>}
              </blockquote>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 sm:pb-20">
          <div className="flex flex-col gap-6 rounded-3xl bg-primary p-6 text-primary-foreground sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <div>
              <h2 className="text-xl font-extrabold sm:text-3xl">{about.ctaTitle}</h2>
              <p className="mt-1 text-primary-foreground/85">{about.ctaText}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <SocialLinks className="text-white" />
              <Link
                href="/#menu"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-primary transition-transform hover:translate-x-0.5"
              >
                Zobacz menu
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
