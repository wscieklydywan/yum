'use client'

import { useState } from 'react'
import { CalendarClock, CupSoda, Layers, LoaderCircle, Pencil, Percent, Plus, Sun, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { describeChannels, describeSchedule, describeScope, discountLabel, type Promotion } from '@/lib/promotions'
import { sendPromotion, useClock, useWorkshopPromotions } from '@/lib/use-workshop-promotions'
import { PromotionEditor, draftFromPromotion, emptyDraft, type PromotionDraft } from './promotion-editor'
import { PromotionStatusBadge, PromotionSwitch } from './promotion-parts'
import { TabIntro } from './help-parts'

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
      <TabIntro
        id="promotions-title"
        icon={CalendarClock}
        title="Promocje"
        lead="Promocja to automatyczna obniżka ceny dla wszystkich – klient nie musi nic wpisywać. Ceny same spadają w wybrane dni i godziny, online i na barze."
        steps={[
          'Kliknij gotowy przykład poniżej albo „Nowa promocja”.',
          'Wybierz, co ma być taniej, o ile i kiedy.',
          <>Włącz <strong>przełącznik</strong> przy promocji – bez tego nie zadziała.</>,
        ]}
        action={
          <Button onClick={() => openEditor(emptyDraft())} disabled={!data}>
            <Plus className="size-4" aria-hidden="true" />
            Nowa promocja
          </Button>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-zinc-500">Gotowe przykłady (kliknij, aby użyć):</span>
        {templates.map(({ label, icon: Icon, draft }) => (
          <button key={label} type="button" disabled={!data} onClick={() => openEditor(emptyDraft(draft))} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 transition-colors hover:border-primary hover:text-primary disabled:opacity-50">
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-zinc-500"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Wczytywanie promocji…</p>
      ) : error ? (
        <p className="mt-6 rounded-xl bg-red-50 p-3 sm:p-4 text-sm text-red-700">{error.message}</p>
      ) : !promotions.length ? (
        <div className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center">
          <p className="font-bold text-zinc-900">Nie masz jeszcze żadnej promocji</p>
          <p className="mt-1 text-sm text-zinc-500">Kliknij jeden z gotowych przykładów powyżej – formularz wypełni się sam, wystarczy sprawdzić i zapisać.</p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {promotions.map((promotion) => (
            <li key={promotion.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3 sm:p-4 shadow-sm">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <PromotionStatusBadge promotion={promotion} now={now} />
                  <span className="max-w-full rounded-xl bg-primary/10 px-2.5 py-1 text-sm font-black leading-tight text-primary">{discountLabel(promotion)}</span>
                </div>
                <h3 className="mt-2 line-clamp-2 break-words text-base font-extrabold text-zinc-900">{promotion.title}</h3>
              </div>
              <dl className="grid gap-1 text-sm text-zinc-600">
                <div className="flex gap-2"><dt className="w-14 shrink-0 text-zinc-400">Kiedy</dt><dd>{describeSchedule(promotion)}</dd></div>
                <div className="flex gap-2"><dt className="w-14 shrink-0 text-zinc-400">Na co</dt><dd className="min-w-0">{describeScope(promotion, names)}</dd></div>
                <div className="flex gap-2"><dt className="w-14 shrink-0 text-zinc-400">Gdzie</dt><dd>{describeChannels(promotion)}</dd></div>
              </dl>
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-zinc-100 pt-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
                  <PromotionSwitch checked={promotion.active} disabled={busy === promotion.id} onChange={(next) => void toggle(promotion, next)} label={`Włącz promocję ${promotion.title}`} />
                  {promotion.active ? 'Włączona' : 'Wyłączona – kliknij, aby włączyć'}
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
