import Image from 'next/image'
import { ArrowRight } from 'lucide-react'

const points = [
  {
    title: '100% wołowiny',
    text: 'Świeżo mielona każdego ranka, bez dodatków.',
    image: '/images/ingredient-beef.webp',
  },
  {
    title: 'Świeże warzywa',
    text: 'Od lokalnych dostawców z okolic Rybnika.',
    image: '/images/ingredient-vegetables.webp',
  },
  {
    title: 'Autorskie sosy',
    text: 'Receptury dopracowane w naszej kuchni.',
    image: '/images/ingredient-sauce.webp',
  },
  {
    title: 'Codziennie w Twoim mieście',
    text: 'Pieczemy bułki na miejscu, od 6:00.',
    image: '/images/ingredient-bun.webp',
  },
]

export function Ingredients() {
  return (
    <section aria-labelledby="ingredients-title" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-20 lg:px-8">
      <div className="grid items-center gap-5 sm:gap-12 lg:grid-cols-2">
        <div className="relative aspect-[16/8.5] overflow-hidden rounded-2xl bg-ink sm:aspect-[16/10] sm:rounded-[2rem] lg:aspect-square">
          <Image
            src="/images/ingredients.webp"
            alt="Rozłożony na warstwy burger: bułka, pomidor, cebula, ser, wołowina i sałata"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </div>

        <div>
          <h2 id="ingredients-title" className="font-serif text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl">
            Zawsze <span className="text-primary">świeże</span> składniki.
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:mt-4 sm:text-lg">
            Dobry burger zaczyna się długo przed grillem. Dlatego każdy składnik wybieramy tak, jakbyśmy gotowali dla siebie.
          </p>

          <div className="relative mt-5 sm:mt-8">
            <span aria-hidden="true" className="absolute bottom-8 left-[0.7rem] top-8 w-px bg-[#eadfd8] sm:hidden" />
            <ul className="grid gap-3 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-5">
              {points.map(({ title, text, image }) => (
                <li key={title} className="relative flex min-h-[4.5rem] items-center gap-3 pl-7 sm:gap-4 sm:pl-0">
                  <span aria-hidden="true" className="absolute left-[0.45rem] top-1/2 size-2.5 -translate-y-1/2 rounded-full border-2 border-[#fbf8f4] bg-primary shadow-[0_0_0_1px_rgba(224,32,28,0.12)] sm:hidden" />
                  <span className="relative size-[3.65rem] shrink-0 overflow-hidden rounded-full bg-[#fff0e9] shadow-[0_4px_14px_rgba(60,35,22,0.1)] sm:size-[4.5rem]">
                    <Image src={image} alt="" fill sizes="72px" className="object-cover" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold leading-snug sm:text-base">{title}</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <a href="#menu" className="mt-5 inline-flex min-h-11 items-center gap-4 rounded-full border border-primary px-5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white sm:mt-7 sm:min-h-12 sm:px-7 sm:text-base">
            Poznaj nasze burgery <ArrowRight className="size-5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  )
}
