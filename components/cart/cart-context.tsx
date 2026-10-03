'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { Product } from '@/lib/menu'

export type CartLine = {
  key: string
  productId: string
  name: string
  image: string
  unitPrice: number
  quantity: number
  details: string[]
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
      clear,
    }
  }, [lines, isOpen, activeProduct, addLine, updateQuantity, removeLine, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
