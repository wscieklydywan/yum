'use client'

import { useEffect, useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Disc3, Loader2, TicketPercent, Wallet } from 'lucide-react'
import { formatMoney, type MarketingOverview as Overview, type MarketingSettings } from '@/lib/marketing'
import { inputClass, labelClass } from '../menu-editor/form-styles'
import { TabIntro } from './help-parts'
import { MARKETING_KEY, marketingFetcher } from './marketing-shared'

const KEY = MARKETING_KEY

function StatCard({ icon: Icon, title, total, uses, budget }: { icon: typeof Wallet; title: string; total: number; uses: number; budget?: number | null }) {
  const percent = budget ? Math.min(100, (total / budget) * 100) : null
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-4">
      <p className="flex items-center gap-2 text-xs font-bold text-zinc-600"><Icon className="size-4 text-primary" aria-hidden="true" />{title}</p>
      <p className="mt-2 text-2xl font-black tabular-nums text-zinc-900">{formatMoney(total)}</p>
      <p className="text-xs text-zinc-500">{uses} {uses === 1 ? 'użycie' : 'użyć'} w tym miesiącu</p>
      {percent !== null && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} aria-label="Wykorzystanie budżetu">
            <div className={percent >= 100 ? 'h-full bg-red-500' : percent >= 80 ? 'h-full bg-amber-500' : 'h-full bg-primary'} style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">{Math.round(percent)}% z budżetu {formatMoney(budget ?? 0)}</p>
        </div>
      )}
    </div>
  )
}

export function MarketingOverview() {
  const { data, error, isLoading, mutate } = useSWR<Overview>(KEY, marketingFetcher)
  const [draft, setDraft] = useState<{ hasBudget: boolean; budget: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data && !draft) {
      const s = data.settings
      setDraft({ hasBudget: s.monthlyBudget !== null, budget: String(s.monthlyBudget ?? 300).replace('.', ',') })
    }
  }, [data, draft])

  if (error) return <p className="rounded-xl bg-red-50 p-3 sm:p-4 text-sm text-red-700">{error.message}</p>
  if (isLoading || !data || !draft) return <div className="flex justify-center p-10"><Loader2 className="size-6 animate-spin text-primary" aria-label="Wczytywanie" /></div>

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!draft) return
    setSaving(true)
    const body: MarketingSettings = {
      ...data!.settings,
      monthlyBudget: draft.hasBudget ? Number(draft.budget.replace(',', '.')) || 0 : null,
    }
    try {
      const response = await fetch(KEY, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error ?? 'Nie udało się zapisać.')
      await mutate(result, { revalidate: false })
      toast.success('Zapisano budżet')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Nie udało się zapisać.')
    } finally {
      setSaving(false)
    }
  }

  const budget = data.settings.monthlyBudget
  const budgetReached = budget !== null && data.wheel.monthTotal >= budget
  const update = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => setDraft({ ...draft, [key]: value })

  return (
    <div className="flex flex-col gap-5">
      <TabIntro
        icon={Wallet}
        title="Podsumowanie i budżet"
        lead="Tu widzisz, ile w tym miesiącu kosztowały Was nagrody z koła fortuny i kody rabatowe. Możesz też ustawić limit, żeby koło nie wydało więcej, niż chcesz."
        steps={[
          'Sprawdź poniżej, ile wydaliście w tym miesiącu.',
          'W sekcji „Miesięczny budżet” wpisz, ile maksymalnie chcesz wydać na koło w miesiącu.',
          'Kliknij „Zapisz budżet”. Gdy limit się skończy, koło samo się wyłączy.',
        ]}
      />
      <section aria-labelledby="mk-summary" className="flex flex-col gap-3">
        <h2 id="mk-summary" className="text-base font-black text-zinc-900">Ten miesiąc w skrócie</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard icon={Wallet} title="Razem wydane na nagrody" total={data.wheel.monthTotal + data.promo.monthTotal} uses={data.wheel.monthUses + data.promo.monthUses} />
          <StatCard icon={Disc3} title="Koło fortuny" total={data.wheel.monthTotal} uses={data.wheel.monthUses} budget={budget} />
          <StatCard icon={TicketPercent} title="Kody rabatowe" total={data.promo.monthTotal} uses={data.promo.monthUses} />
        </div>
        {budgetReached && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Budżet koła na ten miesiąc został wykorzystany — koło jest automatycznie wstrzymane do 1. dnia kolejnego miesiąca.</p>}
      </section>

      <form onSubmit={save} aria-labelledby="mk-settings" className="flex flex-col gap-3 rounded-xl bg-zinc-50 p-3 sm:p-4">
        <h2 id="mk-settings" className="text-base font-black text-zinc-900">Miesięczny budżet</h2>
        <p className="text-xs text-zinc-500">Włączanie koła i koszt dodatkowych zakręceń ustawisz w „Lojalność → Koło fortuny”.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="mk-budget" className={labelClass}>Maksymalnie wydajemy na koło w miesiącu (zł)</label>
            <input id="mk-budget" inputMode="decimal" disabled={!draft.hasBudget} value={draft.hasBudget ? draft.budget : ''} placeholder="Bez limitu" onChange={(event) => update('budget', event.target.value.replace(/[^\d,.]/g, ''))} className={inputClass} />
            <label className="mt-1.5 flex items-center gap-2 text-xs text-zinc-600"><input type="checkbox" checked={!draft.hasBudget} onChange={(event) => update('hasBudget', !event.target.checked)} className="accent-primary" />Bez limitu</label>
            <p className="mt-1 text-[11px] text-zinc-500">Gdy nagrody z koła przekroczą tę kwotę, koło samo się wyłączy do 1. dnia następnego miesiąca. Ile kosztuje każda nagroda, ustawisz w zakładce „Koło fortuny”.</p>
          </div>
        </div>
        <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Zapisz budżet
        </button>
      </form>

      <section aria-labelledby="mk-costs" className="flex flex-col gap-2">
        <h2 id="mk-costs" className="text-base font-black text-zinc-900">Ile kosztowały poszczególne nagrody i kody</h2>
        {data.rows.length === 0 ? (
          <p className="rounded-xl bg-white p-3 sm:p-4 text-sm text-zinc-500">Brak wykorzystań. Koszty pojawią się, gdy klienci zaczną korzystać z kodów i koła.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
                <tr><th className="px-3 py-2">Nazwa</th><th className="px-3 py-2">Skąd</th><th className="px-3 py-2 text-right">Ten miesiąc</th><th className="px-3 py-2 text-right">Łącznie</th></tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={`${row.source}-${row.refId}`} className="border-t border-zinc-100">
                    <td className="px-3 py-2 font-semibold text-zinc-900">{row.label || '—'}</td>
                    <td className="px-3 py-2 text-zinc-600">{row.source === 'wheel' ? 'Koło' : 'Kod'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.periodTotal)}<span className="block text-[11px] text-zinc-500">{row.periodUses}×</span></td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.total)}<span className="block text-[11px] text-zinc-500">{row.uses}×</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {data.events.length > 0 && (
        <section aria-labelledby="mk-events" className="flex flex-col gap-2">
          <h2 id="mk-events" className="text-base font-black text-zinc-900">Ostatnio odebrane nagrody</h2>
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
            {data.events.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-zinc-900">{event.label}</span>
                  <span className="text-[11px] text-zinc-500">{event.source === 'wheel' ? 'Koło' : 'Kod'} · {new Date(event.created_at).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </span>
                <span className="tabular-nums text-zinc-900">{formatMoney(event.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
