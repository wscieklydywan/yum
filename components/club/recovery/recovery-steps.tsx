import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type RecoveryStage = 'account' | 'phone' | 'recover'

const steps = [
  {
    title: 'Załóż konto lub zaloguj się',
    body: 'Podaj ten sam numer telefonu, którego używałeś w starej aplikacji – po nim Cię rozpoznamy.',
  },
  {
    title: 'Kliknij „Odzyskaj punkty”',
    body: 'Jeden przycisk i gotowe. Nie musisz nic przepisywać ani szukać starych danych.',
  },
  {
    title: 'Odbierz punkty na nowym koncie',
    body: 'Sprawdzimy Twoje punkty i dopiszemy je do konta. Zobaczysz je w Yummy Club, gotowe do wymiany na nagrody.',
  },
]

function activeIndex(stage: RecoveryStage) {
  return stage === 'recover' ? 1 : 0
}

export function RecoverySteps({ stage }: { stage: RecoveryStage }) {
  const current = activeIndex(stage)

  return (
    <section aria-labelledby="recovery-steps-title" className="flex flex-col gap-4">
      <h2 id="recovery-steps-title" className="text-xl font-black tracking-tight sm:text-2xl">
        Jak to zrobić? 3 proste kroki
      </h2>
      <ol className="flex flex-col gap-3">
        {steps.map((step, index) => {
          const done = index < current
          const active = index === current
          return (
            <li
              key={step.title}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex gap-4 rounded-2xl p-4 ring-1 transition-colors',
                active ? 'bg-card ring-primary/40 shadow-sm' : 'bg-card/60 ring-border/70',
              )}
            >
              <span
                className={cn(
                  'grid size-9 shrink-0 place-items-center rounded-full text-sm font-black',
                  done ? 'bg-emerald-500 text-white' : active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {done ? <Check className="size-4" aria-hidden="true" /> : index + 1}
                {done && <span className="sr-only">Zrobione</span>}
              </span>
              <div className="min-w-0">
                <p className={cn('font-bold leading-snug', !active && !done && 'text-foreground/80')}>{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
