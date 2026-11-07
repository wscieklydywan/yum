import Image from 'next/image'
import { Star } from 'lucide-react'

export function RecoveryHero({ firstName }: { firstName: string }) {
  return (
    <section aria-labelledby="recovery-title" className="flex flex-col gap-5">
      <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
        <Star className="size-3.5 fill-current" aria-hidden="true" />
        Nowy Yummy Club
      </span>
      <div>
        <h1 id="recovery-title" className="text-balance text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          {firstName ? `${firstName}, Twoje punkty czekają` : 'Twoje punkty czekają na Ciebie'}
        </h1>
        <p className="mt-3 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
          Stara aplikacja Yummy przeszła na emeryturę. Nic nie tracisz – punkty, które tam zebrałeś, przeniesiemy na Twoje nowe konto.
          Zajmie Ci to dosłownie chwilę.
        </p>
      </div>
      <div className="relative aspect-[3/2] w-full overflow-hidden rounded-3xl bg-muted ring-1 ring-border/70">
        <Image
          src="/images/club-points-move.webp"
          alt="Punkty przenoszone ze starego telefonu do nowej aplikacji Yummy Club obok burgera"
          fill
          priority
          sizes="(min-width: 1024px) 40rem, 100vw"
          className="object-cover"
        />
      </div>
    </section>
  )
}
