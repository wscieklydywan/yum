import { Crown, Gift, Percent, Star } from 'lucide-react'

const benefits = [
  { icon: Crown, label: '1 punkt za każdą złotówkę' },
  { icon: Gift, label: 'Darmowe jedzenie' },
  { icon: Percent, label: 'Oferty tylko dla członków' },
  { icon: Star, label: 'Specjalne wydarzenia' },
]

export function ClubBenefits() {
  return (
    <section aria-label="Korzyści Yummy Club">
      <ul className="grid grid-cols-4 gap-2 sm:gap-4">
        {benefits.map(({ icon: Icon, label }) => (
          <li
            key={label}
            className="flex flex-col items-center gap-2 rounded-2xl bg-card/70 px-1.5 py-3 text-center shadow-[0_4px_16px_rgba(80,30,10,0.05)] ring-1 ring-border/60 sm:gap-3 sm:rounded-3xl sm:px-3 sm:py-5"
          >
            <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary sm:size-12">
              <Icon className="size-4 sm:size-6" aria-hidden="true" />
            </span>
            <span className="text-[10px] font-medium leading-tight text-foreground text-balance sm:text-sm">{label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
