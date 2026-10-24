import { cn } from '@/lib/utils'

function Bone({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-full bg-muted', className)} />
}

export function ProductCardSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col overflow-hidden rounded-3xl bg-card shadow-sm ring-1 ring-border">
      <div className="aspect-[4/3] animate-pulse bg-muted" />
      <div className="flex flex-1 flex-col p-2.5 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <Bone className="h-3.5 w-3/5 sm:h-5" />
          <Bone className="hidden h-4 w-10 sm:block" />
        </div>
        <Bone className="mt-2.5 h-2.5 w-full sm:mt-3 sm:h-3" />
        <Bone className="mt-1.5 h-2.5 w-4/5 sm:h-3" />
        <div className="mt-auto flex items-center justify-between pt-3 sm:pt-5">
          <Bone className="h-4 w-14 sm:h-6 sm:w-20" />
          <div className="size-9 animate-pulse rounded-full bg-muted sm:size-11" />
        </div>
      </div>
    </div>
  )
}

export function ProductGridSkeleton({ count, className }: { count: number; className?: string }) {
  return (
    <div role="status" aria-label="Wczytujemy menu" className={className}>
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
      <span className="sr-only">Wczytujemy menu…</span>
    </div>
  )
}
