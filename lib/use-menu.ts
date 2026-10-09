'use client'

import useSWR from 'swr'
import type { Category, MenuCategory, Product } from './menu'
import { useMenuRealtime } from './use-menu-realtime'

async function fetchMenu(url: string): Promise<Product[]> {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (!response.ok) throw new Error('Nie udało się pobrać menu')
  return response.json()
}

async function fetchCategories(url: string): Promise<MenuCategory[]> {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (!response.ok) throw new Error('Nie udało się pobrać kategorii menu')
  return response.json()
}

export function useMenuCategories() {
  useMenuRealtime()
  const { data, error, isLoading } = useSWR<MenuCategory[]>('/api/menu/categories', fetchCategories, {
    revalidateOnFocus: true,
  })
  return { categories: data ?? [], error, isLoading }
}

export type StaffProduct = Product & { disabled?: boolean }

export function useMenu({ includeUnavailable = false }: { includeUnavailable?: boolean } = {}) {
  useMenuRealtime()
  const key = includeUnavailable ? '/api/menu/catalog?include=unavailable' : '/api/menu/catalog'
  const { data, error, isLoading, mutate } = useSWR<StaffProduct[]>(key, fetchMenu, {
    revalidateOnFocus: true,
  })
  return { products: data ?? [], error, isLoading, refresh: mutate }
}
