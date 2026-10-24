'use client'

import { useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { Category } from '@/lib/menu'
import { useMenu, useMenuCategories } from '@/lib/use-menu'
import { ClubProductRow } from '@/components/club/club-product-row'
import { ProductCard } from './product-card'
import { ProductGridSkeleton } from './product-card-skeleton'
import { SectionHeading } from './section-heading'
import { MenuCategoryBar, formatCategoryLabel } from './menu-category-bar'
import { cn } from '@/lib/utils'

function countLabel(count: number) {
  if (count === 1) return '1 pozycja'
  const lastDigit = count % 10
  const lastTwo = count % 100
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} pozycje`
  return `${count} pozycji`
}

export function MenuSection() {
  const [selected, setSelected] = useState<Category | null>(null)
  const [query, setQuery] = useState('')
  const { products, isLoading: productsLoading } = useMenu()
  const { categories: allCategories, isLoading: categoriesLoading } = useMenuCategories()
  const isLoading = productsLoading || categoriesLoading
  const categories = useMemo(
    () => allCategories.filter((category) => products.some((product) => product.category === category.id)),
    [allCategories, products],
  )
  const active = selected ?? categories[0]?.id ?? null
  const searching = query.trim().length > 0

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q) {
      return products.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    }
    return products.filter((p) => p.category === active)
  }, [active, query, products])

  const activeLabel = categories.find((category) => category.id === active)?.label
  const heading = searching ? `Wyniki dla „${query.trim()}”` : activeLabel ? formatCategoryLabel(activeLabel) : 'Menu'
  const resultsKey = `${active}-${query}`
  const barAnchorRef = useRef<HTMLDivElement>(null)

  // When the category bar is pinned, jump back so the new list starts right under it.
  const scrollToListStart = () => {
    const anchor = barAnchorRef.current
    const bar = anchor?.nextElementSibling
    if (!anchor || !(bar instanceof HTMLElement)) return
    const stickyTop = Number.parseFloat(getComputedStyle(bar).top) || 0
    const anchorTop = anchor.getBoundingClientRect().top
    if (anchorTop >= stickyTop - 1) return
    window.scrollTo({ top: window.scrollY + anchorTop - stickyTop, behavior: 'instant' })
  }

  return (
    <section id="menu" aria-label="Menu Yummy" className="mx-auto max-w-7xl px-3 pb-8 pt-2 sm:px-6 sm:pb-12 md:pb-16 md:pt-12 lg:px-8">
      <div className="hidden md:mb-8 md:block">
        <SectionHeading
          id="menu-title"
          eyebrow="Głodny?"
          title="Nasze menu"
          description="Burgery. Zestawy. Frytki. I wiele więcej – wszystko przygotowywane na bieżąco."
        />
      </div>

      <div ref={barAnchorRef} aria-hidden="true" />
      <MenuCategoryBar
        categories={categories}
        active={searching ? null : active}
        onSelect={(id) => {
          setSelected(id)
          setQuery('')
          scrollToListStart()
        }}
      />

      <div className="mt-4 flex flex-col gap-3 sm:mt-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-baseline justify-between gap-3 md:justify-start">
          <h3 className="text-xl font-black tracking-tight sm:text-2xl">{heading}</h3>
          <p className={cn('shrink-0 text-xs font-semibold text-muted-foreground sm:text-sm', isLoading && 'invisible')} aria-live="polite">
            {countLabel(visible.length)}
          </p>
        </div>
        <label className="relative block md:w-80">
          <span className="sr-only">Szukaj w menu</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Szukaj w menu…"
            className="h-10 w-full rounded-full bg-card pl-10 pr-10 text-sm outline-none ring-1 ring-border transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-search-cancel-button]:hidden"
          />
          {searching && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
              <span className="sr-only">Wyczyść wyszukiwanie</span>
            </button>
          )}
        </label>
      </div>

      {isLoading ? (
        <>
          <ProductGridSkeleton count={4} className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:hidden" />
          <ProductGridSkeleton count={8} className="mt-6 hidden gap-6 lg:grid lg:grid-cols-3 xl:grid-cols-4" />
        </>
      ) : visible.length > 0 ? (
        <>
          <div key={`rows-${resultsKey}`} className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:hidden">
            {visible.map((product, index) => (
              <ClubProductRow key={product.id} product={product} animationDelay={Math.min(index * 24, 120)} />
            ))}
          </div>
          <div key={`grid-${resultsKey}`} className="mt-6 hidden gap-6 lg:grid lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((product, index) => (
              <ProductCard key={product.id} product={product} animationDelay={Math.min(index * 24, 120)} />
            ))}
          </div>
        </>
      ) : (
        <p className="mt-4 rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-border sm:mt-6 sm:p-10">
          Nic nie znaleźliśmy. Spróbuj wpisać „bekon” albo „frytki”.
        </p>
      )}
    </section>
  )
}
