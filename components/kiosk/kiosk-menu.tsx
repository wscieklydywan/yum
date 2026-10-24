'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight, LoaderCircle, Plus, ShoppingBag, X } from 'lucide-react'
import { ProductDetails, type ProductDraftLine } from '@/components/yummy/product-dialog'
import { useMenu, useMenuCategories } from '@/lib/use-menu'
import { hasConfigurator } from '@/lib/menu-config'
import { formatPrice, type Product } from '@/lib/menu'
import type { KioskLine } from './kiosk-app'

function needsOptions(product: Product) {
  return hasConfigurator(product) || Boolean(product.sizes?.length) || Boolean(product.extras?.length)
}

function startingPrice(product: Product) {
  return product.variants?.length ? Math.min(...product.variants.map((variant) => variant.price)) : product.price
}

export function KioskMenu({
  lines,
  onAdd,
  onCancel,
  onCheckout,
}: {
  lines: KioskLine[]
  onAdd: (line: ProductDraftLine) => void
  onCancel: () => void
  onCheckout: () => void
}) {
  const { categories, isLoading: categoriesLoading } = useMenuCategories({ realtime: true })
  const { products, isLoading: productsLoading, error } = useMenu({ realtime: true })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [toast, setToast] = useState<{ id: number; name: string } | null>(null)

  const visibleCategories = categories.filter((category) => products.some((item) => item.category === category.id))
  const categoryId = selectedId ?? visibleCategories[0]?.id ?? null
  const categoryProducts = products.filter((item) => item.category === categoryId)
  const count = lines.reduce((sum, line) => sum + line.quantity, 0)
  const total = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)
  const loading = categoriesLoading || productsLoading

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 1600)
    return () => window.clearTimeout(timer)
  }, [toast])

  function add(line: ProductDraftLine) {
    onAdd(line)
    setToast({ id: Date.now(), name: line.name })
  }

  function choose(item: Product) {
    if (needsOptions(item)) {
      setProduct(item)
      return
    }
    add({ productId: item.id, name: item.name, image: item.image, unitPrice: item.price, quantity: 1, details: [], category: item.category })
  }

  return (
    <>
      <header className="flex shrink-0 flex-col gap-3 border-b border-border bg-card pb-3 pt-3">
        <div className="flex items-center gap-3 px-4 md:px-6">
          <motion.button
            type="button"
            onClick={onCancel}
            whileTap={{ scale: 0.92 }}
            className="grid size-14 shrink-0 place-items-center rounded-2xl bg-muted"
            aria-label="Anuluj zamówienie"
          >
            <X className="size-7" aria-hidden="true" />
          </motion.button>
          <h1 className="flex-1 truncate text-2xl font-black uppercase md:text-3xl">Co podać?</h1>
        </div>

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
                    className={`relative h-14 rounded-full px-6 text-lg font-black transition-colors ${active ? 'text-primary-foreground' : 'bg-muted text-foreground'}`}
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

      <section className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/40 p-4 md:p-6">
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
              className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4"
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.035 } } }}
            >
              {categoryProducts.map((item) => {
                const inCart = lines.filter((line) => line.productId === item.id).reduce((sum, line) => sum + line.quantity, 0)
                return (
                  <motion.li
                    key={item.id}
                    variants={{ hidden: { opacity: 0, y: 18, scale: 0.96 }, show: { opacity: 1, y: 0, scale: 1 } }}
                  >
                    <ProductTile product={item} inCart={inCart} onClick={() => choose(item)} />
                  </motion.li>
                )
              })}
            </motion.ul>
          </AnimatePresence>
        )}

        <AnimatePresence>
          {toast && (
            <motion.p
              key={toast.id}
              role="status"
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="pointer-events-none sticky bottom-2 mx-auto mt-4 w-fit max-w-full truncate rounded-full bg-foreground px-6 py-3 text-lg font-bold text-background shadow-xl"
            >
              {`Dodano: ${toast.name}`}
            </motion.p>
          )}
        </AnimatePresence>
      </section>

      <footer className="shrink-0 border-t border-border bg-card p-3 md:p-4">
        <motion.button
          type="button"
          onClick={onCheckout}
          disabled={count === 0}
          whileTap={count > 0 ? { scale: 0.97 } : undefined}
          className="flex h-20 w-full items-center justify-between gap-3 rounded-3xl bg-primary pl-4 pr-6 text-primary-foreground transition-opacity disabled:bg-muted disabled:text-muted-foreground"
        >
          <span className="inline-flex min-w-0 items-center gap-3">
            <span className="relative grid size-14 shrink-0 place-items-center rounded-2xl bg-black/10">
              <ShoppingBag className="size-7" aria-hidden="true" />
              <AnimatePresence>
                {count > 0 && (
                  <motion.span
                    key={count}
                    initial={{ scale: 1.8 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-background text-sm font-black text-primary tabular-nums"
                  >
                    {count}
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
            <span className="truncate text-xl font-bold">{count === 0 ? 'Wybierz coś pysznego' : formatPrice(total)}</span>
          </span>
          {count > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 text-xl font-black uppercase">
              Dalej
              <ChevronRight className="size-7" aria-hidden="true" />
            </span>
          )}
        </motion.button>
      </footer>

      <ProductSheet product={product} onClose={() => setProduct(null)} onAdd={(line) => { add(line); setProduct(null) }} />
    </>
  )
}

function ProductTile({ product, inCart, onClick }: { product: Product; inCart: number; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      className={`relative flex h-full w-full flex-col overflow-hidden rounded-3xl bg-card text-left shadow-sm ring-2 transition-shadow ${inCart > 0 ? 'ring-primary' : 'ring-transparent'}`}
    >
      <span className="relative block aspect-square w-full bg-muted">
        {product.image && <Image src={product.image} alt="" fill sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" className="object-cover" />}
        <AnimatePresence>
          {inCart > 0 && (
            <motion.span
              key={inCart}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute left-2 top-2 grid h-9 min-w-9 place-items-center rounded-full bg-primary px-2 text-lg font-black text-primary-foreground tabular-nums shadow-lg"
            >
              {`${inCart}×`}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span className="flex flex-1 flex-col gap-2 p-3 md:p-4">
        <span className="line-clamp-2 text-base font-black leading-tight text-balance md:text-xl">{product.name}</span>
        <span className="mt-auto flex items-center justify-between gap-2">
          <span className="text-base font-black text-primary md:text-lg">
            {product.variants?.length ? `od ${formatPrice(startingPrice(product))}` : formatPrice(product.price)}
          </span>
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground md:size-12" aria-hidden="true">
            <Plus className="size-6" />
          </span>
        </span>
      </span>
    </motion.button>
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
        <motion.div key="sheet" className="fixed inset-0 z-50 flex items-end justify-center md:items-center" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
          <motion.button
            type="button"
            aria-label="Zamknij"
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={product.name}
            className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[2rem] bg-background shadow-2xl md:w-[min(40rem,calc(100vw-2rem))] md:rounded-[2rem]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-3">
              <span className="mx-auto h-1.5 w-14 rounded-full bg-muted-foreground/30 md:hidden" aria-hidden="true" />
              <motion.button
                type="button"
                onClick={onClose}
                whileTap={{ scale: 0.9 }}
                className="absolute right-3 top-3 z-10 grid size-12 place-items-center rounded-full bg-muted"
                aria-label="Zamknij"
              >
                <X className="size-6" aria-hidden="true" />
              </motion.button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <ProductDetails key={product.id} product={product} standalone onAdd={onAdd} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
