'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Category, MenuCategory } from '@/lib/menu'
import { cn } from '@/lib/utils'

export function formatCategoryLabel(label: string) {
  const lower = label.toLocaleLowerCase('pl-PL')
  return lower.charAt(0).toLocaleUpperCase('pl-PL') + lower.slice(1)
}

export function MenuCategoryBar({
  categories,
  active,
  onSelect,
}: {
  categories: MenuCategory[]
  active: Category | null
  onSelect: (id: Category) => void
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: true, end: false })

  const updateEdges = () => {
    const scroller = scrollerRef.current
    if (!scroller) return
    setEdges({
      start: scroller.scrollLeft <= 4,
      end: scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 4,
    })
  }

  useEffect(() => {
    updateEdges()
    const scroller = scrollerRef.current
    if (!scroller) return
    const observer = new ResizeObserver(updateEdges)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [categories.length])

  useEffect(() => {
    if (!active) return
    const scroller = scrollerRef.current
    const tab = scroller?.querySelector<HTMLElement>(`[data-category="${CSS.escape(active)}"]`)
    if (!scroller || !tab) return
    const target = tab.offsetLeft - scroller.clientWidth / 2 + tab.clientWidth / 2
    scroller.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  }, [active])

  const scrollBy = (direction: 1 | -1) =>
    scrollerRef.current?.scrollBy({ left: direction * scrollerRef.current.clientWidth * 0.7, behavior: 'smooth' })

  return (
    <div className="sticky top-14 z-30 -mx-3 border-b border-border/60 bg-background/90 backdrop-blur-md sm:top-16 sm:-mx-6 lg:-mx-8">
      <div className="relative mx-auto max-w-7xl">
        <div
          ref={scrollerRef}
          role="tablist"
          aria-label="Kategorie menu"
          onScroll={updateEdges}
          className="flex gap-1.5 overflow-x-auto scroll-smooth scroll-px-3 px-3 py-2.5 [scrollbar-width:none] sm:gap-2 sm:px-6 sm:py-3 lg:px-8 [&::-webkit-scrollbar]:hidden"
        >
          {categories.map((category) => {
            const selected = active === category.id
            return (
              <button
                key={category.id}
                type="button"
                role="tab"
                data-category={category.id}
                aria-selected={selected}
                onClick={() => onSelect(category.id)}
                className={cn(
                  'h-9 shrink-0 whitespace-nowrap rounded-full px-4 text-[13px] font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:h-10 sm:px-5 sm:text-sm',
                  selected
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-card text-foreground/80 ring-1 ring-border hover:text-foreground hover:ring-foreground/30',
                )}
              >
                {formatCategoryLabel(category.label)}
              </button>
            )
          })}
        </div>

        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-background to-transparent transition-opacity',
            edges.start && 'opacity-0',
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent transition-opacity',
            edges.end && 'opacity-0',
          )}
        />
        <ScrollButton direction={-1} hidden={edges.start} onClick={() => scrollBy(-1)} />
        <ScrollButton direction={1} hidden={edges.end} onClick={() => scrollBy(1)} />
      </div>
    </div>
  )
}

function ScrollButton({ direction, hidden, onClick }: { direction: 1 | -1; hidden: boolean; onClick: () => void }) {
  const Icon = direction === 1 ? ChevronRight : ChevronLeft
  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={-1}
      className={cn(
        'absolute top-1/2 hidden size-8 -translate-y-1/2 place-items-center rounded-full bg-card shadow-md ring-1 ring-border transition-opacity hover:bg-muted md:grid',
        direction === 1 ? 'right-2' : 'left-2',
        hidden && 'pointer-events-none opacity-0',
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span className="sr-only">{direction === 1 ? 'Następne kategorie' : 'Poprzednie kategorie'}</span>
    </button>
  )
}
