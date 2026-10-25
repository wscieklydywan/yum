'use client'

import { useState } from 'react'
import { CalendarClock, CupSoda, Layers, LoaderCircle, Pencil, Percent, Plus, Sun, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { describeChannels, describeSchedule, describeScope, discountLabel, type Promotion } from '@/lib/promotions'
import { sendPromotion, useClock, useWorkshopPromotions } from '@/lib/use-workshop-promotions'
import { PromotionEditor, draftFromPromotion, emptyDraft, type PromotionDraft } from './promotion-editor'
import { PromotionStatusBadge, PromotionSwitch } from './promotion-parts'

const templates: { label: string; icon: typeof Percent; draft: Partial<PromotionDraft> }[] = [
  { label: 'Środa -20% na wszystko', icon: Percent, draft: { title: 'Burgerowa środa', discount_percent: '20', scope: 'all', days: [3], description: 'W każdą środę całe menu 20% taniej.' } },
  { label: 'Napoje taniej', icon: CupSoda, draft: { title: 'Napoje taniej', discount_percent: '30', scope: 'categories', description: 'Wszystkie napoje -30%.' } },
  { label: 'Drugi burger za 10 zł', icon: Layers, draft: { title: 'Drugi burger za 10 zł', kind: 'nth_item', buy_quantity: '1', reward_mode: 'price', reward_price: '10', scope: 'categories', description: 'Zamów burgera – drugi kosztuje tylko 10 zł.' } },
  { label: 'Happy hours 12–16', icon: Sun, draft: { title: 'Happy hours', discount_percent: '15', scope: 'all', days: [1, 2, 3, 4, 5], allDay: false, start_time: '12:00', end_time: '16:00', description: 'Od poniedziałku do piątku w godz. 12–16.' } },
]

export function WorkshopPromotions() {
  const { data, error, isLoading } = useWorkshopPromotions()
  const now = useClock()
  const [editor, setEditor] = useState<{ key: number; draft: PromotionDraft } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const promotions = data?.promotions ?? []
  const names = {
    categories: new Map((data?.categories ?? []).map((category) => [category.id, category.label])),
    products: new Map((data?.products ?? []).map((product) => [product.id, product.name])),
  }

  const openEditor = (draft: PromotionDraft) => setEditor({ key: Date.now(), draft })

  async function run(id: string, action: () => Promise<unknown>, success: string) {
    setBusy(id)
    try {
      await action()
      toast.success(success)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Operacja nie powiodła się.')
    } finally {
      setBusy(null)
    }
  }

  const toggle = (promotion: Promotion, active: boolean) =>
    run(promotion.id, () => sendPromotion('PATCH', { id: promotion.id, active }), active ? `Włączono: ${promotion.title}` : `Wyłączono: ${promotion.title}`)

  const remove = (promotion: Promotion) => {
    if (!window.confirm(`Usunąć promocję „${promotion.title}”?`)) return
    void run(promotion.id, () => sendPromotion('DELETE', undefined, `?id=${encodeURIComponent(promotion.id)}`), 'Usunięto promocję')
  }

  return (
    <section aria-labelledby="promotions-title">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="promotions-title" className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-[#211e1b]">
            <CalendarClock className="size-5 text-primary" aria-hidden="true" />
            Promocje
          </h2>
          <p className="mt-0.5 max-w-xl text-sm text-[#7a726a]">Ustal promocje z harmonogramem. Bar włącza je i wyłącza jednym kliknięciem – w terminie ceny obniżają się automatycznie online i na barze.</p>
        </div>
        <Button onClick={() => openEditor(emptyDraft())} disabled={!data}>
          <Plus className="size-4" aria-hidden="true" />
          Nowa promocja
        </Button>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-[#8b827a]">Szybki start:</span>
        {templates.map(({ label, icon: Icon, draft }) => (
          <button key={label} type="button" disabled={!data} onClick={() => openEditor(emptyDraft(draft))} className="inline-flex items-center gap-1.5 rounded-full border border-[#e5ded6] bg-white px-3 py-1.5 text-xs font-bold text-[#4f4943] transition-colors hover:border-primary hover:text-primary disabled:opacity-50">
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-[#7a726a]"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Wczytywanie promocji…</p>
      ) : error ? (
        <p className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error.message}</p>
      ) : !promotions.length ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#ddd5cc] bg-white p-8 text-center">
          <p className="font-bold text-[#211e1b]">Brak promocji</p>
          <p className="mt-1 text-sm text-[#7a726a]">Zacznij od szablonu powyżej albo dodaj własną.</p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {promotions.map((promotion) => (
            <li key={promotion.id} className="flex flex-col gap-3 rounded-2xl border border-[#ece6df] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <PromotionStatusBadge promotion={promotion} now={now} />
                  <h3 className="mt-1.5 truncate text-base font-extrabold text-[#211e1b]">{promotion.title}</h3>
                </div>
                <span className="shrink-0 rounded-xl bg-primary/10 px-2.5 py-1 text-lg font-black text-primary">{discountLabel(promotion)}</span>
              </div>
              <dl className="grid gap-1 text-sm text-[#5f5852]">
                <div className="flex gap-2"><dt className="w-14 shrink-0 text-[#9a9189]">Kiedy</dt><dd>{describeSchedule(promotion)}</dd></div>
                <div className="flex gap-2"><dt className="w-14 shrink-0 text-[#9a9189]">Na co</dt><dd className="min-w-0">{describeScope(promotion, names)}</dd></div>
                <div className="flex gap-2"><dt className="w-14 shrink-0 text-[#9a9189]">Gdzie</dt><dd>{describeChannels(promotion)}</dd></div>
              </dl>
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#f2ede8] pt-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-[#4f4943]">
                  <PromotionSwitch checked={promotion.active} disabled={busy === promotion.id} onChange={(next) => void toggle(promotion, next)} label={`Włącz promocję ${promotion.title}`} />
                  {promotion.active ? 'Włączona' : 'Wyłączona'}
                </label>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" aria-label={`Edytuj ${promotion.title}`} onClick={() => openEditor(draftFromPromotion(promotion))}><Pencil className="size-4" aria-hidden="true" /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Usuń ${promotion.title}`} disabled={busy === promotion.id} onClick={() => remove(promotion)} className="hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" aria-hidden="true" /></Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editor && data && (
        <PromotionEditor key={editor.key} open onOpenChange={(open) => !open && setEditor(null)} initial={editor.draft} categories={data.categories} products={data.products} />
      )}
    </section>
  )
}
