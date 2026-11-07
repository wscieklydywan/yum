import { UtensilsCrossed } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CategoryIcon({ image, className }: { image?: string; className?: string }) {
  return <span className={cn('relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-muted ring-1 ring-border', className)} aria-hidden="true">
    {image
      ? <img src={image} alt="" width={96} height={96} loading="lazy" decoding="async" className="size-full object-cover" />
      : <UtensilsCrossed className="size-1/2 text-muted-foreground" />}
  </span>
}
