'use client'

import { useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { formatPrice, type ModifierGroup, type Product } from '@/lib/menu'
import { displayName, groupMax, isRequiredGroup, optionAvailable, priceHint, type StationCheck } from '@/lib/menu-config'
import { cn } from '@/lib/utils'

type Modifiers = Record<string, string[]>

const REQUIRED_TITLES: Record<string, string> = {
  sosy_box: 'Wybierz sos',
  napoj_zestaw_5: 'Wybierz napój',
}

const isSetGroup = (group: ModifierGroup) => group.id.startsWith('zestaw')

function groupTitle(group: ModifierGroup) {
  if (isRequiredGroup(group)) return REQUIRED_TITLES[group.id] ?? group.name
  if (isSetGroup(group)) return `Zestaw ${group.name.toLocaleLowerCase('pl-PL')}`
  return group.name
}

function groupHint(group: ModifierGroup) {
  if (isSetGroup(group)) return `Wybierz napój do zestawu · ${priceHint(group)}`
  const hint = priceHint(group)
  const limit = group.mode === 'multiple' && group.max ? ` · maks. ${group.max}` : ''
  return hint === 'w cenie' ? `Bez dopłaty${limit}` : `${hint.charAt(0).toLocaleUpperCase('pl-PL')}${hint.slice(1)}${limit}`
}

function SectionHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-[13px] font-bold leading-tight text-foreground sm:text-sm">{children}</h3>
      {aside}
    </div>
  )
}

function StatusPill({ tone, children }: { tone: 'required' | 'done' | 'muted'; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        tone === 'required' && 'bg-primary/10 text-primary',
        tone === 'done' && 'bg-emerald-50 text-emerald-700',
        tone === 'muted' && 'bg-muted text-muted-foreground',
      )}
    >
      {tone === 'done' && <Check className="size-3" strokeWidth={3} aria-hidden="true" />}
      {children}
    </span>
  )
}

export function VariantPicker({
  product,
  value,
  onChange,
}: {
  product: Product
  value: string | undefined
  onChange: (id: string) => void
}) {
  const variants = product.variants ?? []
  if (variants.length === 0) return null
  const columns = variants.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
  return (
    <fieldset>
      <legend className="sr-only">{product.variantGroupLabel ?? 'Wariant'}</legend>
      <SectionHeading aside={<StatusPill tone="muted">{variants.length} opcje</StatusPill>}>
        {product.variantGroupLabel ?? 'Wariant'}
      </SectionHeading>
      <div className={cn('mt-2 grid gap-1.5', columns)}>
        {variants.map((variant) => {
          const selected = variant.id === value
          return (
            <label
              key={variant.id}
              className={cn(
                'relative flex min-w-0 cursor-pointer select-none flex-col justify-center rounded-xl px-2.5 py-2 transition-all',
                selected ? 'bg-primary/5 ring-2 ring-primary' : 'bg-card ring-1 ring-border hover:ring-foreground/30',
              )}
            >
              <input type="radio" name="variant" checked={selected} onChange={() => onChange(variant.id)} className="peer sr-only" />
              <span className="line-clamp-2 break-words text-[12px] font-semibold leading-tight sm:text-[13px]">{displayName(variant.name)}</span>
              <span className={cn('mt-0.5 text-[11px] font-bold tabular-nums', selected ? 'text-primary' : 'text-muted-foreground')}>
                {formatPrice(variant.price)}
              </span>
              <span className="pointer-events-none absolute inset-0 rounded-xl ring-primary peer-focus-visible:ring-2" aria-hidden="true" />
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export function ModifierSections({
  groups,
  value,
  onChange,
  isStationOpen,
}: {
  groups: ModifierGroup[]
  value: Modifiers
  onChange: (next: Modifiers) => void
  isStationOpen?: StationCheck
}) {
  const required = groups.filter(isRequiredGroup)
  const optional = groups.filter((group) => !isRequiredGroup(group))
  const groupClosed = (group: ModifierGroup) => group.options.every((option) => !optionAvailable(group, option, isStationOpen))
  const [activeId, setActiveId] = useState(() => (optional.find((group) => !groupClosed(group)) ?? optional[0])?.id)
  const activeGroup = optional.find((group) => group.id === activeId)

  const toggleOption = (group: ModifierGroup, optionId: string) => {
    const option = group.options.find((entry) => entry.id === optionId)
    if (!option || !optionAvailable(group, option, isStationOpen)) return
    const current = value[group.id] ?? []
    let next: string[]
    if (current.includes(optionId)) {
      next = isRequiredGroup(group) && group.mode === 'single' ? current : current.filter((id) => id !== optionId)
    } else if (group.mode === 'single') {
      next = [optionId]
    } else {
      if (current.length >= groupMax(group)) return
      next = [...current, optionId]
    }
    onChange({ ...value, [group.id]: next })
  }

  return (
    <>
      {required.map((group) => {
        const done = (value[group.id]?.length ?? 0) >= group.min
        return (
          <section key={group.id} aria-label={groupTitle(group)}>
            <SectionHeading aside={<StatusPill tone={done ? 'done' : 'required'}>{done ? 'gotowe' : 'wymagane'}</StatusPill>}>
              {groupTitle(group)}
            </SectionHeading>
            <OptionGrid group={group} selected={value[group.id] ?? []} onToggle={(id) => toggleOption(group, id)} isStationOpen={isStationOpen} />
            {groupClosed(group) && (
              <p role="status" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Ta pozycja jest teraz niedostępna – bar jest chwilowo wyłączony.
              </p>
            )}
          </section>
        )
      })}

      {optional.length > 0 && (
        <section aria-labelledby="add-to-order-heading">
          <SectionHeading aside={<StatusPill tone="muted">opcjonalnie</StatusPill>}>
            <span id="add-to-order-heading">Dodaj do zamówienia</span>
          </SectionHeading>

          {optional.length > 1 && (
            <div
              role="tablist"
              aria-label="Kategorie dodatków"
              className="mt-2 flex flex-wrap gap-1.5"
            >
              {optional.map((group) => {
                const count = value[group.id]?.length ?? 0
                const active = group.id === activeId
                const closed = groupClosed(group)
                return (
                  <button
                    key={group.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls={`modifier-panel-${group.id}`}
                    onClick={() => setActiveId(group.id)}
                    className={cn(
                      'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition-colors',
                      active ? 'bg-foreground text-background' : 'bg-card text-foreground ring-1 ring-border hover:ring-foreground/30',
                      closed && 'opacity-50',
                    )}
                  >
                    {groupTitle(group)}
                    {count > 0 && (
                      <span
                        className={cn(
                          'grid min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold tabular-nums leading-4',
                          active ? 'bg-background text-foreground' : 'bg-primary text-primary-foreground',
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {activeGroup && (
            <div id={`modifier-panel-${activeGroup.id}`} role={optional.length > 1 ? 'tabpanel' : undefined} className="mt-2">
              <p className="text-[11px] text-muted-foreground">
                {optional.length === 1 && <span className="font-semibold text-foreground">{groupTitle(activeGroup)} · </span>}
                {groupClosed(activeGroup) ? 'Chwilowo niedostępne – bar wyłączony' : groupHint(activeGroup)}
              </p>
              <OptionGrid
                group={activeGroup}
                selected={value[activeGroup.id] ?? []}
                onToggle={(id) => toggleOption(activeGroup, id)}
                isStationOpen={isStationOpen}
              />
            </div>
          )}
        </section>
      )}
    </>
  )
}

function OptionGrid({
  group,
  selected,
  onToggle,
  isStationOpen,
}: {
  group: ModifierGroup
  selected: string[]
  onToggle: (id: string) => void
  isStationOpen?: StationCheck
}) {
  const multiple = group.mode === 'multiple'
  const limitReached = multiple && selected.length >= groupMax(group)
  const hideZeroPrice = isSetGroup(group) || group.options.every((option) => option.price === 0)

  return (
    <div role={multiple ? 'group' : 'radiogroup'} aria-label={group.name} className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {group.options.map((option) => {
        const unavailable = !optionAvailable(group, option, isStationOpen)
        const checked = !unavailable && selected.includes(option.id)
        const disabled = unavailable || (!checked && limitReached)
        return (
          <label
            key={option.id}
            className={cn(
              'relative flex min-h-11 min-w-0 select-none items-center gap-2 rounded-xl py-1.5 pl-2.5 pr-2 transition-all',
              checked ? 'bg-primary/5 ring-2 ring-primary' : 'bg-card ring-1 ring-border',
              disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
              !disabled && !checked && 'hover:ring-foreground/30',
            )}
          >
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name={`group-${group.id}`}
              checked={checked}
              disabled={disabled}
              onChange={() => onToggle(option.id)}
              onClick={() => {
                if (!multiple && checked) onToggle(option.id)
              }}
              className="peer sr-only"
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={cn('line-clamp-2 break-words text-[12px] font-medium leading-tight', checked && 'font-semibold', unavailable && 'line-through')}>
                {option.name}
              </span>
              {unavailable ? (
                <span className="text-[10px] font-semibold text-muted-foreground">niedostępne</span>
              ) : (
                !hideZeroPrice && (
                  <span className={cn('text-[11px] tabular-nums', checked ? 'font-semibold text-primary' : 'text-muted-foreground')}>
                    {option.price > 0 ? `+${formatPrice(option.price)}` : 'w cenie'}
                  </span>
                )
              )}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                'grid size-4 shrink-0 place-items-center transition-colors',
                multiple ? 'rounded-[5px]' : 'rounded-full',
                checked ? 'bg-primary text-primary-foreground' : 'ring-1 ring-input',
              )}
            >
              {checked && <Check className="size-2.5" strokeWidth={3.5} />}
            </span>
            <span className="pointer-events-none absolute inset-0 rounded-xl ring-foreground peer-focus-visible:ring-2" aria-hidden="true" />
          </label>
        )
      })}
    </div>
  )
}
