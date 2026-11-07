import { Gamepad2, House, Ticket, UserRound, UtensilsCrossed } from 'lucide-react'

export type ClubTab = 'home' | 'menu' | 'coupons' | 'game' | 'profile'

const items: { id: ClubTab; label: string; icon: typeof UtensilsCrossed }[] = [
  { id: 'home', label: 'Start', icon: House },
  { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
  { id: 'coupons', label: 'Kupony', icon: Ticket },
  { id: 'game', label: 'Gra', icon: Gamepad2 },
  { id: 'profile', label: 'Profil', icon: UserRound },
]

// Android doesn't let a PWA recolor its system navigation bar, so in installed (standalone) mode the nav
// takes the system bar's light grey instead; in a regular browser tab it keeps the card color.
export function ClubBottomNav({ activeTab, onNavigate }: { activeTab: ClubTab; onNavigate: (tab: ClubTab) => void }) {
  return (
    <nav
      aria-label="Nawigacja Yummy Club"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] [@media(display-mode:standalone)]:border-black/[0.06] [@media(display-mode:standalone)]:bg-[#f4f3f1] shadow-[0_-4px_16px_-10px_rgba(40,22,8,0.18)]"
    >
      <ul className="mx-auto grid w-full max-w-xl grid-cols-5 px-1">
        {items.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id
          return (
            <li key={id} className="flex">
              <button
                type="button"
                onClick={() => onNavigate(id)}
                aria-current={active ? 'page' : undefined}
                className={`group flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-xl text-[10.5px] font-semibold tracking-wide transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-200 ${
                    active ? 'bg-primary/10' : 'group-hover:bg-foreground/5'
                  }`}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.3 : 1.9} aria-hidden="true" />
                </span>
                <span className="leading-none">{label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
