import { cn } from '@/lib/utils'

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  tone = 'light',
  className,
  compactMobile = false,
}: {
  id: string
  eyebrow?: string
  title: string
  description?: string
  tone?: 'light' | 'dark'
  className?: string
  compactMobile?: boolean
}) {
  return (
    <div className={cn('max-w-2xl', className)}>
      {eyebrow && (
        <p className={cn('font-script text-xl text-primary sm:text-2xl', compactMobile && 'text-lg sm:text-2xl')}>{eyebrow}</p>
      )}
      <h2
        id={id}
        className={cn(
          'relative mt-1 inline-block text-3xl font-black tracking-tight text-balance sm:text-5xl',
          compactMobile && 'text-2xl sm:text-5xl',
          tone === 'dark' && 'text-white',
        )}
      >
        {title}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="absolute -right-7 -top-3 size-6 text-primary"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        >
          <path d="M6 14 9 5M12 16l6-9M15 20l6-4" />
        </svg>
      </h2>
      {description && (
        <p
          className={cn(
            'mt-3 text-base leading-relaxed text-pretty sm:mt-4 sm:text-lg',
            compactMobile && 'mt-2 text-sm leading-snug sm:mt-4 sm:text-lg',
            tone === 'dark' ? 'text-ink-foreground/70' : 'text-muted-foreground',
          )}
        >
          {description}
        </p>
      )}
    </div>
  )
}
