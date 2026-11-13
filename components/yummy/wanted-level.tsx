'use client'

import { Star } from 'lucide-react'
import { useCart } from '@/components/cart/cart-context'
import { cn } from '@/lib/utils'

const MAX_STARS = 5

/** GTA-style wanted level: each item in the cart lights up one more star, lit stars flash like in the game. */
export function WantedLevel({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' }) {
  const { count } = useCart()
  const level = Math.max(1, Math.min(MAX_STARS, count))

  return (
    <div role="status" aria-label={`Poziom Wanted: ${level} z ${MAX_STARS} gwiazdek`} className={cn('flex select-none gap-0.5', className)}>
      {Array.from({ length: MAX_STARS }, (_, index) => {
        const lit = index < level
        return (
          <Star
            key={index}
            aria-hidden="true"
            className={cn(
              'stroke-[2.5]',
              size === 'sm' ? 'size-3.5' : 'size-4 sm:size-5',
              lit ? 'gta-star-flash fill-white text-black' : 'fill-black/50 text-white/40',
            )}
          />
        )
      })}
    </div>
  )
}
