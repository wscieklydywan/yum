import { Crown, PiggyBank, Star } from 'lucide-react'
import { ClubProfileShortcuts } from './club-member-sections'

export function ClubProfileOverview({ displayName, fullName, email, role, points, tierName, savings, onOrder }: {
  displayName: string
  fullName: string | null
  email: string
  role: string
  points: number
  tierName: string
  savings: number
  onOrder: () => void
}) {
  const stats = [
    { label: 'Twoje Stars', value: points.toLocaleString('pl-PL'), icon: Star },
    { label: 'Poziom klubu', value: tierName, icon: Crown },
    { label: 'Oszczędności', value: savings.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' }), icon: PiggyBank },
  ]

  return (
    <section aria-label="Podsumowanie Twojego członkostwa" className="overflow-hidden rounded-3xl border border-border/70 bg-card">
      <div className="flex min-w-0 flex-col gap-5 bg-club-warm/60 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-2xl bg-ink text-xl font-bold text-club-gold sm:size-16 sm:text-2xl">{displayName.charAt(0).toLocaleUpperCase('pl-PL')}</span>
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Dobrze być w klubie</p>
            <h2 className="break-words text-lg font-bold tracking-tight sm:text-xl">{fullName || displayName}</h2>
            <p title={email} className="mt-1 truncate whitespace-nowrap text-[11px] leading-relaxed text-muted-foreground min-[400px]:text-xs">{email}</p>
          </div>
        </div>
        <ClubProfileShortcuts role={role} onOrder={onOrder} />
      </div>
      <dl className="grid divide-y divide-border/70 border-t border-border/70 min-[380px]:grid-cols-3 min-[380px]:divide-x min-[380px]:divide-y-0">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex min-w-0 items-center justify-between gap-3 px-5 py-4 min-[380px]:flex-col min-[380px]:items-start min-[380px]:gap-2 sm:px-6 sm:py-5">
            <dt className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground sm:text-xs"><Icon className="size-3.5 shrink-0 text-primary" aria-hidden="true" />{label}</dt>
            <dd className="break-words text-right text-sm font-bold tracking-tight tabular-nums min-[380px]:text-left sm:text-lg">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
