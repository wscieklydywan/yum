import Link from 'next/link'
import { ArrowRight, Phone } from 'lucide-react'
import { ClubAuthPanel } from '@/components/club/club-auth-panel'
import { ClubPointsRecovery } from '@/components/club/club-points-recovery'
import type { RecoveryStage } from './recovery-steps'

const cardClass = 'rounded-3xl bg-card p-5 shadow-[0_20px_50px_-20px_rgba(80,30,10,0.18)] ring-1 ring-border/70 sm:p-8'

export function RecoveryAction({ stage, phone, returnPath }: { stage: RecoveryStage; phone: string | null; returnPath: string }) {
  if (stage === 'account') {
    return (
      <div className="flex flex-col gap-3">
        <p className="px-1 text-sm font-semibold text-foreground">
          <span className="text-primary">Krok 1.</span> Nie masz jeszcze konta? Wybierz „Rejestracja”.
        </p>
        <ClubAuthPanel initialMode="register" redirectTo={returnPath} />
      </div>
    )
  }

  if (stage === 'phone') {
    return (
      <section aria-labelledby="recovery-phone-title" className={cardClass}>
        <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
          <Phone className="size-5" />
        </span>
        <h2 id="recovery-phone-title" className="mt-4 text-xl font-black tracking-tight">
          Jeszcze tylko numer telefonu
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Uzupełnij numer – ten sam co w starej aplikacji. Potem wróć tutaj i kliknij „Odzyskaj punkty”.
        </p>
        <Link
          href="/yummy-club"
          className="mt-5 flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Uzupełnij numer
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </section>
    )
  }

  return (
    <section aria-label="Odzyskaj punkty" className={cardClass}>
      <p className="mb-4 text-sm font-semibold">
        <span className="text-primary">Krok 2.</span> Jesteś zalogowany – teraz kliknij przycisk poniżej.
      </p>
      <ClubPointsRecovery phone={phone} />
      <Link
        href="/yummy-club"
        className="mt-6 flex items-center justify-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
      >
        Przejdź do Yummy Club
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  )
}
