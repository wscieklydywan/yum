'use client'

import { useMemo, useRef } from 'react'
import { MousePointerClick, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/menu'
import { ProductBadge } from '@/components/yummy/product-card'
import { ProductDetails } from '@/components/yummy/product-dialog'
import { buildPreviewProduct, type MenuDraft, type WorkshopGroup } from './menu-types'

export function MenuProductPreview({ draft, groups, categoryLabel }: { draft: MenuDraft; groups: WorkshopGroup[]; categoryLabel: string }) {
  const product = useMemo(() => buildPreviewProduct(draft, groups), [draft, groups])
  const detailsRef = useRef<HTMLDivElement>(null)
  const prices = product.variants?.map((variant) => variant.price) ?? []
  const cardPrice = prices.length > 1 && Math.min(...prices) !== Math.max(...prices) ? `od ${formatPrice(Math.min(...prices))}` : formatPrice(product.price)
  const resetKey = JSON.stringify([product.variants?.map((variant) => variant.id), product.modifierGroups?.map((group) => [group.id, group.min, group.max, group.options.length])])

  return <div className="flex flex-col gap-5">
    <section aria-labelledby="preview-card-title">
      <p id="preview-card-title" className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b827a]">Karta w menu · {categoryLabel}</p>
      <button type="button" onClick={() => detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="mx-auto block w-full max-w-[260px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-3xl">
        <article className="flex flex-col overflow-hidden rounded-3xl bg-card shadow-sm ring-1 ring-border transition-shadow hover:shadow-md">
          <div className="relative aspect-[4/3] overflow-hidden bg-cream">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={draft.image || '/placeholder.svg'} alt="" className="size-full object-cover" />
            {draft.badge && <ProductBadge badge={draft.badge} className="absolute left-3 top-3 shadow-sm" />}
            {!draft.available && <span className="absolute right-3 top-3 rounded-full bg-[#211e1b]/80 px-2 py-0.5 text-[10px] font-bold text-white">Ukryte</span>}
          </div>
          <div className="flex flex-1 flex-col p-4">
            <h3 className="text-base font-bold leading-tight">{product.name}</h3>
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{product.description}</p>
            <div className="mt-4 flex items-center justify-between gap-2">
              <span className="text-lg font-extrabold">{cardPrice}</span>
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden="true"><Plus className="size-4" /></span>
            </div>
          </div>
        </article>
      </button>
    </section>

    <section ref={detailsRef} aria-labelledby="preview-details-title" className="scroll-mt-2">
      <p id="preview-details-title" className="mb-2 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b827a]"><MousePointerClick className="size-3.5" aria-hidden="true" />Po kliknięciu karty</p>
      <div className="overflow-hidden rounded-3xl bg-card shadow-sm ring-1 ring-border">
        <ProductDetails
          key={resetKey}
          standalone
          product={product}
          onAdd={(line) => toast.success(`Podgląd: ${line.quantity}× ${line.name} – ${formatPrice(line.unitPrice * line.quantity)}`, { description: line.details.join(', ') || 'Bez dodatków' })}
        />
      </div>
    </section>
  </div>
}
