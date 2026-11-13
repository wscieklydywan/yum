'use client'

import type { Product } from '@/lib/menu'
import { stationOpen, type Station } from '@/lib/restaurant-status'
import { useRestaurantStatus } from '@/lib/use-restaurant-status'

type SlideProduct = Product & { disabled?: boolean }

const stationOf = (product: SlideProduct) => (product as SlideProduct & { station?: Station }).station

/**
 * The slider is part of the cached page, so its "kitchen closed" flag may be older than the page view.
 * The live opening status (already loaded once by the page for the product dialog) decides instead.
 */
export function useLiveOrderable(product: SlideProduct | null): SlideProduct | null {
  const { status } = useRestaurantStatus()
  if (!product) return null
  const station = stationOf(product)
  if (!status || !station) return product
  const disabled = !stationOpen(status, station)
  return disabled === product.disabled ? product : { ...product, disabled }
}
