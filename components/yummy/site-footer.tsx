import Link from 'next/link'
import { Bike, Clock, MapPin, Phone } from 'lucide-react'
import { Logo } from './logo'
import { SocialLinks } from './social-links'
import { RESTAURANT } from '@/lib/restaurant'
import { PHONE, PHONE_DISPLAY } from '@/lib/seo'
import { formatKm } from '@/lib/order-settings'
import { groupOpeningHours } from '@/lib/opening-hours-format'
import { getPublicInfo } from '@/lib/public-info'

export async function SiteFooter() {
  const { openingHours, radiusKm } = await getPublicInfo()
  const hourGroups = openingHours ? groupOpeningHours(openingHours) : null

  return (
    <footer className="bg-cream">
      <div className="rounded-t-[2.75rem] bg-ink text-ink-foreground shadow-[0_-12px_36px_rgba(20,14,10,0.06)] sm:rounded-t-[3.75rem]">
        <div className="mx-auto grid max-w-7xl gap-6 px-3 py-8 sm:gap-10 sm:px-6 sm:py-16 md:grid-cols-4 lg:px-8">
        <div className="md:col-span-2">
          <Logo variant="white" className="h-12 sm:h-14" />
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-foreground/70 sm:mt-4 sm:text-base">
            Dobre burgery. Lepsze chwile. Świeże składniki i autorskie receptury – smak, który zawsze wraca.
          </p>
          <p className="mt-4 font-script text-xl text-primary sm:mt-6 sm:text-2xl">Good Burgers, Better Days</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 sm:mt-6">
            <SocialLinks className="-ml-2 text-white/85" />
            <Link href="/o-nas" className="text-sm font-semibold text-white/85 underline-offset-4 hover:text-white hover:underline">
              O nas
            </Link>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">Kontakt</h2>
          <ul className="mt-3 space-y-2 text-xs text-ink-foreground/70 sm:mt-4 sm:space-y-3 sm:text-sm">
            <li className="flex gap-2">
              <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <a href={RESTAURANT.mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                {RESTAURANT.name}
                <br />
                {RESTAURANT.street}
                <br />
                {RESTAURANT.postcode} {RESTAURANT.city}
              </a>
            </li>
            <li className="flex gap-2">
              <Bike className="size-4 shrink-0 text-primary" aria-hidden="true" />
              Dostawa w promieniu {formatKm(radiusKm)} km
            </li>
            <li className="flex gap-2">
              <Phone className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <a href={`tel:${PHONE}`} className="hover:text-white">{PHONE_DISPLAY}</a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">Godziny otwarcia</h2>
          <div className="mt-3 flex gap-2 text-xs text-ink-foreground/70 sm:mt-4 sm:text-sm">
            <Clock className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {hourGroups ? (
              <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-1">
                {hourGroups.map((group) => (
                  <div key={group.from} className="contents">
                    <dt>{group.days}</dt>
                    <dd className="tabular-nums text-white/90">{group.time}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <span>Aktualne godziny zobaczysz przy zamówieniu.</span>
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-3 py-4 text-[11px] text-ink-foreground/50 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6 sm:text-xs lg:px-8">
          <p>© {new Date().getFullYear()} Yummy. Wszystkie prawa zastrzeżone.</p>
          <nav aria-label="Dokumenty prawne">
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              <li><Link href="/regulaminy?dokument=regulamin" className="hover:text-white">Regulamin</Link></li>
              <li><Link href="/regulaminy?dokument=yummy-club" className="hover:text-white">Yummy Club i rabaty</Link></li>
              <li><Link href="/regulaminy?dokument=polityka-prywatnosci" className="hover:text-white">Polityka prywatności</Link></li>
              <li><Link href="/regulaminy?dokument=rodo" className="hover:text-white">RODO</Link></li>
            </ul>
          </nav>
        </div>
      </div>
      </div>
    </footer>
  )
}
