'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** `tone: 'dark'` switches the progress bars to dark ink for light slides (e.g. the yellow burger of the week). */
export type HeroSlide = { id: string; label: string; content: ReactNode; tone?: 'light' | 'dark' }
type Slide = HeroSlide

const SWIPE_THRESHOLD = 45

/** `ready = false` keeps the progress bars hidden and paused until every slide source has loaded, so their count never jumps. */
export function HeroCarousel({ slides, interval = 3500, ready = true }: { slides: Slide[]; interval?: number; ready?: boolean }) {
  // Tracked by id, so a slide source that loads later (advent, Halloween) never swaps the slide already on screen.
  const [activeId, setActiveId] = useState<string | null>(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [visible, setVisible] = useState(true)
  const rootRef = useRef<HTMLDivElement>(null)
  const swipeStart = useRef<{ id: number; x: number; y: number } | null>(null)
  const suppressClick = useRef(false)

  useEffect(() => {
    const node = rootRef.current
    if (!node || slides.length < 2) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.35 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [slides.length])

  if (slides.length < 2) return <div className="grid">{slides[0]?.content}</div>

  const index = Math.max(0, slides.findIndex((slide) => slide.id === activeId))
  const dark = slides[index]?.tone === 'dark'
  const paused = hovered || focused || !visible || !ready
  const setIndex = (i: number) => setActiveId(slides[i]?.id ?? null)
  const next = () => setIndex((index + 1) % slides.length)
  const prev = () => setIndex((index - 1 + slides.length) % slides.length)

  const finishSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start || start.id !== event.pointerId) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.2) return
    suppressClick.current = true
    if (dx < 0) next()
    else prev()
  }

  return (
    <div
      ref={rootRef}
      role="region"
      aria-roledescription="karuzela"
      aria-label="Wyróżnione"
      className="grid touch-pan-y select-none"
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return
        suppressClick.current = false
        swipeStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
      }}
      onPointerUp={finishSwipe}
      onPointerCancel={() => {
        swipeStart.current = null
      }}
      onClickCapture={(event) => {
        if (!suppressClick.current) return
        suppressClick.current = false
        event.preventDefault()
        event.stopPropagation()
      }}
      onDragStart={(event) => event.preventDefault()}
      onPointerEnter={(event) => event.pointerType === 'mouse' && setHovered(true)}
      onPointerLeave={() => {
        setHovered(false)
        swipeStart.current = null
      }}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false)
      }}
    >
      {slides.map((slide, i) => {
        const active = i === index
        return (
          <div
            key={slide.id}
            role="group"
            aria-roledescription="slajd"
            aria-label={`${i + 1} z ${slides.length}: ${slide.label}`}
            aria-hidden={!active}
            inert={!active}
            className={cn(
              'col-start-1 row-start-1 grid transition-opacity duration-500 ease-out motion-reduce:transition-none',
              active ? 'z-[1] opacity-100' : 'pointer-events-none opacity-0',
            )}
          >
            {slide.content}
          </div>
        )
      })}

      <div className="pointer-events-none relative z-[2] col-start-1 row-start-1 flex items-end justify-end px-5 pb-3 sm:px-10 sm:pb-6 md:pb-8 lg:px-16">
        <div className={cn('flex w-24 gap-1.5 transition-opacity duration-300 sm:w-40', ready ? 'pointer-events-auto opacity-100' : 'opacity-0')}>
          {slides.map((slide, i) => {
            const active = i === index
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Pokaż slajd ${i + 1}: ${slide.label}`}
                aria-current={active}
                className="group flex h-6 flex-1 items-center"
              >
                <span className={cn('relative block h-1 w-full overflow-hidden rounded-full transition-colors', dark ? 'bg-[#2a1a0c]/25 group-hover:bg-[#2a1a0c]/40' : 'bg-white/30 group-hover:bg-white/50')}>
                  {active ? (
                    <span
                      key={index}
                      onAnimationEnd={next}
                      style={{ animationDuration: `${interval}ms`, animationPlayState: paused ? 'paused' : 'running' }}
                      className={cn('hero-progress absolute inset-y-0 left-0 w-full origin-left rounded-full', dark ? 'bg-[#2a1a0c]' : 'bg-white')}
                    />
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
