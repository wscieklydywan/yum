'use client'

import { Check } from 'lucide-react'
import type { ModifierGroup, Product } from '@/lib/menu'
import { displayName, groupMax, isRequiredGroup } from '@/lib/menu-config'
import { cn } from '@/lib/utils'

export type LineSelection = { variantId?: string; modifiers: Record<string, string[]> }

const shortMoney = (value: number) => `${Number.isInteger(value) ? value : value.toFixed(2).replace('.', ',')} zł`

function groupLabel(group: ModifierGroup) {
  const max = groupMax(group)
  const hint = group.mode === 'multiple' && max > 1 ? ` · maks. ${max}` : ''
  return `${group.name}${hint}`
}

type Props = {
  product: Product
  value: LineSelection
  onChange: (next: LineSelection) => void
}

export function WorkshopLineConfigurator({ product, value, onChange }: Props) {
  const variants = product.variants ?? []
  const groups = product.modifierGroups ?? []
  const activeVariant = value.variantId ?? variants[0]?.id

  function toggle(group: ModifierGroup, optionId: string) {
    const current = value.modifiers[group.id] ?? []
    const selected = current.includes(optionId)
    let next: string[]
    if (group.mode === 'single') next = selected && !isRequiredGroup(group) ? [] : [optionId]
    else if (selected) next = current.filter((id) => id !== optionId)
    else if (current.length >= groupMax(group)) return
    else next = [...current, optionId]
    onChange({ ...value, modifiers: { ...value.modifiers, [group.id]: next } })
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-3">
      {variants.length > 0 && <div role="radiogroup" aria-label={product.variantGroupLabel ?? 'Wariant'} className="flex flex-col gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{product.variantGroupLabel ?? 'Wariant'}</span>
        <div className="flex flex-wrap gap-1.5">
          {variants.map((variant) => {
            const selected = variant.id === activeVariant
            return <button key={variant.id} type="button" role="radio" aria-checked={selected} onClick={() => onChange({ ...value, variantId: variant.id })}
              className={cn('flex h-11 min-w-24 flex-1 items-center justify-center gap-2 rounded-lg border-2 px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-12 lg:text-base',
                selected ? 'border-foreground bg-foreground text-background' : 'border-border bg-card hover:border-foreground/40')}>
              {displayName(variant.name)}
              <span className={cn('text-xs font-semibold tabular-nums', selected ? 'text-background/70' : 'text-muted-foreground')}>{shortMoney(variant.price)}</span>
            </button>
          })}
        </div>
      </div>}

      {groups.map((group) => {
        const chosen = value.modifiers[group.id] ?? []
        const missing = isRequiredGroup(group) && chosen.length < group.min
        return <div key={group.id} className="flex flex-col gap-1.5">
          <span className={cn('text-[11px] font-bold uppercase tracking-wide', missing ? 'text-destructive' : 'text-muted-foreground')}>
            {groupLabel(group)}{missing && ' · wymagane'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {group.options.map((option) => {
              const selected = chosen.includes(option.id)
              return <button key={option.id} type="button" aria-pressed={selected} onClick={() => toggle(group, option.id)}
                className={cn('flex h-10 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-11 lg:text-sm',
                  selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/50')}>
                {selected && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
                {displayName(option.name)}
                {option.price > 0 && <span className={cn('text-xs tabular-nums', selected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>+{shortMoney(option.price)}</span>}
              </button>
            })}
          </div>
        </div>
      })}
    </div>
  )
}
