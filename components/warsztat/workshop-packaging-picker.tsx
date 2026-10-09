'use client'

import { Minus, Package, Plus } from 'lucide-react'
import { MAX_PACKAGING, PACKAGING, PACKAGING_KINDS, packagingTotal, type PackagingCounts, type PackagingKind } from '@/lib/packaging'
import { cn } from '@/lib/utils'

const money = (value: number) => `${value.toFixed(2).replace('.', ',')} zł`

type Props = {
  counts: PackagingCounts
  auto: PackagingCounts
  onChange: (kind: PackagingKind, delta: number) => void
  hint?: string
}

export function WorkshopPackagingPicker({ counts, auto, onChange, hint }: Props) {
  const total = packagingTotal(counts)
  return (
    <section aria-labelledby="packaging-label" className="flex flex-col gap-2.5 border-t border-[#f0ece7] py-3.5">
      <div className="flex items-center justify-between gap-2">
        <span id="packaging-label" className="flex items-center gap-1.5 text-xs font-medium text-[#716962] md:text-sm"><Package className="size-4" aria-hidden="true" />Opakowania{hint ? ` · ${hint}` : ''}</span>
        <span className="text-sm font-semibold tabular-nums text-muted-foreground">{money(total)}</span>
      </div>
      <ul className="flex flex-wrap gap-2">
        {PACKAGING_KINDS.map((kind) => {
          const count = counts[kind] ?? 0
          const changed = count !== (auto[kind] ?? 0)
          const meta = PACKAGING[kind]
          return <li key={kind} className={cn('flex items-center rounded-xl border-2 bg-background text-sm', count > 0 ? 'border-primary/60' : 'border-input', changed && count > 0 && 'bg-primary/5')}>
            <button type="button" aria-label={`Odejmij: ${meta.name}`} disabled={count <= 0} onClick={() => onChange(kind, -1)} className="grid size-11 place-items-center rounded-l-xl text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 md:size-10"><Minus className="size-5 md:size-[18px]" aria-hidden="true" /></button>
            <span className="flex min-w-14 flex-col items-center px-1 leading-tight" title={`${meta.name} · ${money(meta.price)}`}>
              <span className={cn('font-bold', count === 0 && 'text-muted-foreground')}>{count > 0 ? `${count}× ` : ''}{meta.short}</span>
              <span className="text-[11px] tabular-nums text-muted-foreground">{money(meta.price)}</span>
            </span>
            <button type="button" aria-label={`Dodaj: ${meta.name}`} disabled={count >= MAX_PACKAGING} onClick={() => onChange(kind, 1)} className="grid size-11 place-items-center rounded-r-xl text-primary hover:bg-primary/10 disabled:opacity-30 md:size-10"><Plus className="size-5 md:size-[18px]" aria-hidden="true" /></button>
          </li>
        })}
      </ul>
    </section>
  )
}
