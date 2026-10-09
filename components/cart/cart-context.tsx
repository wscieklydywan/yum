'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { Product } from '@/lib/menu'
import type { MenuSelection } from '@/lib/menu-config'

export type CartLine = {
  key: string
  productId: string
  name: string
  image: string
  unitPrice: number
  quantity: number
  details: string[]
  selection?: MenuSelection
  /** Menu category at the time of adding, so the line can still be grouped when the product drops out of the menu. */
  category?: string
}

type CartContextValue = {
  lines: CartLine[]
  count: number
  subtotal: number
  isOpen: boolean
  setOpen: (open: boolean) => void
  activeProduct: Product | null
  openProduct: (product: Product | null) => void
  addLine: (line: Omit<CartLine, 'key'>) => void
  updateQuantity: (key: string, quantity: number) => void
  removeLine: (key: string) => void
  replaceLines: (changes: { key: string; next: Omit<CartLine, 'key'> | null }[]) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

const MAX_QUANTITY = 20

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [isOpen, setOpen] = useState(false)
  const [activeProduct, openProduct] = useState<Product | null>(null)

  const addLine = useCallback((line: Omit<CartLine, 'key'>) => {
    const key = `${line.productId}|${line.details.join('|')}`
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key)
      if (existing) {
        return prev.map((l) =>
          l.key === key
            ? { ...l, quantity: Math.min(MAX_QUANTITY, l.quantity + line.quantity) }
            : l,
        )
      }
      return [...prev, { ...line, key }]
    })
  }, [])

  const updateQuantity = useCallback((key: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.key !== key)
        : prev.map((l) =>
            l.key === key ? { ...l, quantity: Math.min(MAX_QUANTITY, quantity) } : l,
          ),
    )
  }, [])

  const removeLine = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key))
  }, [])

  const replaceLines = useCallback((changes: { key: string; next: Omit<CartLine, 'key'> | null }[]) => {
    setLines((prev) => {
      const byKey = new Map(changes.map((change) => [change.key, change.next]))
      const result: CartLine[] = []
      for (const line of prev) {
        if (!byKey.has(line.key)) {
          result.push(line)
          continue
        }
        const next = byKey.get(line.key)
        if (!next) continue
        const key = `${next.productId}|${next.details.join('|')}`
        const existing = result.find((entry) => entry.key === key)
        if (existing) existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + next.quantity)
        else result.push({ ...next, key })
      }
      return result
    })
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const value = useMemo(() => {
    const count = lines.reduce((sum, l) => sum + l.quantity, 0)
    const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
    return {
      lines,
      count,
      subtotal,
      isOpen,
      setOpen,
      activeProduct,
      openProduct,
      addLine,
      updateQuantity,
      removeLine,
      replaceLines,
      clear,
    }
  }, [lines, isOpen, activeProduct, addLine, updateQuantity, removeLine, replaceLines, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
