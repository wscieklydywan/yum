'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Loader2, Plus, Star, Trash2, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/marketing'
import {
  REWARD_BUDGETS,
  REWARDS_ADMIN_KEY,
  formatPercent,
  linkedMenuValue,
  rewardEconomics,
  spendPerStar,
  starRealCost,
  suggestedStarCost,
  type RewardItem,
  type RewardsAdminData,
} from '@/lib/loyalty-economics'
import { cleanDecimal, inputClass, labelClass } from '../menu-editor/form-styles'
import { costTone, EconomicsNote, fetchJson, Metric } from './economics-parts'
import { TabIntro } from './help-parts'
import { RewardItemsEditor } from './reward-items-editor'
import { RewardBudgetPicker, RewardProposals, useRewardProposals, type RewardBudgetKey, type RewardProposal } from './reward-proposals'

type DraftReward = { key: string; isNew?: boolean; name: string; note: string; cost: string; menu_value: string; items: RewardItem[]; image: string; active: boolean }
type Draft = { foodCost: string; rewards: DraftReward[]; deleted: string[] }

const toNumber = (value: string) => Number(value.replace(',', '.')) || 0

function toDraft(data: RewardsAdminData): Draft {
  return {
    foodCost: String(data.foodCostPercent).replace('.', ','),
    deleted: [],
    rewards: data.rewards.map((reward) => ({
      key: reward.key,
      name: reward.name,
      note: reward.note,
      cost: String(reward.cost),
      menu_value: String(reward.menu_value).replace('.', ','),
      items: reward.items,
      image: reward.image,
      active: reward.active,
    })),
  }
}

const newDraftKey = () => `new-${crypto.randomUUID().slice(0, 8)}`

export function WorkshopRewardsEconomics() {
  const { data, error, isLoading, mutate } = useSWR<RewardsAdminData>(REWARDS_ADMIN_KEY, fetchJson)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [budget, setBudget] = useState<RewardBudgetKey>('saver')

  useEffect(() => {
    if (data && !draft) setDraft(toDraft(data))
  }, [data, draft])

  const prices = useMemo(() => new Map((data?.products ?? []).map((product) => [product.id, product.price])), [data])
  const foodCostLive = draft ? toNumber(draft.foodCost) : 30
  const budgetPercent = REWARD_BUDGETS.find((entry) => entry.key === budget)!.businessCostPercent
  const proposals = useRewardProposals(data?.products ?? [], data?.rate ?? { points: 1, spend: 1 }, foodCostLive, budget)

  const live = useMemo(() => {
    if (!draft || !data) return null
    const foodCost = toNumber(draft.foodCost)
    const rewards = draft.rewards.map((reward) => {
      const value = linkedMenuValue(reward.items, (id) => prices.get(id)) ?? toNumber(reward.menu_value)
      const parsed = { cost: Math.max(1, Math.round(toNumber(reward.cost))), menu_value: value, active: reward.active }
      return { ...reward, linked: reward.items.some((item) => item.product_id), parsed, eco: rewardEconomics(parsed, data.rate, foodCost), suggested: suggestedStarCost(value, data.rate, foodCost, budgetPercent) }
    })
    const active = rewards.filter((reward) => reward.active)
    const avg = (pick: (item: (typeof rewards)[number]) => number) => (active.length ? active.reduce((sum, item) => sum + pick(item), 0) / active.length : 0)
    return {
      rewards,
      starCost: starRealCost(rewards.map((reward) => reward.parsed), foodCost),
      worstCost: active.reduce((max, item) => Math.max(max, item.eco.businessCostPercent), 0),
      avgReturn: avg((item) => item.eco.customerReturnPercent),
      avgCost: avg((item) => item.eco.businessCostPercent),
    }
  }, [draft, data, prices, budgetPercent])

  if (error) return <p className="rounded-xl bg-red-50 p-3 sm:p-4 text-sm text-red-700">{error.message}</p>
  if (isLoading || !data || !draft || !live) return <div className="flex justify-center p-10"><Loader2 className="size-6 animate-spin text-primary" aria-label="Wczytywanie" /></div>

  const zlPerStar = spendPerStar(data.rate)
  const monthCost = data.rewards.reduce((sum, reward) => sum + reward.stats.periodTotal, 0)
  const monthUses = data.rewards.reduce((sum, reward) => sum + reward.stats.periodUses, 0)
  const existingNames = new Set(draft.rewards.map((reward) => reward.name.trim().toLowerCase()))
  const updateReward = (key: string, patch: Partial<DraftReward>) =>
    setDraft({ ...draft, rewards: draft.rewards.map((reward) => (reward.key === key ? { ...reward, ...patch } : reward)) })
  const removeReward = (reward: DraftReward) =>
    setDraft({ ...draft, rewards: draft.rewards.filter((item) => item.key !== reward.key), deleted: reward.isNew ? draft.deleted : [...draft.deleted, reward.key] })
  const fromProposal = (proposal: RewardProposal): DraftReward => ({
    key: newDraftKey(),
    isNew: true,
    name: proposal.name,
    note: proposal.note,
    cost: String(proposal.cost),
    menu_value: String(proposal.value),
    items: proposal.items,
    image: '',
    active: true,
  })
  const addProposals = (list: RewardProposal[]) => {
    const fresh = list.filter((proposal) => !existingNames.has(proposal.name.toLowerCase()))
    if (!fresh.length) return
    setDraft({ ...draft, rewards: [...draft.rewards, ...fresh.map(fromProposal)] })
    toast.success(fresh.length === 1 ? `Dodano „${fresh[0].name}” – pamiętaj o zapisie` : `Dodano ${fresh.length} kuponów – pamiętaj o zapisie`)
  }
  const applySuggestedPrices = () =>
    setDraft({ ...draft, rewards: draft.rewards.map((reward) => ({ ...reward, cost: String(live.rewards.find((item) => item.key === reward.key)?.suggested ?? reward.cost) })) })

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!draft) return
    const empty = draft.rewards.find((reward) => !reward.items.some((item) => item.product_id))
    if (empty) {
      toast.error(`„${empty.name || 'Nowy kupon'}”: wybierz przynajmniej jeden produkt z menu.`)
      return
    }
    setSaving(true)
    try {
      const response = await fetch(REWARDS_ADMIN_KEY, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foodCostPercent: toNumber(draft.foodCost),
          deleted: draft.deleted,
          rewards: draft.rewards.map((reward) => ({
            ...reward,
            items: reward.items.filter((item) => item.product_id),
            cost: Math.round(toNumber(reward.cost)),
            menu_value: toNumber(reward.menu_value),
          })),
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error ?? 'Nie udało się zapisać.')
      await mutate(result, { revalidate: false })
      setDraft(toDraft(result))
      toast.success('Zapisano kupony')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Nie udało się zapisać.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <TabIntro
        icon={Star}
        title="Kupony za Stars"
        lead={<>Za każde zamówienie klient zbiera punkty (Stars): {formatMoney(zlPerStar)} wydane = 1 Star. Potem wymienia je na kupon z prawdziwymi produktami z menu. Kod kuponu kasjer realizuje w warsztacie – produkty od razu trafiają na kuchnię/bar.</>}
        steps={[
          'Dodaj kupon z propozycji albo „Nowy kupon” i wybierz produkty z menu.',
          'Ustal cenę w Stars – „Sugerowana cena” liczy ją z ceny w menu i wybranego poziomu.',
          'Kliknij „Zapisz kupony” na dole.',
        ]}
      />

      <section aria-labelledby="rw-summary" className="flex flex-col gap-3">
        <div>
          <h2 id="rw-summary" className="text-base font-black text-zinc-900">Ile Cię to kosztuje?</h2>
          <p className="text-sm text-zinc-500">Liczymy z aktualnych cen menu i od razu przeliczamy, gdy zmieniasz kupony niżej.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Za ile 1 Star" value={`${formatMoney(zlPerStar)} = 1 Star`} hint="Zmienisz w Yummy Club → Punkty i złotówki" />
          <Metric label="Klient dostaje z powrotem" value={formatPercent(live.avgReturn)} hint="Średnio z każdej wydanej złotówki" />
          <Metric label="Ty oddajesz" value={formatPercent(live.avgCost)} tone={costTone(live.worstCost)} hint={`Z każdej złotówki obrotu (najwięcej ${formatPercent(live.worstCost)})`} />
          <Metric label="W tym miesiącu" value={formatMoney(monthCost)} hint={`${monthUses} odebranych kuponów`} />
        </div>
        <EconomicsNote>
          <p>
            Jeden punkt kosztuje Cię najwyżej <strong className="tabular-nums">{formatMoney(live.starCost)}</strong>. Najoszczędniej działają tanie w produkcji pozycje: sosy, napoje, kawa, frytki. Do 1% obrotu jest zielono, do 2% żółto, wyżej czerwono.
          </p>
        </EconomicsNote>
        <div className="max-w-xs">
          <label htmlFor="rw-food-cost" className={labelClass}>Ile % ceny dania to koszt składników?</label>
          <input id="rw-food-cost" inputMode="decimal" value={draft.foodCost} onChange={(event) => setDraft({ ...draft, foodCost: cleanDecimal(event.target.value).replace('.', ',') })} className={inputClass} />
          <p className="mt-1 text-[11px] text-zinc-500">Np. burger za 30 zł, składniki 9 zł = 30%. Nie wiesz? Zostaw jak jest.</p>
        </div>
      </section>

      <section aria-labelledby="rw-proposals" className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-3 sm:p-4">
        <div>
          <h2 id="rw-proposals" className="text-base font-black text-zinc-900">Ile punktów za kupon?</h2>
          <p className="text-sm text-zinc-500">Wybierz, ile % obrotu chcesz oddawać klientom w koszcie składników. Ceny propozycji i „Sugerowana cena” przeliczą się same.</p>
        </div>
        <RewardBudgetPicker value={budget} onChange={setBudget} />
        <RewardProposals proposals={proposals} existingNames={existingNames} onAdd={(proposal) => addProposals([proposal])} onAddAll={() => addProposals(proposals)} />
      </section>

      <section aria-labelledby="rw-list" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="rw-list" className="text-base font-black text-zinc-900">Twoje kupony ({draft.rewards.length})</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={applySuggestedPrices} className="flex h-9 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800 transition-colors hover:border-zinc-300">
              <Wand2 className="size-3.5" aria-hidden="true" />
              Ustaw sugerowane ceny
            </button>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, rewards: [...draft.rewards, { key: newDraftKey(), isNew: true, name: '', note: '', cost: '', menu_value: '0', items: [{ name: '', quantity: 1 }], image: '', active: true }] })}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-zinc-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-zinc-700"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Nowy kupon
            </button>
          </div>
        </div>
        {draft.rewards.length === 0 && <p className="rounded-xl border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">Brak kuponów. Dodaj je z propozycji powyżej.</p>}
        <ul className="flex flex-col gap-2">
          {live.rewards.map((reward) => {
            const stats = data.rewards.find((item) => item.key === reward.key)?.stats
            const label = reward.name || 'Nowy kupon'
            return (
              <li key={reward.key} className={cn('rounded-xl border border-zinc-200 bg-white p-3', !reward.active && 'opacity-60', !reward.linked && 'border-amber-300')}>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_7rem]">
                  <div className="min-w-0">
                    <label htmlFor={`rw-name-${reward.key}`} className={labelClass}>Nazwa</label>
                    <input id={`rw-name-${reward.key}`} value={reward.name} maxLength={80} placeholder="np. Frytki cienkie" onChange={(event) => updateReward(reward.key, { name: event.target.value })} className={inputClass} />
                  </div>
                  <div className="min-w-0">
                    <label htmlFor={`rw-note-${reward.key}`} className={labelClass}>Opis</label>
                    <input id={`rw-note-${reward.key}`} value={reward.note} maxLength={120} onChange={(event) => updateReward(reward.key, { note: event.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor={`rw-cost-${reward.key}`} className={labelClass}>Stars</label>
                    <input id={`rw-cost-${reward.key}`} inputMode="numeric" value={reward.cost} onChange={(event) => updateReward(reward.key, { cost: event.target.value.replace(/\D/g, '') })} className={inputClass} />
                  </div>
                </div>

                <div className="mt-2.5">
                  <RewardItemsEditor
                    id={`rw-${reward.key}`}
                    items={reward.items}
                    products={data.products}
                    onChange={(items) => {
                      const first = items.find((item) => item.product_id)
                      const nameless = !reward.name.trim() && first
                      updateReward(reward.key, { items, ...(nameless ? { name: first.name } : {}) })
                    }}
                  />
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-600">
                  <span>W menu <strong className="tabular-nums text-zinc-900">{formatMoney(reward.parsed.menu_value)}</strong></span>
                  <span>Klient wydaje <strong className="tabular-nums text-zinc-900">{formatMoney(reward.eco.spendNeeded)}</strong></span>
                  <span>Koszt surowca <strong className="tabular-nums text-zinc-900">{formatMoney(reward.eco.realCost)}</strong></span>
                  <span className={cn('rounded-full px-2 py-0.5 font-bold tabular-nums', { good: 'bg-emerald-50 text-emerald-700', warn: 'bg-amber-50 text-amber-700', bad: 'bg-red-50 text-red-600' }[costTone(reward.eco.businessCostPercent)])}>
                    {formatPercent(reward.eco.businessCostPercent)} obrotu
                  </span>
                  {reward.parsed.cost !== reward.suggested && reward.parsed.menu_value > 0 && (
                    <button type="button" onClick={() => updateReward(reward.key, { cost: String(reward.suggested) })} className="rounded-full bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-800 transition-colors hover:bg-zinc-200">
                      Sugerowana cena: {reward.suggested} pkt
                    </button>
                  )}
                  {stats && <span className="tabular-nums">Ten miesiąc: {stats.periodUses}× · {formatMoney(stats.periodTotal)}</span>}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-zinc-100 pt-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
                    <input type="checkbox" checked={reward.active} onChange={(event) => updateReward(reward.key, { active: event.target.checked })} className="size-4 accent-primary" />
                    Widoczny dla klientów
                  </label>
                  <button type="button" onClick={() => removeReward(reward)} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600" aria-label={`Usuń kupon ${label}`}>
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Usuń
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="sticky bottom-3 z-10 flex justify-end">
        <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg disabled:opacity-60">
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Star className="size-4" aria-hidden="true" />}
          Zapisz kupony
        </button>
      </div>
    </form>
  )
}
