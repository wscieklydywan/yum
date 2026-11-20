'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, LoaderCircle, Minus, Plus, ShoppingBag, Star, X } from 'lucide-react'
import { ProductDetails, type ProductDraftLine } from '@/components/yummy/product-dialog'
import { Logo } from '@/components/yummy/logo'
import { useMenu, useMenuCategories } from '@/lib/use-menu'
import { hasConfigurator } from '@/lib/menu-config'
import { formatPrice, type Product } from '@/lib/menu'
import type { KioskLine } from './kiosk-app'
import { ClubBadge, type ClubState } from './kiosk-phone'

function needsOptions(product: Product) {
  return hasConfigurator(product) || Boolean(product.sizes?.length) || Boolean(product.extras?.length)
}

function startingPrice(product: Product) {
  return product.variants?.length ? Math.min(...product.variants.map((variant) => variant.price)) : product.price
}

function simpleLine(lines: KioskLine[], productId: string) {
  return lines.find((line) => line.productId === productId && line.details.length === 0 && !line.selection)
}

export function KioskMenu({
  lines,
  club,
  onAdd,
  onQuantity,
  onCancel,
  onCheckout,
  onClub,
}: {
  lines: KioskLine[]
  club: ClubState
  onAdd: (line: ProductDraftLine) => void
  onQuantity: (key: string, quantity: number) => void
  onCancel: () => void
  onCheckout: () => void
  onClub: () => void
}) {
  const { categories, isLoading: categoriesLoading } = useMenuCategories({ realtime: true })
  const { products, isLoading: productsLoading, error } = useMenu({ realtime: true })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [bump, setBump] = useState(0)

  const visibleCategories = categories.filter((category) => products.some((item) => item.category === category.id))
  const categoryId = selectedId ?? visibleCategories[0]?.id ?? null
  const category = visibleCategories.find((item) => item.id === categoryId)
  const categoryProducts = products.filter((item) => item.category === categoryId)
  const count = lines.reduce((sum, line) => sum + line.quantity, 0)
  const total = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)
  const loading = categoriesLoading || productsLoading

  function add(line: ProductDraftLine) {
    onAdd(line)
    setBump((current) => current + 1)
  }

  function quickAdd(item: Product) {
    if (needsOptions(item)) return setProduct(item)
    add({ productId: item.id, name: item.name, image: item.image, unitPrice: item.price, quantity: 1, details: [], category: item.category })
  }

  return (
    <>
      <header className="flex shrink-0 flex-col gap-4 bg-background pb-3 pt-4">
        <div className="flex items-center gap-3 px-4 md:px-6">
          <motion.button
            type="button"
            onClick={onCancel}
            whileTap={{ scale: 0.9 }}
            className="grid size-12 shrink-0 place-items-center rounded-full bg-card shadow-sm"
            aria-label="Anuluj zamówienie"
          >
            <X className="size-6" aria-hidden="true" />
          </motion.button>
          <Logo className="h-9 w-auto" />
          <span className="ml-auto flex min-w-0 items-center">
            {club ? (
              <ClubBadge club={club} />
            ) : (
              <motion.button
                type="button"
                onClick={onClub}
                whileTap={{ scale: 0.95 }}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-card px-4 font-bold text-primary shadow-sm"
              >
                <Star className="size-5" aria-hidden="true" />
                <span className="hidden sm:inline">Zbieraj punkty</span>
                <span className="sm:hidden">Punkty</span>
              </motion.button>
            )}
          </span>
        </div>

        <h1 className="px-4 text-3xl font-black tracking-tight md:px-6 md:text-4xl">{category?.label ?? 'Co dzisiaj zamawiasz?'}</h1>

        <nav aria-label="Kategorie" className="overflow-x-auto overscroll-contain px-4 [scrollbar-width:none] md:px-6">
          <ul className="flex w-max gap-2">
            {visibleCategories.map((item) => {
              const active = item.id === categoryId
              return (
                <li key={item.id}>
                  <motion.button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    whileTap={{ scale: 0.94 }}
                    aria-pressed={active}
                    className={`relative h-12 rounded-full px-5 text-base font-bold transition-colors md:h-14 md:px-6 md:text-lg ${active ? 'text-primary-foreground' : 'bg-card text-foreground shadow-sm'}`}
                  >
                    {active && <motion.span layoutId="kiosk-category" className="absolute inset-0 rounded-full bg-primary" />}
                    <span className="relative">{item.label}</span>
                  </motion.button>
                </li>
              )
            })}
          </ul>
        </nav>
      </header>

      <section className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-32 pt-1 md:px-6 md:pb-36">
        {loading && (
          <p className="flex h-full items-center justify-center gap-3 text-xl text-muted-foreground">
            <LoaderCircle className="size-7 animate-spin" aria-hidden="true" />
            Ładowanie menu…
          </p>
        )}
        {error && <p className="py-10 text-center text-xl text-destructive">Nie udało się pobrać menu. Poproś obsługę o pomoc.</p>}

        {!loading && (
          <AnimatePresence mode="wait" initial={false}>
            <motion.ul
              key={categoryId}
              className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { type: 'tween', duration: 0.16, ease: 'easeOut' } }}
              exit={{ opacity: 0, transition: { type: 'tween', duration: 0.08 } }}
            >
              {categoryProducts.map((item) => {
                const inCart = lines.filter((line) => line.productId === item.id).reduce((sum, line) => sum + line.quantity, 0)
                const line = needsOptions(item) ? undefined : simpleLine(lines, item.id)
                return (
                  <li key={item.id}>
                    <ProductRow
                      product={item}
                      inCart={inCart}
                      onOpen={() => (needsOptions(item) ? setProduct(item) : quickAdd(item))}
                      action={
                        line ? (
                          <Stepper
                            name={item.name}
                            quantity={line.quantity}
                            onMinus={() => onQuantity(line.key, line.quantity - 1)}
                            onPlus={() => onQuantity(line.key, line.quantity + 1)}
                          />
                        ) : (
                          <motion.button
                            type="button"
                            onClick={() => quickAdd(item)}
                            whileTap={{ scale: 0.85 }}
                            className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-md"
                            aria-label={`Dodaj ${item.name}`}
                          >
                            <Plus className="size-7" strokeWidth={3} aria-hidden="true" />
                          </motion.button>
                        )
                      }
                    />
                  </li>
                )
              })}
            </motion.ul>
          </AnimatePresence>
        )}
      </section>

      <AnimatePresence>
        {count > 0 && (
          <motion.footer
            className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-background via-background/90 to-transparent px-4 pb-4 pt-8 will-change-transform md:px-6"
            initial={{ y: '100%' }}
            animate={{ y: 0, transition: { type: 'tween', duration: 0.22, ease: [0.25, 1, 0.5, 1] } }}
            exit={{ y: '100%', transition: { type: 'tween', duration: 0.15 } }}
          >
            <motion.button
              type="button"
              onClick={onCheckout}
              whileTap={{ scale: 0.97 }}
              className="pointer-events-auto flex h-20 w-full items-center justify-between gap-3 rounded-full bg-primary pl-3 pr-6 text-primary-foreground shadow-xl shadow-primary/30"
            >
              <span className="inline-flex min-w-0 items-center gap-3">
                <motion.span key={bump} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="relative grid size-14 shrink-0 place-items-center rounded-full bg-black/15">
                  <ShoppingBag className="size-7" aria-hidden="true" />
                  <span className="absolute -right-1 -top-1 grid size-7 place-items-center rounded-full bg-background text-sm font-black text-primary tabular-nums">{count}</span>
                </motion.span>
                <span className="flex flex-col items-start leading-tight">
                  <span className="text-sm font-semibold opacity-90">Twój koszyk</span>
                  <span className="text-2xl font-black tabular-nums">{formatPrice(total)}</span>
                </span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-xl font-black">
                Dalej
                <ChevronRight className="size-7" aria-hidden="true" />
              </span>
            </motion.button>
          </motion.footer>
        )}
      </AnimatePresence>

      <ProductSheet product={product} onClose={() => setProduct(null)} onAdd={(line) => { add(line); setProduct(null) }} />
    </>
  )
}

function ProductRow({ product, inCart, onOpen, action }: { product: Product; inCart: number; onOpen: () => void; action: ReactNode }) {
  return (
    <div className={`flex items-center gap-3 rounded-3xl bg-card p-2 pr-3 shadow-sm ring-2 transition-shadow ${inCart > 0 ? 'ring-primary/60' : 'ring-transparent'}`}>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-4 text-left" aria-label={`${product.name}, ${formatPrice(startingPrice(product))}`}>
        <span className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-muted md:size-28">
          {product.image && <Image src={product.image} alt="" fill sizes="112px" className="object-cover" />}
          <AnimatePresence>
            {inCart > 0 && (
              <motion.span
                key={inCart}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute left-1.5 top-1.5 grid h-7 min-w-7 place-items-center rounded-full bg-primary px-1.5 text-sm font-black text-primary-foreground tabular-nums"
              >
                {inCart}
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="line-clamp-2 text-lg font-black leading-tight text-balance md:text-xl">{product.name}</span>
          <span className="text-lg font-black text-primary tabular-nums">
            {product.variants?.length ? `od ${formatPrice(startingPrice(product))}` : formatPrice(product.price)}
          </span>
        </span>
      </button>
      {action}
    </div>
  )
}

function Stepper({ name, quantity, onMinus, onPlus }: { name: string; quantity: number; onMinus: () => void; onPlus: () => void }) {
  return (
    <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex shrink-0 flex-col items-center gap-1 rounded-full bg-muted p-1 sm:flex-row">
      <motion.button type="button" onClick={onPlus} whileTap={{ scale: 0.85 }} className="order-1 grid size-12 place-items-center rounded-full bg-primary text-primary-foreground sm:order-3" aria-label={`Więcej: ${name}`}>
        <Plus className="size-6" strokeWidth={3} aria-hidden="true" />
      </motion.button>
      <span className="order-2 w-8 text-center text-xl font-black tabular-nums" aria-live="polite">{quantity}</span>
      <motion.button type="button" onClick={onMinus} whileTap={{ scale: 0.85 }} className="order-3 grid size-12 place-items-center rounded-full bg-card shadow-sm sm:order-1" aria-label={quantity === 1 ? `Usuń ${name}` : `Mniej: ${name}`}>
        <Minus className="size-6" strokeWidth={3} aria-hidden="true" />
      </motion.button>
    </motion.span>
  )
}

function ProductSheet({ product, onClose, onAdd }: { product: Product | null; onClose: () => void; onAdd: (line: ProductDraftLine) => void }) {
  useEffect(() => {
    if (!product) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [product, onClose])

  return (
    <AnimatePresence>
      {product && (
        <motion.div
          key="sheet"
          role="dialog"
          aria-modal="true"
          aria-label={product.name}
          className="fixed inset-0 z-50 flex flex-col bg-card will-change-transform"
          initial={{ y: '100%' }}
          animate={{ y: 0, transition: { type: 'tween', duration: 0.24, ease: [0.25, 1, 0.5, 1] } }}
          exit={{ y: '100%', transition: { type: 'tween', duration: 0.18, ease: 'easeIn' } }}
        >
          <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 md:px-6 md:py-4">
            <motion.button
              type="button"
              onClick={onClose}
              whileTap={{ scale: 0.94 }}
              className="inline-flex h-14 shrink-0 items-center gap-2 rounded-full bg-muted pl-3 pr-5 text-lg font-bold md:h-16 md:text-xl"
            >
              <ChevronLeft className="size-7" aria-hidden="true" />
              Wróć do menu
            </motion.button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto w-full max-w-3xl md:[zoom:1.45]">
              <ProductDetails key={product.id} product={product} standalone onAdd={onAdd} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
