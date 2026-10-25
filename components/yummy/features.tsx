import { Crown, Hamburger, Rocket, SlidersHorizontal } from 'lucide-react'

const features = [
  {
    icon: Hamburger,
    title: 'Przejrzyste menu',
    text: 'Duże zdjęcia, prosty podział na kategorie, tylko najważniejsze pozycje.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Personalizacja',
    text: 'Dostosuj burgera do siebie – rozmiar, dodatki i sosy w kilka sekund.',
  },
  {
    icon: Crown,
    title: 'Yummy Club',
    text: 'Zbieraj punkty, odbieraj nagrody i dostawaj spersonalizowane oferty.',
  },
  {
    icon: Rocket,
    title: 'Szybkie zamawianie',
    text: 'Intuicyjna ścieżka zamówienia i śledzenie kuriera w czasie rzeczywistym.',
  },
]

export function Features() {
  return (
    <section aria-label="Dlaczego Yummy" className="hidden mx-auto max-w-7xl px-4 pb-3 pt-12 sm:px-6 sm:pb-4 sm:pt-20 md:block lg:px-8">
      <ul className="grid gap-5 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-border">
        {features.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-4 lg:px-8 lg:first:pl-0 lg:last:pr-0">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-primary sm:size-14">
              <Icon className="size-5 sm:size-7" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-lg font-bold">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
