'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import { LEGAL_DOCUMENTS, LEGAL_EMAIL, type LegalSlug } from '@/lib/legal'
import { cn } from '@/lib/utils'

export function LegalDocuments({
  initialTab = 'regulamin',
  syncUrl = false,
  size = 'default',
}: {
  initialTab?: LegalSlug
  syncUrl?: boolean
  size?: 'default' | 'large'
}) {
  const [active, setActive] = useState<LegalSlug>(initialTab)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const document = LEGAL_DOCUMENTS.find((item) => item.slug === active) ?? LEGAL_DOCUMENTS[0]
  const large = size === 'large'

  function select(slug: LegalSlug) {
    setActive(slug)
    if (syncUrl) window.history.replaceState(null, '', `?dokument=${slug}`)
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = (index + step + LEGAL_DOCUMENTS.length) % LEGAL_DOCUMENTS.length
    select(LEGAL_DOCUMENTS[next].slug)
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        role="tablist"
        aria-label="Dokumenty"
        className="-mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]"
      >
        {LEGAL_DOCUMENTS.map((item, index) => {
          const selected = item.slug === active
          return (
            <button
              key={item.slug}
              ref={(node) => {
                tabRefs.current[index] = node
              }}
              type="button"
              role="tab"
              id={`tab-${item.slug}`}
              aria-selected={selected}
              aria-controls={`panel-${item.slug}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(item.slug)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-full font-semibold transition-colors',
                large ? 'h-12 px-5 text-base' : 'h-9 px-3.5 text-xs sm:h-10 sm:px-4 sm:text-sm',
                selected ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-card text-foreground ring-1 ring-border hover:bg-muted',
              )}
            >
              {item.tabLabel}
            </button>
          )
        })}
      </div>

      <article
        key={document.slug}
        role="tabpanel"
        id={`panel-${document.slug}`}
        aria-labelledby={`tab-${document.slug}`}
        tabIndex={0}
        className={cn('mt-4 min-h-0 flex-1 animate-in fade-in duration-200 focus-visible:outline-none', large ? 'text-base' : 'text-sm')}
      >
        <header className="border-b border-border pb-4">
          <h2 className={cn('text-balance font-extrabold tracking-tight', large ? 'text-3xl' : 'text-xl sm:text-2xl')}>{document.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">Obowiązuje od {document.updatedAt}</p>
          {document.intro && <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">{document.intro}</p>}
        </header>

        <div className="flex flex-col gap-6 py-5">
          {document.sections.map((section) => (
            <section key={section.heading}>
              <h3 className={cn('font-bold', large ? 'text-xl' : 'text-base')}>{section.heading}</h3>
              {section.list && (
                <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5 leading-relaxed marker:font-semibold marker:text-primary">
                  {section.list.map((item) => (
                    <li key={item} className="text-pretty pl-1">
                      {item}
                    </li>
                  ))}
                </ol>
              )}
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-2 text-pretty leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <p className="border-t border-border pt-4 text-xs text-muted-foreground">
          Pytania? Napisz do nas:{' '}
          <a href={`mailto:${LEGAL_EMAIL}`} className="font-semibold text-primary hover:underline">
            {LEGAL_EMAIL}
          </a>
        </p>
      </article>
    </div>
  )
}
