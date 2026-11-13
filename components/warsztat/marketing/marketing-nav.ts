import { BarChart3, CalendarClock, Coins, Crown, Disc3, Ghost, Gift, HandCoins, Info, LayoutDashboard, LayoutTemplate, QrCode, Star, TicketPercent, Undo2, Users, Wallet, type LucideIcon } from 'lucide-react'

export type MarketingItem = { id: string; label: string; hint: string; icon: LucideIcon }
export type MarketingSection = { id: string; label: string; items: MarketingItem[] }

export const MARKETING_VIEW_KEY = 'marketingView'

export const marketingSections: MarketingSection[] = [
  {
    id: 'start',
    label: 'Start',
    items: [
      { id: 'overview', label: 'Pulpit', hint: 'Najważniejsze liczby i skróty', icon: LayoutDashboard },
      { id: 'stats', label: 'Statystyki', hint: 'Obrót, powroty, zdrowie klubu i Stars', icon: BarChart3 },
      { id: 'overview-budget', label: 'Budżet i koszty', hint: 'Ile kosztują rabaty, nagrody i koło, limity', icon: Wallet },
    ],
  },
  {
    id: 'club',
    label: 'Yummy Club',
    items: [
      { id: 'club-tiers', label: 'Poziomy i rabaty', hint: 'Progi Stars i rabat na każdym poziomie', icon: Crown },
      { id: 'club-rate', label: 'Przelicznik Stars', hint: 'Ile Stars za każdą wydaną złotówkę', icon: Coins },
      { id: 'club-rewards', label: 'Nagrody za Stars', hint: 'Co klienci mogą wymienić i za ile', icon: Star },
      { id: 'club-points-payment', label: 'Płacenie punktami', hint: 'Ile złotych obniża 1 Star w koszyku', icon: HandCoins },
    ],
  },
  {
    id: 'customers',
    label: 'Klienci',
    items: [
      { id: 'club-customers', label: 'Baza klientów', hint: 'Szukaj, sprawdzaj saldo, dodawaj Stars', icon: Users },
      { id: 'club-recovery', label: 'Stare punkty', hint: 'Przeniesienie punktów ze starej aplikacji', icon: Undo2 },
    ],
  },
  {
    id: 'discounts',
    label: 'Promocje i kody',
    items: [
      { id: 'promotions', label: 'Promocje', hint: 'Obniżki cen w menu w wybranych terminach', icon: CalendarClock },
      { id: 'codes', label: 'Kody rabatowe', hint: 'Kody do wpisania przy zamówieniu', icon: TicketPercent },
    ],
  },
  {
    id: 'games',
    label: 'Gry i wydarzenia',
    items: [
      { id: 'wheel', label: 'Koło fortuny', hint: 'Codzienne zakręcenie i pula nagród', icon: Disc3 },
      { id: 'advent', label: 'Kalendarz adwentowy', hint: 'Niespodzianka na każdy dzień grudnia', icon: Gift },
      { id: 'halloween', label: 'Gra Halloween', hint: 'Sezonowa gra, nagrody i zwycięzcy', icon: Ghost },
    ],
  },
  {
    id: 'homepage',
    label: 'Zawartość aplikacji',
    items: [
      { id: 'home-slides', label: 'Slider i burger tygodnia', hint: 'Co klienci widzą na starcie aplikacji', icon: LayoutTemplate },
      { id: 'about', label: 'Strona „O nas”', hint: 'Historia, teksty i zdjęcia na stronie /o-nas', icon: Info },
      { id: 'install-qr', label: 'Kod QR instalacji', hint: 'Kod do druku i licznik skanowań', icon: QrCode },
    ],
  },
]

export const marketingItems = marketingSections.flatMap((section) => section.items.map((item) => ({ ...item, section })))
