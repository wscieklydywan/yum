'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, CupSoda, Hamburger, Package, Popcorn, Search } from 'lucide-react'
import { categories, products, type Category } from '@/lib/menu'
import { ProductCard } from './product-card'
import { SectionHeading } from './section-heading'
import { cn } from '@/lib/utils'

const categoryIcons: Record<Category, typeof Hamburger> = {
  burgery: Hamburger,
  zestawy: Package,
  dodatki: Popcorn,
  napoje: CupSoda,
}

export function MenuSection() {
  const [active, setActive] = useState<Category>('burgery')
  const [query, setQuery] = useState('')
  const [showAllMobile, setShowAllMobile] = useState(false)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q) {
      return products.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
      )
    }
    return products.filter((p) => p.category === active)
  }, [active, query])

  const mobileBestsellers = products
    .filter((product) => product.id === 'classic' || product.id === 'bbq-bacon')
    .sort((first, second) => first.id === 'classic' ? -1 : second.id === 'classic' ? 1 : 0)
  const mobileNewProducts = products.filter((product) => product.badge === 'Nowość')

  return (
    <section id="menu" aria-label="Menu Yummy" className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-12 md:py-16 lg:px-8">
      <div className="hidden md:block">
        <SectionHeading
          id="menu-title"
          eyebrow="Głodny?"
          title="Nasze menu"
          description="Burgery. Zestawy. Frytki. I wiele więcej – wszystko przygotowywane na bieżąco."
        />
      </div>

      <div role="tablist" aria-label="Kategorie menu" className="mt-3 flex flex-wrap gap-1.5 py-1 sm:mt-10 sm:gap-3 sm:py-2 md:grid md:grid-cols-4 lg:flex">
        {categories.map((cat) => {
          const Icon = categoryIcons[cat.id]
          const selected = !query && active === cat.id
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              data-category={cat.id}
              aria-selected={selected}
              onClick={() => {
                setActive(cat.id)
                setQuery('')
                setShowAllMobile(false)
              }}
              className={cn(
                cat.id === 'burgery' ? 'order-1 md:order-none' : cat.id === 'dodatki' ? 'order-2 md:order-none' : cat.id === 'napoje' ? 'order-3 md:order-none' : 'order-4 md:order-none',
                'flex min-h-10 shrink-0 flex-row items-center gap-1.5 rounded-full px-2 py-2 text-[11px] font-semibold transition-colors sm:min-w-28 sm:justify-center sm:gap-2 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-sm md:flex-col lg:flex-row',
                selected
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                  : 'bg-card text-foreground ring-1 ring-border hover:bg-muted',
              )}
            >
              <Icon className="size-4 shrink-0 sm:size-6" aria-hidden="true" />
              <span className="whitespace-nowrap">{cat.id === 'dodatki' ? <><span className="sm:hidden">Frytki</span><span className="hidden sm:inline">{cat.label}</span></> : cat.label}</span>
            </button>
          )
        })}
      </div>

      <label className="relative mt-3 block sm:mt-5">
        <span className="sr-only">Szukaj w menu</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Szukaj burgera, zestawu lub dodatku…"
          className="h-11 w-full rounded-full bg-card pl-11 pr-4 text-sm shadow-sm outline-none ring-1 ring-border transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary sm:h-12"
        />
      </label>

      <div className="space-y-7 pt-5 md:hidden">
        {!showAllMobile && !query && active === 'burgery' ? (
          <>
            <section aria-labelledby="mobile-bestsellers-title">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="mobile-bestsellers-title" className="text-lg font-extrabold tracking-tight">Nasze bestsellery</h2>
                <button
                  type="button"
                  onClick={() => setShowAllMobile(true)}
                  className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-primary"
                >
                  Zobacz wszystkie <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </div>
              <div key={`mobile-bestsellers-${active}-${query}`} className="grid grid-cols-2 gap-2.5">
                {mobileBestsellers.map((product, index) => (
                  <ProductCard key={product.id} product={product} animationDelay={Math.min(index * 24, 120)} />
                ))}
              </div>
            </section>

            {mobileNewProducts.length > 0 && (
              <section aria-labelledby="mobile-new-title">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 id="mobile-new-title" className="text-lg font-extrabold tracking-tight">Nowości</h2>
                  <button
                    type="button"
                    onClick={() => setShowAllMobile(true)}
                    className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-primary"
                  >
                    Zobacz wszystkie <ChevronRight className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <div key={`mobile-new-${active}-${query}`} className="grid grid-cols-2 gap-2.5">
                  {mobileNewProducts.map((product, index) => (
                    <ProductCard key={product.id} product={product} animationDelay={Math.min(index * 24, 120)} />
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <section aria-labelledby="mobile-category-title">
            <h2 id="mobile-category-title" className="mb-3 text-lg font-extrabold tracking-tight">
              {query ? `Wyniki dla „${query}”` : categories.find((category) => category.id === active)?.label}
            </h2>
            {visible.length > 0 ? (
              <div key={`mobile-results-${active}-${query}`} className="grid grid-cols-2 gap-2.5">
                {visible.map((product, index) => (
                  <ProductCard key={product.id} product={product} animationDelay={Math.min(index * 24, 120)} />
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-card p-5 text-center text-sm text-muted-foreground ring-1 ring-border">
                Nic nie znaleźliśmy. Spróbuj wpisać „bekon” albo „frytki”.
              </p>
            )}
          </section>
        )}
      </div>

      <div className="mt-4 hidden items-baseline justify-between sm:mt-8 md:flex">
        <h3 className="text-lg font-bold sm:text-2xl">
          {query ? `Wyniki dla „${query}”` : categories.find((c) => c.id === active)?.label}
        </h3>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {visible.length} {visible.length === 1 ? 'pozycja' : visible.length < 5 && visible.length > 1 ? 'pozycje' : 'pozycji'}
        </p>
      </div>

      {visible.length > 0 ? (
        <div key={`desktop-results-${active}-${query}`} className="mt-4 hidden grid-cols-2 gap-3 sm:mt-6 sm:gap-6 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((product, index) => (
            <ProductCard key={product.id} product={product} animationDelay={Math.min(index * 24, 120)} />
          ))}
        </div>
      ) : (
        <p className="mt-6 hidden rounded-3xl bg-card p-10 text-center text-muted-foreground ring-1 ring-border md:block">
          Nic nie znaleźliśmy. Spróbuj wpisać „bekon” albo „frytki”.
        </p>
      )}
    </section>
  )
}
