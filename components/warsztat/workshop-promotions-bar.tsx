'use client'

import { useState } from 'react'
import { BadgePercent, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { describeSchedule, describeScope, discountLabel, isPromotionRunning, type Promotion } from '@/lib/promotions'
import { sendPromotion, useClock, useWorkshopPromotions } from '@/lib/use-workshop-promotions'
import { PromotionStatusBadge, PromotionSwitch } from './marketing/promotion-parts'

function useRunningPromotions() {
  const query = useWorkshopPromotions()
  const now = useClock()
  const running = (query.data?.promotions ?? []).filter((promotion) => isPromotionRunning(promotion, now, 'in_store'))
  return { ...query, now, running }
}

export function WorkshopPromotionsButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const { data, error, isLoading, now, running } = useRunningPromotions()
  const promotions = data?.promotions ?? []
  const names = {
    categories: new Map((data?.categories ?? []).map((category) => [category.id, category.label])),
    products: new Map((data?.products ?? []).map((product) => [product.id, product.name])),
  }

  async function toggle(promotion: Promotion, active: boolean) {
    setBusy(promotion.id)
    try {
      await sendPromotion('PATCH', { id: promotion.id, active })
      toast.success(active ? `Włączono: ${promotion.title}` : `Wyłączono: ${promotion.title}`)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Nie udało się zmienić promocji.')
    } finally {
      setBusy(null)
    }
  }

  return <>
    <Button
      variant="outline"
      onClick={() => setOpen(true)}
      aria-label={running.length > 0 ? `Promocje, aktywne: ${running.length}` : 'Promocje'}
      title="Promocje"
      className={cn('relative h-9 shrink-0 gap-1.5 rounded-xl border-[#e8e3dd] px-2.5 text-xs font-bold sm:px-3', running.length > 0 && 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100', className)}
    >
      <BadgePercent data-icon="inline-start" />
      <span className="hidden md:inline">Promocje</span>
      {running.length > 0 && <span className="ml-1 rounded-full bg-emerald-600 px-1.5 text-[10px] font-black text-white">{running.length}</span>}
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[calc(90dvh/var(--ui-zoom,1))] flex-col overflow-y-auto overflow-x-hidden max-sm:inset-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:content-start max-sm:rounded-none max-sm:pt-[max(1rem,env(safe-area-inset-top))] max-sm:pb-[max(1rem,env(safe-area-inset-bottom))] max-sm:ring-0 max-sm:data-open:zoom-in-100 sm:max-w-lg">
        <DialogHeader className="pr-10">
          <DialogTitle className="text-lg font-extrabold">Promocje</DialogTitle>
          <DialogDescription>Włącz promocję, a w jej terminie rabat naliczy się sam – na barze i online. Promocje ustala szef w zakładce Marketing.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Wczytywanie…</p>
        ) : error ? (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error.message}</p>
        ) : !promotions.length ? (
          <p className="rounded-xl bg-[#f6f3ef] p-4 text-sm text-[#6f6861]">Szef nie dodał jeszcze żadnych promocji.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {promotions.map((promotion) => (
              <li key={promotion.id} className="flex items-center gap-3 rounded-xl border border-[#ece6df] bg-white p-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-black text-primary">{discountLabel(promotion)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-[#211e1b]">{promotion.title}</p>
                  <p className="truncate text-xs text-[#7a726a]">{describeSchedule(promotion)} · {describeScope(promotion, names)}</p>
                  <PromotionStatusBadge promotion={promotion} now={now} className="mt-1" />
                </div>
                <PromotionSwitch checked={promotion.active} disabled={busy === promotion.id} onChange={(next) => void toggle(promotion, next)} label={`Włącz promocję ${promotion.title}`} />
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  </>
}
