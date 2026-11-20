import { ChevronDown } from 'lucide-react'

const questions = [
  {
    q: 'Ile to kosztuje?',
    a: 'Nic. Konto w Yummy Club jest darmowe, a przeniesienie punktów również.',
  },
  {
    q: 'Kiedy zobaczę punkty na nowym koncie?',
    a: 'Zwykle w ciągu 1–2 dni. Gdy tylko je dopiszemy, zobaczysz je w Yummy Club i od razu możesz wymieniać je na nagrody.',
  },
  {
    q: 'Nie pamiętam, jakiego numeru używałem.',
    a: 'Podaj numer, którego używasz na co dzień. Jeśli nie znajdziemy punktów, dostaniesz informację i możesz zmienić numer w ustawieniach konta, a potem spróbować jeszcze raz.',
  },
  {
    q: 'Mam już konto w nowym Yummy Club.',
    a: 'Super! Zaloguj się na tej stronie (zakładka „Logowanie”) i kliknij „Odzyskaj punkty”.',
  },
  {
    q: 'Czy mogę dalej korzystać ze starej aplikacji?',
    a: 'Nie – stara aplikacja nie jest już obsługiwana. Wszystkie zamówienia, punkty i nagrody znajdziesz teraz w Yummy Club.',
  },
]

export function RecoveryFaq() {
  return (
    <section aria-labelledby="recovery-faq-title" className="mt-14 max-w-3xl">
      <h2 id="recovery-faq-title" className="text-xl font-black tracking-tight sm:text-2xl">
        Najczęstsze pytania
      </h2>
      <div className="mt-4 flex flex-col gap-2">
        {questions.map((item) => (
          <details key={item.q} className="group rounded-2xl bg-card ring-1 ring-border/70 open:shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold [&::-webkit-details-marker]:hidden">
              {item.q}
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Masz inny problem? Zapytaj nas przy następnej wizycie w Yummy – chętnie pomożemy.
      </p>
    </section>
  )
}
