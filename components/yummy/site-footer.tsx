import { Bike, Clock, MapPin, Phone } from 'lucide-react'
import { Logo } from './logo'
import { DELIVERY_RADIUS_KM, RESTAURANT } from '@/lib/restaurant'

export function SiteFooter() {
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
              Dowóz w promieniu {DELIVERY_RADIUS_KM} km
            </li>
            <li className="flex gap-2">
              <Phone className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <a href="tel:+48500600700" className="hover:text-white">+48 500 600 700</a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">Godziny otwarcia</h2>
          <ul className="mt-3 space-y-2 text-xs text-ink-foreground/70 sm:mt-4 sm:space-y-3 sm:text-sm">
            <li className="flex gap-2">
              <Clock className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                Pon – Czw: 11:00 – 22:00
                <br />
                Pt – Sob: 11:00 – 24:00
                <br />
                Niedziela: 12:00 – 21:00
              </span>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-3 py-4 text-[11px] text-ink-foreground/50 sm:px-6 sm:py-6 sm:text-xs lg:px-8">
          © {new Date().getFullYear()} Yummy. Wszystkie prawa zastrzeżone.
        </p>
      </div>
      </div>
    </footer>
  )
}
