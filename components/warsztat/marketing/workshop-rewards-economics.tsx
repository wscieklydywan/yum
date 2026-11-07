'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Loader2, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/marketing'
import { REWARDS_ADMIN_KEY, formatPercent, rewardEconomics, spendPerStar, starRealCost, type RewardsAdminData } from '@/lib/loyalty-economics'
import { cleanDecimal, inputClass, labelClass } from '../menu-editor/form-styles'
import { costTone, EconomicsNote, fetchJson, Metric } from './economics-parts'
import { TabIntro } from './help-parts'

type DraftReward = { key: string; name: string; note: string; cost: string; menu_value: string; active: boolean }
type Draft = { foodCost: string; rewards: DraftReward[] }

const toNumber = (value: string) => Number(value.replace(',', '.')) || 0

function toDraft(data: RewardsAdminData): Draft {
  return {
    foodCost: String(data.foodCostPercent).replace('.', ','),
    rewards: data.rewards.map((reward) => ({
      key: reward.key,
      name: reward.name,
      note: reward.note,
      cost: String(reward.cost),
      menu_value: String(reward.menu_value).replace('.', ','),
      active: reward.active,
    })),
  }
}

export function WorkshopRewardsEconomics() {
  const { data, error, isLoading, mutate } = useSWR<RewardsAdminData>(REWARDS_ADMIN_KEY, fetchJson)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data && !draft) setDraft(toDraft(data))
  }, [data, draft])

  const live = useMemo(() => {
    if (!draft || !data) return null
    const foodCost = toNumber(draft.foodCost)
    const rewards = draft.rewards.map((reward) => {
      const parsed = { cost: Math.max(1, Math.round(toNumber(reward.cost))), menu_value: toNumber(reward.menu_value), active: reward.active }
      return { ...reward, parsed, eco: rewardEconomics(parsed, data.rate, foodCost) }
    })
    const active = rewards.filter((reward) => reward.active)
    const avg = (pick: (item: (typeof rewards)[number]) => number) => (active.length ? active.reduce((sum, item) => sum + pick(item), 0) / active.length : 0)
    return {
      foodCost,
      rewards,
      starCost: starRealCost(rewards.map((reward) => reward.parsed), foodCost),
      worstCost: active.reduce((max, item) => Math.max(max, item.eco.businessCostPercent), 0),
      avgReturn: avg((item) => item.eco.customerReturnPercent),
      avgCost: avg((item) => item.eco.businessCostPercent),
    }
  }, [draft, data])

  if (error) return <p className="rounded-xl bg-red-50 p-3 sm:p-4 text-sm text-red-700">{error.message}</p>
  if (isLoading || !data || !draft || !live) return <div className="flex justify-center p-10"><Loader2 className="size-6 animate-spin text-primary" aria-label="Wczytywanie" /></div>

  const zlPerStar = spendPerStar(data.rate)
  const monthCost = data.rewards.reduce((sum, reward) => sum + reward.stats.periodTotal, 0)
  const monthUses = data.rewards.reduce((sum, reward) => sum + reward.stats.periodUses, 0)
  const updateReward = (key: string, patch: Partial<DraftReward>) =>
    setDraft({ ...draft, rewards: draft.rewards.map((reward) => (reward.key === key ? { ...reward, ...patch } : reward)) })

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!draft) return
    setSaving(true)
    try {
      const response = await fetch(REWARDS_ADMIN_KEY, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foodCostPercent: toNumber(draft.foodCost),
          rewards: draft.rewards.map((reward) => ({ ...reward, cost: Math.round(toNumber(reward.cost)), menu_value: toNumber(reward.menu_value) })),
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error ?? 'Nie udało się zapisać.')
      await mutate(result, { revalidate: false })
      setDraft(toDraft(result))
      toast.success('Zapisano nagrody')
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
        title="Nagrody za Stars"
        lead={<>Za każde zamówienie klient zbiera punkty (Stars): {formatMoney(zlPerStar)} wydane = 1 Star. Potem wymienia je na jedzenie z tej listy. Tu ustalasz, ile punktów kosztuje każda nagroda.</>}
        steps={[
          'Przy każdej nagrodzie wpisz, ile Stars musi mieć klient.',
          'Kolorowy pasek pokaże, czy to się opłaca: zielony = OK, żółty = uważaj, czerwony = za drogo.',
          'Kliknij „Zapisz” na dole.',
        ]}
      />
      <section aria-labelledby="rw-summary" className="flex flex-col gap-3">
        <div>
          <h2 id="rw-summary" className="text-base font-black text-zinc-900">Ile Cię to kosztuje?</h2>
          <p className="text-sm text-zinc-500">Liczymy sami i od razu przeliczamy, gdy zmieniasz ceny niżej.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Za ile 1 Star" value={`${formatMoney(zlPerStar)} = 1 Star`} hint="Zmienisz w Yummy Club → Punkty i złotówki" />
          <Metric label="Klient dostaje z powrotem" value={formatPercent(live.avgReturn)} hint="Średnio z każdej wydanej złotówki" />
          <Metric label="Ty oddajesz" value={formatPercent(live.avgCost)} tone={costTone(live.worstCost)} hint={`Z każdej złotówki obrotu (najwięcej ${formatPercent(live.worstCost)})`} />
          <Metric label="W tym miesiącu" value={formatMoney(monthCost)} hint={`${monthUses} odebranych nagród`} />
        </div>
        <EconomicsNote>
          <p>
            Jeden punkt kosztuje Cię najwyżej <strong className="tabular-nums">{formatMoney(live.starCost)}</strong>. Tanie nagrody (sos, dodatki) ustaw nisko, żeby klienci szybko coś dostali i wracali. Drogie – wysoko. Do 1% obrotu jest zielono, do 2% żółto, wyżej czerwono.
          </p>
        </EconomicsNote>
        <div className="max-w-xs">
          <label htmlFor="rw-food-cost" className={labelClass}>Ile % ceny dania to koszt składników?</label>
          <input id="rw-food-cost" inputMode="decimal" value={draft.foodCost} onChange={(event) => setDraft({ ...draft, foodCost: cleanDecimal(event.target.value).replace('.', ',') })} className={inputClass} />
          <p className="mt-1 text-[11px] text-zinc-500">Np. burger za 30 zł, składniki 9 zł = 30%. Nie wiesz? Zostaw jak jest.</p>
        </div>
      </section>

      <section aria-labelledby="rw-list" className="flex flex-col gap-2">
        <h2 id="rw-list" className="text-base font-black text-zinc-900">Lista nagród</h2>
        <ul className="flex flex-col gap-2">
          {live.rewards.map((reward) => {
            const stats = data.rewards.find((item) => item.key === reward.key)?.stats
            return (
              <li key={reward.key} className={cn('rounded-xl border border-zinc-200 bg-white p-3', !reward.active && 'opacity-60')}>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_6rem_7rem]">
                  <div className="min-w-0">
                    <label htmlFor={`rw-name-${reward.key}`} className={labelClass}>Nazwa</label>
                    <input id={`rw-name-${reward.key}`} value={reward.name} maxLength={80} onChange={(event) => updateReward(reward.key, { name: event.target.value })} className={inputClass} />
                  </div>
                  <div className="min-w-0">
                    <label htmlFor={`rw-note-${reward.key}`} className={labelClass}>Opis</label>
                    <input id={`rw-note-${reward.key}`} value={reward.note} maxLength={120} onChange={(event) => updateReward(reward.key, { note: event.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor={`rw-cost-${reward.key}`} className={labelClass}>Stars</label>
                    <input id={`rw-cost-${reward.key}`} inputMode="numeric" value={reward.cost} onChange={(event) => updateReward(reward.key, { cost: event.target.value.replace(/\D/g, '') })} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor={`rw-value-${reward.key}`} className={labelClass}>Cena w menu</label>
                    <input id={`rw-value-${reward.key}`} inputMode="decimal" value={reward.menu_value} onChange={(event) => updateReward(reward.key, { menu_value: cleanDecimal(event.target.value).replace('.', ',') })} className={inputClass} />
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-600">
                  <span>Klient wydaje <strong className="tabular-nums text-zinc-900">{formatMoney(reward.eco.spendNeeded)}</strong></span>
                  <span>Odzyskuje <strong className="tabular-nums text-zinc-900">{formatPercent(reward.eco.customerReturnPercent)}</strong></span>
                  <span>Koszt surowca <strong className="tabular-nums text-zinc-900">{formatMoney(reward.eco.realCost)}</strong></span>
                  <span className={cn('rounded-full px-2 py-0.5 font-bold tabular-nums', { good: 'bg-emerald-50 text-emerald-700', warn: 'bg-amber-50 text-amber-700', bad: 'bg-red-50 text-red-600' }[costTone(reward.eco.businessCostPercent)])}>
                    {formatPercent(reward.eco.businessCostPercent)} obrotu
                  </span>
                  {stats && <span className="tabular-nums">Ten miesiąc: {stats.periodUses}× · {formatMoney(stats.periodTotal)}</span>}
                  <label className="ml-auto flex items-center gap-2 font-semibold text-zinc-900">
                    <input type="checkbox" checked={reward.active} onChange={(event) => updateReward(reward.key, { active: event.target.checked })} className="size-4 accent-primary" />
                    Widoczna dla klientów
                  </label>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="sticky bottom-3 z-10 flex justify-end">
        <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg disabled:opacity-60">
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Star className="size-4" aria-hidden="true" />}
          Zapisz nagrody
        </button>
      </div>
    </form>
  )
}
