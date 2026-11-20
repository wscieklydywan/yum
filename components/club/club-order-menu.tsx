'use client'

import { useMemo, useState } from 'react'
import { mutate } from 'swr'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronDown, Coffee, CookingPot, CupSoda, Drumstick, Hamburger, IceCreamCone, Leaf, Package, Popcorn, Salad, Search, UtensilsCrossed, X } from 'lucide-react'
import type { Category, MenuCategory, Product } from '@/lib/menu'
import { useMenu, useMenuCategories } from '@/lib/use-menu'
import { cn } from '@/lib/utils'
import { CategoryIcon } from '@/components/warsztat/category-icon'
import { ClubProductRow } from './club-product-row'
import { ClubSectionHeader } from './club-section-header'

const categoryIconRules: [RegExp, typeof Hamburger][] = [
  [/burger|dublet|wrap/, Hamburger],
  [/zestaw|box/, Package],
  [/kurczak|chicken|nugget/, Drumstick],
  [/fryt|dodatk/, Popcorn],
  [/sos|dip/, CookingPot],
  [/sa-atk|salat/, Salad],
  [/vege/, Leaf],
  [/milkshake|deser|pychotk/, IceCreamCone],
  [/cafe|kaw/, Coffee],
  [/napoj/, CupSoda],
]

function fallbackIcon(id: Category) {
  return categoryIconRules.find(([pattern]) => pattern.test(id))?.[1] ?? UtensilsCrossed
}

function pluralItems(count: number) {
  if (count === 1) return 'pozycja'
  const lastDigit = count % 10
  const lastTwo = count % 100
  return lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14) ? 'pozycje' : 'pozycji'
}

const ringClass = 'size-10 ring-2 transition-shadow duration-200'

function CategoryBubble({ category, active }: { category: MenuCategory; active: boolean }) {
  const activeRing = active ? 'ring-primary ring-offset-2 ring-offset-background' : 'ring-transparent'
  if (category.image) return <CategoryIcon image={category.image} className={cn(ringClass, activeRing)} />
  const Icon = fallbackIcon(category.id)
  return (
    <span aria-hidden="true" className={cn('grid shrink-0 place-items-center rounded-full', ringClass, activeRing, active ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground shadow-sm')}>
      <Icon className="size-6" />
    </span>
  )
}

const COLLAPSED_COUNT = 4

function ClubProductList({ products }: { products: Product[] }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? products : products.slice(0, COLLAPSED_COUNT)
  const hidden = products.length - shown.length

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        {shown.map((product, index) => (
          <ClubProductRow key={product.id} product={product} animationDelay={Math.min((index % COLLAPSED_COUNT) * 24, 120)} />
        ))}
      </div>
      {products.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-card text-sm font-bold text-primary ring-1 ring-border transition-colors hover:bg-muted"
        >
          {expanded ? 'Pokaż mniej' : `Pokaż więcej (${hidden})`}
          <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export function ClubOrderMenu() {
  const [selected, setSelected] = useState<Category | null>(null)
  const [query, setQuery] = useState('')
  const { products, isLoading: productsLoading, error: productsError } = useMenu()
  const { categories: allCategories, isLoading: categoriesLoading, error: categoriesError } = useMenuCategories()
  const loadError = productsError || categoriesError
  const categories = useMemo(
    () => allCategories.filter((category) => products.some((product) => product.category === category.id)),
    [allCategories, products],
  )
  const active = selected ?? categories[0]?.id ?? ''
  const searchTerm = query.trim().toLocaleLowerCase('pl-PL')
  const visible = useMemo(
    () => searchTerm
      ? products.filter((product) => `${product.name} ${product.description}`.toLocaleLowerCase('pl-PL').includes(searchTerm))
      : [...products.filter((product) => product.pinned), ...products.filter((product) => product.category === active && !product.pinned)],
    [active, products, searchTerm],
  )
  const isLoading = productsLoading || categoriesLoading
  const heading = searchTerm
    ? `Wyniki dla „${query.trim()}”`
    : categories.find((category) => category.id === active)?.label ?? 'Menu'

  return (
    <section aria-labelledby="club-order-title" className="flex min-w-0 flex-col gap-5 sm:gap-6">
      <ClubSectionHeader id="club-order-title" eyebrow="Świeżo z naszej kuchni" title="Na co masz ochotę?" description="Wybierz coś pysznego i zbieraj Stars za zamówienia." />

      <label className="relative block">
        <span className="sr-only">Szukaj w menu</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Szukaj w menu"
          className="h-12 w-full rounded-2xl bg-card pl-10 pr-10 text-base outline-none ring-1 ring-border/80 transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary sm:text-sm [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">Wyczyść wyszukiwanie</span>
          </button>
        )}
      </label>

      {categoriesLoading ? (
        <div className="-mx-4 flex gap-3 overflow-hidden px-4 pt-1" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5">
              <Skeleton className="size-16 rounded-full" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      ) : (
        <div
          role="group"
          aria-label="Kategorie menu"
          className="-mx-4 flex snap-x gap-2 overflow-x-auto overscroll-x-contain scroll-px-4 px-4 py-1 [scrollbar-width:none] sm:mx-0 sm:scroll-px-1 sm:px-1 [&::-webkit-scrollbar]:hidden"
        >
          {categories.map((category) => {
            const isActive = !searchTerm && active === category.id
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  setSelected(category.id)
                  setQuery('')
                }}
                className={cn('group flex shrink-0 snap-start items-center gap-2.5 rounded-2xl border p-2 pr-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', isActive ? 'border-primary/25 bg-primary/5' : 'border-border/70 bg-card hover:border-primary/25')}
              >
                <CategoryBubble category={category} active={isActive} />
                <span className={cn('max-w-32 text-left text-xs leading-snug', isActive ? 'font-bold text-primary' : 'font-medium text-foreground')}>
                  {category.label}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex items-baseline justify-between gap-2 pt-1">
        <h2 className="min-w-0 break-words text-lg font-bold tracking-tight">{heading}</h2>
        <span className="shrink-0 text-xs font-medium text-muted-foreground" aria-live="polite">
          {isLoading ? 'Ładowanie…' : `${visible.length} ${pluralItems(visible.length)}`}
        </span>
      </div>

      {loadError ? (
        <Alert variant="destructive" className="rounded-2xl p-5">
          <AlertTitle>Nie udało się wczytać menu</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <p>Sprawdź połączenie i spróbuj ponownie. Twoje produkty w koszyku są bez zmian.</p>
            <Button variant="outline" size="lg" onClick={() => { void mutate('/api/menu/catalog'); void mutate('/api/menu/categories') }} className="min-h-11 rounded-full">Spróbuj ponownie</Button>
          </AlertDescription>
        </Alert>
      ) : isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex gap-3 rounded-2xl bg-card p-2 ring-1 ring-border/70">
              <Skeleton className="size-24 rounded-xl" />
              <div className="flex flex-1 flex-col gap-2 py-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="mt-auto h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length ? (
        <ClubProductList key={`${active}-${searchTerm}`} products={visible} />
      ) : (
        <Empty className="rounded-3xl border py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Search aria-hidden="true" /></EmptyMedia>
            <EmptyTitle>{searchTerm ? 'Nie znaleźliśmy takiej pozycji' : 'Tutaj jeszcze coś się gotuje'}</EmptyTitle>
            <EmptyDescription>{searchTerm ? 'Spróbuj innej nazwy lub wróć do wszystkich kategorii.' : 'W tej kategorii nie ma teraz dostępnych pozycji. Zajrzyj do pozostałych.'}</EmptyDescription>
          </EmptyHeader>
          {searchTerm && <EmptyContent><Button variant="outline" size="lg" onClick={() => setQuery('')} className="min-h-11 rounded-full">Wróć do menu</Button></EmptyContent>}
        </Empty>
      )}
    </section>
  )
}
