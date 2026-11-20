import Link from 'next/link'
import { CheckCircle2, Gift, ShoppingBag, Star } from 'lucide-react'

const perks = [
  { icon: Star, text: 'Zbierasz punkty za każde zamówienie' },
  { icon: Gift, text: 'Wymieniasz punkty na darmowe jedzenie' },
]

export function ClubActivatedCard({ firstName, email }: { firstName: string; email: string }) {
  return (
    <section
      aria-labelledby="activated-heading"
      className="flex flex-col items-center gap-6 rounded-3xl bg-card p-6 text-center shadow-sm ring-1 ring-border sm:p-8"
    >
      <div className="grid size-16 place-items-center rounded-full bg-primary/10">
        <CheckCircle2 className="size-9 text-primary" aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Yummy Club</p>
        <h1 id="activated-heading" className="text-balance text-2xl font-bold sm:text-3xl">
          {firstName ? `Gotowe, ${firstName}!` : 'Gotowe!'} Konto aktywowane
        </h1>
        <p className="text-pretty text-muted-foreground">
          Twój adres <span className="font-medium text-foreground">{email}</span> został potwierdzony. Jesteś już
          zalogowany i możesz korzystać z Yummy Club.
        </p>
      </div>

      <ul className="flex w-full flex-col gap-2">
        {perks.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3 text-left text-sm font-medium">
            <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {text}
          </li>
        ))}
      </ul>

      <div className="flex w-full flex-col gap-2">
        <Link
          href="/#menu"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <ShoppingBag className="size-4" aria-hidden="true" />
          Zamów pierwsze danie
        </Link>
        <Link
          href="/yummy-club"
          className="inline-flex h-12 items-center justify-center rounded-full bg-card px-6 font-semibold ring-1 ring-border transition-colors hover:bg-muted"
        >
          Przejdź do mojego konta
        </Link>
      </div>
    </section>
  )
}
