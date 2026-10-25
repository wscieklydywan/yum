'use client'

import { Activity, useId, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export type WorkshopSettingsTab = {
  id: string
  label: string
  description: string
  icon: LucideIcon
  content: ReactNode
}

export function WorkshopSettingsPage({ description, tabs, initialTab }: { description: string; tabs: WorkshopSettingsTab[]; initialTab?: string }) {
  const baseId = useId()
  const [activeId, setActiveId] = useState(() => tabs.find((tab) => tab.id === initialTab)?.id ?? tabs[0]?.id)
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0]
  const showNav = tabs.length > 1

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col pb-8 motion-safe:animate-in motion-safe:fade-in-0 duration-300">
      <header className="flex flex-col gap-1 pb-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#211e1b]">Ustawienia</h1>
        <p className="text-[13px] leading-relaxed text-[#817970]">{description}</p>
      </header>

      {showNav && (
        <nav aria-label="Kategorie ustawień" className="sticky top-0 z-10 -mx-3 mb-5 border-b border-[#e3dcd3] bg-[#f1ede7]/95 px-3 backdrop-blur sm:-mx-5 sm:px-5 xl:-mx-6 xl:px-6">
          <div role="tablist" aria-orientation="horizontal" className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] sm:gap-2">
            {tabs.map((tab) => {
              const selected = tab.id === active.id
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`${baseId}-tab-${tab.id}`}
                  aria-selected={selected}
                  aria-controls={`${baseId}-panel-${tab.id}`}
                  onClick={() => setActiveId(tab.id)}
                  className={`group relative flex h-12 shrink-0 items-center gap-2 whitespace-nowrap px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${selected ? 'text-[#211e1b]' : 'text-[#7d756d] hover:text-[#211e1b]'}`}
                >
                  <span className={`grid size-7 place-items-center rounded-lg transition-colors ${selected ? 'bg-primary text-primary-foreground' : 'bg-white/70 text-[#8b827a] group-hover:bg-white'}`}>
                    <Icon className="size-[15px]" aria-hidden="true" />
                  </span>
                  {tab.label}
                  <span aria-hidden="true" className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-colors ${selected ? 'bg-primary' : 'bg-transparent'}`} />
                </button>
              )
            })}
          </div>
        </nav>
      )}

      {tabs.map((tab) => (
        <Activity key={tab.id} mode={tab.id === active.id ? 'visible' : 'hidden'}>
          <section id={`${baseId}-panel-${tab.id}`} role={showNav ? 'tabpanel' : undefined} aria-labelledby={showNav ? `${baseId}-tab-${tab.id}` : undefined} className="flex flex-col gap-4">
            {showNav && <p className="text-[13px] text-[#8b827a]">{tab.description}</p>}
            {tab.content}
          </section>
        </Activity>
      ))}
    </div>
  )
}

export function SettingsCard({ icon: Icon, title, titleId, description, action, footer, children, iconClassName }: {
  icon: LucideIcon
  title: string
  titleId?: string
  description?: ReactNode
  action?: ReactNode
  footer?: ReactNode
  children?: ReactNode
  iconClassName?: string
}) {
  const fallbackId = useId()
  const headingId = titleId ?? fallbackId
  return (
    <section aria-labelledby={headingId} className="overflow-hidden rounded-2xl border border-[#e8e2db] bg-white shadow-[0_1px_2px_rgba(33,30,27,0.04)]">
      <div className="flex flex-wrap items-start gap-3 p-4 sm:flex-nowrap sm:p-5">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${iconClassName ?? 'bg-[#fbf1ea] text-primary'}`}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id={headingId} className="text-[15px] font-bold tracking-tight text-[#211e1b]">{title}</h2>
          {description && <div className="text-[13px] leading-relaxed text-[#847c74]">{description}</div>}
        </div>
        {action && <div className="flex w-full shrink-0 items-center sm:ml-2 sm:w-auto">{action}</div>}
      </div>
      {children && <div className="border-t border-[#f0ebe5] p-4 sm:p-5">{children}</div>}
      {footer && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#f0ebe5] bg-[#fbf9f6] px-4 py-3 sm:px-5">{footer}</div>}
    </section>
  )
}

export function SettingsField({ label, hint, htmlFor, children }: { label: string; hint?: ReactNode; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex min-w-0 flex-col gap-0.5">
        <label htmlFor={htmlFor} className="text-[13px] font-semibold text-[#2b2622]">{label}</label>
        {hint && <p className="text-[12px] leading-relaxed text-[#8b827a]">{hint}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

export function SettingsSwitch({ checked, onChange, disabled, labelledBy, label }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; labelledBy?: string; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 ${checked ? 'bg-emerald-600' : 'bg-[#d9d2ca]'}`}
    >
      <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

export const settingsInputClass = 'h-10 rounded-lg border border-[#e5ded6] bg-white px-3 text-[13px] tabular-nums text-[#201d1a] outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40'
