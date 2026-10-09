'use client'

import { useMemo, useState } from 'react'
import { Coffee, CupSoda, Hamburger, IceCreamCone, Leaf, Package, Popcorn, Salad, Search, UtensilsCrossed } from 'lucide-react'
import type { Category } from '@/lib/menu'
import { useMenu, useMenuCategories } from '@/lib/use-menu'
import { ProductCard } from './product-card'
import { ProductGridSkeleton } from './product-card-skeleton'
import { SectionHeading } from './section-heading'
import { cn } from '@/lib/utils'

const categoryIconRules: [RegExp, typeof Hamburger][] = [
  [/burger|dublet|wrap/, Hamburger],
  [/zestaw|box/, Package],
  [/frytk|dodatk|nugget/, Popcorn],
  [/sa-atk|salat/, Salad],
  [/vege/, Leaf],
  [/milkshake|deser|pychotk/, IceCreamCone],
  [/cafe|kaw/, Coffee],
  [/napoj/, CupSoda],
]

function categoryIcon(id: Category) {
  return categoryIconRules.find(([pattern]) => pattern.test(id))?.[1] ?? UtensilsCrossed
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
  const active = selected ?? categories[0]?.id ?? ''
  const setActive = setSelected

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q) {
      return products.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
      )
    }
    return products.filter((p) => p.category === active)
  }, [active, query, products])

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

      <div role="tablist" aria-label="Kategorie menu" className="-mx-3 -mb-3 mt-1 flex gap-1.5 overflow-x-auto px-3 pb-5 pt-2 [scrollbar-width:none] sm:mx-0 sm:mb-0 sm:mt-10 sm:flex-wrap sm:gap-3 sm:overflow-visible sm:px-0 sm:py-2">
        {categories.map((cat) => {
          const Icon = categoryIcon(cat.id)
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
              }}
              className={cn(
                'flex min-h-10 shrink-0 flex-row items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-semibold transition-colors sm:justify-center sm:gap-2 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm',
                selected
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                  : 'bg-card text-foreground ring-1 ring-border hover:bg-muted',
              )}
            >
              <Icon className="size-4 shrink-0 sm:size-6" aria-hidden="true" />
              <span className="whitespace-nowrap">{cat.label}</span>
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

      <div className="pt-5 md:hidden">
          <section aria-labelledby="mobile-category-title">
            <h2 id="mobile-category-title" className="mb-3 text-lg font-extrabold tracking-tight">
              {query ? `Wyniki dla „${query}”` : categories.find((category) => category.id === active)?.label}
            </h2>
            {isLoading ? <ProductGridSkeleton count={6} className="grid grid-cols-2 gap-2.5" /> : visible.length > 0 ? (
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
      </div>

      <div className="mt-4 hidden items-baseline justify-between sm:mt-8 md:flex">
        <h3 className="text-lg font-bold sm:text-2xl">
          {query ? `Wyniki dla „${query}”` : categories.find((c) => c.id === active)?.label}
        </h3>
        <p className={cn('text-sm text-muted-foreground', isLoading && 'invisible')} aria-live="polite">
          {visible.length} {visible.length === 1 ? 'pozycja' : visible.length < 5 && visible.length > 1 ? 'pozycje' : 'pozycji'}
        </p>
      </div>

      {isLoading ? (
        <ProductGridSkeleton count={8} className="mt-6 hidden gap-6 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" />
      ) : visible.length > 0 ? (
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
