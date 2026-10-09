import Link from 'next/link'
import { ChevronLeft, MapPin, ShoppingBag } from 'lucide-react'
import { Logo } from '@/components/yummy/logo'

export function ClubPageHeader() {
  return (
    <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:h-20 sm:px-6 lg:px-8">
      <Link
        href="/"
        aria-label="Wróć na stronę główną"
        className="grid size-9 place-items-center rounded-full bg-card shadow-sm ring-1 ring-border transition-colors hover:bg-muted sm:size-11"
      >
        <ChevronLeft className="size-4 sm:size-5" aria-hidden="true" />
      </Link>

      <Link href="/" aria-label="Yummy – strona główna" className="absolute left-1/2 -translate-x-1/2">
        <Logo priority className="h-9 sm:h-11" />
      </Link>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="inline-flex h-8 items-center gap-1 rounded-full bg-card px-2.5 text-[11px] font-medium shadow-sm ring-1 ring-border sm:h-10 sm:px-3.5 sm:text-sm">
          <MapPin className="size-3.5 text-primary sm:size-4" aria-hidden="true" />
          Rybnik
        </span>
        <Link
          href="/#menu"
          aria-label="Przejdź do menu i koszyka"
          className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:size-10"
        >
          <ShoppingBag className="size-3.5 sm:size-4" aria-hidden="true" />
        </Link>
      </div>
    </header>
  )
}
