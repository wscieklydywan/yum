import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Every slide anchors its content to the bottom, so this row lands in the same spot on all of them. */
export const heroSlideContentClass = 'relative grid min-h-[250px] items-end overflow-hidden px-5 pb-8 pt-6 sm:min-h-[620px] sm:px-10 sm:pb-16 sm:pt-16 md:min-h-[680px] lg:px-16'

export const heroCtaClass =
  'group relative inline-flex h-9 shrink-0 items-center gap-2 rounded-full pl-4 pr-1 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:h-14 sm:gap-3 sm:pl-7 sm:pr-2 sm:text-base'

export function HeroCtaArrow({ className }: { className?: string }) {
  return (
    <span className={cn('grid size-7 place-items-center rounded-full transition-transform group-hover:translate-x-0.5 sm:size-10', className ?? 'bg-white text-primary')}>
      <ArrowRight className="size-4 sm:size-5" aria-hidden="true" />
    </span>
  )
}

/** Fixed-height row: the price always sits above the button on phones and next to it on larger screens, with space reserved even when there is no price. */
export function HeroCtaRow({ children, price, secondary }: { children: ReactNode; price?: ReactNode; secondary?: ReactNode }) {
  return (
    <div className="mt-3 flex h-[3.875rem] flex-col items-start justify-end gap-2 sm:mt-8 sm:h-14 sm:flex-row sm:items-center sm:justify-start sm:gap-5">
      {children}
      {price ? <span className="order-first flex items-baseline gap-2 text-lg font-black leading-none sm:order-none sm:text-3xl">{price}</span> : null}
      {secondary}
    </div>
  )
}
