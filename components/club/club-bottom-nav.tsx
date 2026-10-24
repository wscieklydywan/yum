import { Gamepad2, House, Ticket, UserRound, UtensilsCrossed } from 'lucide-react'

export type ClubTab = 'home' | 'menu' | 'coupons' | 'game' | 'profile'

const items: { id: ClubTab; label: string; icon: typeof UtensilsCrossed }[] = [
  { id: 'home', label: 'Start', icon: House },
  { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
  { id: 'coupons', label: 'Kupony', icon: Ticket },
  { id: 'game', label: 'Gra', icon: Gamepad2 },
  { id: 'profile', label: 'Profil', icon: UserRound },
]

export function ClubBottomNav({ activeTab, onNavigate }: { activeTab: ClubTab; onNavigate: (tab: ClubTab) => void }) {
  return (
    <nav
      aria-label="Nawigacja Yummy Club"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md border-t border-border/70 bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(40,22,8,0.06)] lg:bottom-5 lg:rounded-full lg:border lg:pb-0 lg:shadow-lg"
    >
      <ul className="grid grid-cols-5">
        {items.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onNavigate(id)}
                aria-pressed={active}
                className={`flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary lg:h-[3.75rem] ${active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" />
                {label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
