import { Crown, House, Percent, UserRound, UtensilsCrossed } from 'lucide-react'

const items = [
  { label: 'Start', href: '/', icon: House },
  { label: 'Menu', href: '/#menu', icon: UtensilsCrossed },
  { label: 'Moje punkty', href: '/yummy-club', icon: Crown, active: true },
  { label: 'Oferty', href: '/#promocje', icon: Percent },
  { label: 'Profil', href: '#konto', icon: UserRound },
]

export function ClubBottomNav() {
  return (
    <nav
      aria-label="Nawigacja"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map(({ label, href, icon: Icon, active }) => (
          <li key={label}>
            <a
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition-colors ${active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" />
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
