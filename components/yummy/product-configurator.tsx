'use client'

import { useState } from 'react'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { formatPrice, type ModifierGroup, type Product } from '@/lib/menu'
import { displayName, groupMax, isRequiredGroup, optionAvailable, priceHint, type StationCheck } from '@/lib/menu-config'
import { cn } from '@/lib/utils'

type Modifiers = Record<string, string[]>

const ADD_TITLES: Record<string, string> = {
  sosy: 'Dodaj sos',
  sosy_nuggetsy: 'Dodaj sos',
  frytki: 'Dodaj frytki',
  napoj: 'Dodaj napój',
  napoj_box: 'Dodaj napój',
  deser: 'Dodaj deser',
  milkshake: 'Dodaj milkshake',
  kawa: 'Dodaj kawę',
  dodatki_burger: 'Ulepsz burgera',
}

const REQUIRED_TITLES: Record<string, string> = {
  sosy_box: 'Wybierz sos',
  napoj_zestaw_5: 'Wybierz napój',
}

const isSetGroup = (group: ModifierGroup) => group.id.startsWith('zestaw')

function groupTitle(group: ModifierGroup) {
  if (isRequiredGroup(group)) return REQUIRED_TITLES[group.id] ?? group.name
  if (isSetGroup(group)) return `Zestaw ${group.name.toLocaleLowerCase('pl-PL')}`
  return ADD_TITLES[group.id] ?? `Dodaj: ${group.name.toLocaleLowerCase('pl-PL')}`
}

function groupSubtitle(group: ModifierGroup) {
  if (group.id === 'dodatki_burger') return group.options.slice(0, 3).map((option) => option.name.toLocaleLowerCase('pl-PL')).join(', ') + '…'
  if (isSetGroup(group)) return 'Wybierz napój do zestawu'
  const hint = priceHint(group)
  const limit = group.mode === 'multiple' && group.max ? ` · maks. ${group.max}` : ''
  return hint === 'w cenie' ? `bez dopłaty${limit}` : `${hint}${limit}`
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
  return (
    <fieldset className="mt-6">
      <legend className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {product.variantGroupLabel ?? 'Wariant'}
      </legend>
      <div className="mt-2 flex flex-col gap-2">
        {variants.map((variant) => {
          const selected = variant.id === value
          return (
            <label
              key={variant.id}
              className={cn(
                'flex cursor-pointer select-none items-center gap-3 rounded-xl bg-card px-4 py-3 text-sm transition-shadow',
                selected ? 'ring-2 ring-foreground' : 'ring-1 ring-border hover:ring-foreground/40',
              )}
            >
              <input
                type="radio"
                name="variant"
                checked={selected}
                onChange={() => onChange(variant.id)}
                className="peer sr-only"
              />
              <RadioDot checked={selected} />
              <span className="min-w-0 flex-1 break-words font-semibold">{displayName(variant.name)}</span>
              <span className="shrink-0 font-bold tabular-nums">{formatPrice(variant.price)}</span>
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
  const [openIds, setOpenIds] = useState<string[]>([])
  const required = groups.filter(isRequiredGroup)
  const optional = groups.filter((group) => !isRequiredGroup(group))
  const groupClosed = (group: ModifierGroup) => group.options.every((option) => !optionAvailable(group, option, isStationOpen))

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

  const toggleOpen = (id: string) =>
    setOpenIds((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]))

  return (
    <>
      {required.map((group) => (
        <fieldset key={group.id} className="mt-6">
          <legend className="flex w-full items-center justify-between gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <span>{groupTitle(group)}</span>
            <span className="rounded-md bg-foreground px-2 py-0.5 text-[10px] tracking-wide text-background">wymagane</span>
          </legend>
          <OptionList group={group} selected={value[group.id] ?? []} onToggle={(id) => toggleOption(group, id)} isStationOpen={isStationOpen} />
          {groupClosed(group) && (
            <p role="status" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Ta pozycja jest teraz niedostępna – bar jest chwilowo wyłączony.
            </p>
          )}
        </fieldset>
      ))}

      {optional.length > 0 && (
        <section className="mt-6" aria-labelledby="add-to-order-heading">
          <h3 id="add-to-order-heading" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Dodaj do zamówienia
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {optional.map((group) => {
              const selectedIds = value[group.id] ?? []
              const closed = groupClosed(group)
              const open = !closed && openIds.includes(group.id)
              const summary = group.options.filter((option) => selectedIds.includes(option.id)).map((option) => option.name)
              const panelId = `modifier-${group.id}`
              return (
                <li
                  key={group.id}
                  className={cn(
                    'min-w-0 overflow-hidden rounded-xl bg-card transition-shadow',
                    summary.length > 0 ? 'ring-2 ring-foreground' : 'ring-1 ring-border',
                  )}
                >
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    disabled={closed}
                    onClick={() => toggleOpen(group.id)}
                    className="flex w-full min-w-0 select-none items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'grid size-6 shrink-0 place-items-center rounded-full',
                        summary.length > 0 ? 'bg-foreground text-background' : 'bg-muted text-foreground',
                      )}
                    >
                      {summary.length > 0 ? <Check className="size-3.5" strokeWidth={3} /> : <Plus className="size-4" />}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-semibold">{groupTitle(group)}</span>
                      <span className="line-clamp-2 break-words text-xs text-muted-foreground">
                        {closed
                          ? 'Chwilowo niedostępne – bar wyłączony'
                          : summary.length > 0
                            ? `${summary.join(', ')}${group.mode === 'multiple' && groupMax(group) > 1 ? ` · ${summary.length}/${groupMax(group)}` : ''}`
                            : groupSubtitle(group)}
                      </span>
                    </span>
                    {isSetGroup(group) && (
                      <span className="shrink-0 text-sm font-bold tabular-nums">{priceHint(group)}</span>
                    )}
                    <ChevronDown
                      aria-hidden="true"
                      className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
                    />
                  </button>
                  {open && (
                    <div id={panelId} className="border-t border-border px-2 pb-2">
                      <OptionList
                        group={group}
                        selected={selectedIds}
                        onToggle={(id) => toggleOption(group, id)}
                        isStationOpen={isStationOpen}
                        compact
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </>
  )
}

function OptionList({
  group,
  selected,
  onToggle,
  isStationOpen,
  compact = false,
}: {
  group: ModifierGroup
  selected: string[]
  onToggle: (id: string) => void
  isStationOpen?: StationCheck
  compact?: boolean
}) {
  const multiple = group.mode === 'multiple'
  const limitReached = multiple && selected.length >= groupMax(group)
  const hideZeroPrice = isSetGroup(group) || group.options.every((option) => option.price === 0)

  return (
    <div
      role={multiple ? 'group' : 'radiogroup'}
      aria-label={group.name}
      className={cn('flex flex-col', compact ? 'mt-1' : 'mt-2 divide-y divide-border rounded-xl ring-1 ring-border')}
    >
      {group.options.map((option) => {
        const unavailable = !optionAvailable(group, option, isStationOpen)
        const checked = !unavailable && selected.includes(option.id)
        const disabled = unavailable || (!checked && limitReached)
        return (
          <label
            key={option.id}
            className={cn(
              'flex min-w-0 select-none items-center gap-3 px-3 py-2.5 text-sm',
              compact && 'rounded-lg',
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-muted/60',
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
            {multiple ? <CheckboxDot checked={checked} /> : <RadioDot checked={checked} />}
            <span className={cn('min-w-0 flex-1 break-words', checked && 'font-semibold', unavailable && 'line-through')}>{option.name}</span>
            {unavailable ? (
              <span className="shrink-0 text-xs font-semibold text-muted-foreground">niedostępne</span>
            ) : !hideZeroPrice && (
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {option.price > 0 ? `+${formatPrice(option.price)}` : 'w cenie'}
              </span>
            )}
          </label>
        )
      })}
    </div>
  )
}

function RadioDot({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-5 shrink-0 place-items-center rounded-full ring-1 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-foreground',
        checked ? 'bg-foreground ring-foreground' : 'bg-card ring-input',
      )}
    >
      {checked && <span className="size-2 rounded-full bg-background" />}
    </span>
  )
}

function CheckboxDot({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-5 shrink-0 place-items-center rounded-md ring-1 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-foreground',
        checked ? 'bg-foreground text-background ring-foreground' : 'bg-card ring-input',
      )}
    >
      {checked && <Check className="size-3.5" strokeWidth={3} />}
    </span>
  )
}
