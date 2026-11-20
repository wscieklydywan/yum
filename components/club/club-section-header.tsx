import type { ReactNode } from 'react'

export function ClubSectionHeader({ id, eyebrow, title, description, action }: {
  id?: string
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <header className="flex min-w-0 flex-wrap items-start justify-between gap-4 sm:items-center">
      <div className="min-w-0 flex-1 basis-52">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
        <h1 id={id} className="break-words text-[1.75rem] font-extrabold leading-[1.15] tracking-tight sm:text-3xl lg:text-[2.25rem]">{title}</h1>
        <p className="mt-2 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {action && <div className="min-w-0 max-w-full">{action}</div>}
    </header>
  )
}
