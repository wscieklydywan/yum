'use client'

import Link from 'next/link'
import { ChevronLeft, ShoppingBag } from 'lucide-react'
import { Logo } from '@/components/yummy/logo'
import { useCart } from '@/components/cart/cart-context'

export function ClubPageHeader({ isMember = false }: { isMember?: boolean }) {
  const { count, setOpen } = useCart()
  const cartClass = 'relative grid size-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:size-10'

  return (
    <header className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:h-20 sm:px-6 lg:px-8">
      <Link
        href="/"
        aria-label="Wróć na stronę główną"
        className="grid size-9 place-items-center rounded-full bg-card shadow-sm ring-1 ring-border transition-colors hover:bg-muted standalone:hidden sm:size-11"
      >
        <ChevronLeft className="size-4 sm:size-5" aria-hidden="true" />
      </Link>

      <Link href="/" aria-label="Yummy – strona główna" className="absolute left-1/2 -translate-x-1/2">
        <Logo priority className="h-9 sm:h-11" />
      </Link>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {isMember ? (
          <button type="button" onClick={() => setOpen(true)} aria-label={`Otwórz koszyk, ${count} ${count === 1 ? 'produkt' : 'produktów'}`} className={cartClass}>
            <ShoppingBag className="size-3.5 sm:size-4" aria-hidden="true" />
            {count > 0 && <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-[#f5b936] px-1 text-[9px] font-black leading-4 text-[#17110d]">{count > 99 ? '99+' : count}</span>}
          </button>
        ) : (
          <Link href="/#menu" aria-label="Przejdź do menu i koszyka" className={`${cartClass} standalone:hidden`}>
            <ShoppingBag className="size-3.5 sm:size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </header>
  )
}
