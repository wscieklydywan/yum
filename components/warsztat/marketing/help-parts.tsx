import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function TabIntro({ icon: Icon, title, lead, steps, action, id }: { icon: LucideIcon; title: string; lead: ReactNode; steps: ReactNode[]; action?: ReactNode; id?: string }) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 max-w-2xl items-start gap-3">
          <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:flex">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id={id} className="text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">{title}</h2>
            <p className="mt-0.5 text-sm leading-relaxed text-zinc-500">{lead}</p>
          </div>
        </div>
        {action}
      </div>
      <details className="group rounded-xl border border-zinc-200 bg-zinc-50/70 [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900">
          <span>Jak to działa? ({steps.length} kroki)</span>
          <span aria-hidden="true" className="text-zinc-400 transition-transform group-open:rotate-45">+</span>
        </summary>
        <ol className={cn('grid gap-2 border-t border-zinc-200 px-3 py-3', steps.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
          {steps.map((step, index) => (
            <li key={index} className="flex items-start gap-2.5 text-sm leading-snug text-zinc-700">
              <StepNumber n={index + 1} />
              <span className="min-w-0 pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </details>
    </header>
  )
}

export function StepNumber({ n }: { n: number }) {
  return <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-lg bg-zinc-900 text-[11px] font-bold text-white">{n}</span>
}

export function StepLegend({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <legend className="mb-3 flex w-full items-start gap-2.5">
      <StepNumber n={n} />
      <span className="min-w-0 pt-0.5">
        <span className="block text-sm font-semibold text-zinc-900">{title}</span>
        {hint && <span className="mt-0.5 block text-xs font-normal text-zinc-500">{hint}</span>}
      </span>
    </legend>
  )
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-[11px] leading-snug text-zinc-500">{children}</p>
}
