'use client'

import { useMemo } from 'react'
import { useMenu, useMenuCategories } from '@/lib/use-menu'

export function useGroupedMenu({ includeUnavailable = false }: { includeUnavailable?: boolean } = {}) {
  const menu = useMenu({ includeUnavailable })
  const { categories } = useMenuCategories()
  const groups = useMemo(() => {
    const known = new Set(categories.map((category) => category.id))
    const result: { id: string; label: string; image?: string; products: typeof menu.products }[] = categories.map((category) => ({ id: category.id, label: category.label, image: category.image || undefined, products: menu.products.filter((product) => product.category === category.id) }))
    const other = menu.products.filter((product) => !known.has(product.category))
    if (other.length) result.push({ id: '__other', label: 'Inne', products: other })
    return result.filter((group) => group.products.length > 0)
  }, [categories, menu.products])
  return { ...menu, groups }
}
