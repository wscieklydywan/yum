import { Globe, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'
import { orderSources, type OrderSource } from './order-data'

const ownSystemIcons: Partial<Record<OrderSource, typeof Globe>> = { yummy: Globe, kiosk: Monitor }

/** Platform logo for Glovo / Pyszne.pl, or a red web/kiosk badge for orders from our own systems. */
export function SourceMark({ source, className, decorative }: { source: OrderSource; className?: string; decorative?: boolean }) {
  const meta = orderSources[source]
  const alt = decorative ? '' : meta.label
  if (meta.logo) return <img src={meta.logo} alt={alt} width={40} height={40} className={cn('shrink-0 rounded-md', className)} />
  const Icon = ownSystemIcons[source]
  if (!Icon) return null
  return <span role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : meta.label} aria-hidden={decorative || undefined} title={meta.label} className={cn('grid shrink-0 place-items-center rounded-md bg-[#d92b1f] text-white', className)}>
    <Icon className="size-[55%]" aria-hidden="true" />
  </span>
}

export const hasSourceMark = (source: OrderSource | undefined) => !!source && (!!orderSources[source].logo || source in ownSystemIcons)
