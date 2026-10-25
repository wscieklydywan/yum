'use client'

import { useEffect, useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Disc3, Loader2, TicketPercent, Wallet } from 'lucide-react'
import { formatMoney, type MarketingOverview as Overview, type MarketingSettings } from '@/lib/marketing'
import { inputClass, labelClass } from '../menu-editor/form-styles'

const KEY = '/api/workshop/marketing'

async function fetcher(url: string): Promise<Overview> {
  const response = await fetch(url)
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error ?? 'Nie udało się wczytać danych.')
  return data
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-xl bg-white p-3">
      <span>
        <span className="block text-sm font-bold text-[#262220]">{label}</span>
        <span className="block text-xs text-[#8b827a]">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 size-5 accent-primary" />
    </label>
  )
}

function StatCard({ icon: Icon, title, total, uses, budget }: { icon: typeof Wallet; title: string; total: number; uses: number; budget?: number | null }) {
  const percent = budget ? Math.min(100, (total / budget) * 100) : null
  return (
    <div className="rounded-2xl border border-[#ece5dc] bg-white p-4">
      <p className="flex items-center gap-2 text-xs font-bold text-[#6f6861]"><Icon className="size-4 text-primary" aria-hidden="true" />{title}</p>
      <p className="mt-2 text-2xl font-black tabular-nums text-[#262220]">{formatMoney(total)}</p>
      <p className="text-xs text-[#8b827a]">{uses} {uses === 1 ? 'użycie' : 'użyć'} w tym miesiącu</p>
      {percent !== null && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-[#f1ece6]" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} aria-label="Wykorzystanie budżetu">
            <div className={percent >= 100 ? 'h-full bg-red-500' : percent >= 80 ? 'h-full bg-amber-500' : 'h-full bg-primary'} style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-[#8b827a]">{Math.round(percent)}% z budżetu {formatMoney(budget ?? 0)}</p>
        </div>
      )}
    </div>
  )
}

export function MarketingOverview() {
  const { data, error, isLoading, mutate } = useSWR(KEY, fetcher)
  const [draft, setDraft] = useState<{ enabled: boolean; extraSpinEnabled: boolean; extraSpinCost: string; hasBudget: boolean; budget: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data && !draft) {
      const s = data.settings
      setDraft({ enabled: s.enabled, extraSpinEnabled: s.extraSpinEnabled, extraSpinCost: String(s.extraSpinCost), hasBudget: s.monthlyBudget !== null, budget: String(s.monthlyBudget ?? 300).replace('.', ',') })
    }
  }, [data, draft])

  if (error) return <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error.message}</p>
  if (isLoading || !data || !draft) return <div className="flex justify-center p-10"><Loader2 className="size-6 animate-spin text-primary" aria-label="Wczytywanie" /></div>

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!draft) return
    setSaving(true)
    const body: MarketingSettings = {
      enabled: draft.enabled,
      extraSpinEnabled: draft.extraSpinEnabled,
      extraSpinCost: Number(draft.extraSpinCost),
      monthlyBudget: draft.hasBudget ? Number(draft.budget.replace(',', '.')) || 0 : null,
    }
    try {
      const response = await fetch(KEY, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error ?? 'Nie udało się zapisać.')
      await mutate(result, { revalidate: false })
      toast.success('Zapisano ustawienia marketingu')
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
      <section aria-labelledby="mk-summary" className="flex flex-col gap-3">
        <h2 id="mk-summary" className="text-base font-black text-[#262220]">Ten miesiąc w skrócie</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard icon={Wallet} title="Łączny koszt" total={data.wheel.monthTotal + data.promo.monthTotal} uses={data.wheel.monthUses + data.promo.monthUses} />
          <StatCard icon={Disc3} title="Koło fortuny" total={data.wheel.monthTotal} uses={data.wheel.monthUses} budget={budget} />
          <StatCard icon={TicketPercent} title="Kody rabatowe" total={data.promo.monthTotal} uses={data.promo.monthUses} />
        </div>
        {budgetReached && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Budżet koła na ten miesiąc został wykorzystany — koło jest automatycznie wstrzymane do 1. dnia kolejnego miesiąca.</p>}
      </section>

      <form onSubmit={save} aria-labelledby="mk-settings" className="flex flex-col gap-3 rounded-2xl bg-[#faf7f3] p-4">
        <h2 id="mk-settings" className="text-base font-black text-[#262220]">Ustawienia koła fortuny</h2>
        <Toggle checked={draft.enabled} onChange={(value) => update('enabled', value)} label="Koło fortuny włączone" hint="Wyłącz, aby ukryć koło przed klientami." />
        <Toggle checked={draft.extraSpinEnabled} onChange={(value) => update('extraSpinEnabled', value)} label="Dodatkowe zakręcenia za punkty" hint="Klient może kręcić ponownie po darmowym zakręceniu." />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="mk-spin-cost" className={labelClass}>Koszt dodatkowego zakręcenia (pkt)</label>
            <input id="mk-spin-cost" inputMode="numeric" disabled={!draft.extraSpinEnabled} value={draft.extraSpinCost} onChange={(event) => update('extraSpinCost', event.target.value.replace(/\D/g, ''))} className={inputClass} />
          </div>
          <div>
            <label htmlFor="mk-budget" className={labelClass}>Miesięczny budżet koła (zł)</label>
            <input id="mk-budget" inputMode="decimal" disabled={!draft.hasBudget} value={draft.hasBudget ? draft.budget : ''} placeholder="Bez limitu" onChange={(event) => update('budget', event.target.value.replace(/[^\d,.]/g, ''))} className={inputClass} />
            <label className="mt-1.5 flex items-center gap-2 text-xs text-[#5d5650]"><input type="checkbox" checked={!draft.hasBudget} onChange={(event) => update('hasBudget', !event.target.checked)} className="accent-primary" />Bez limitu</label>
            <p className="mt-1 text-[11px] text-[#8b827a]">Po przekroczeniu koło samo się wstrzyma do końca miesiąca. Koszt nagród ustawisz w zakładce „Koło fortuny”.</p>
          </div>
        </div>
        <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Zapisz ustawienia
        </button>
      </form>

      <section aria-labelledby="mk-costs" className="flex flex-col gap-2">
        <h2 id="mk-costs" className="text-base font-black text-[#262220]">Ile kosztowały poszczególne nagrody i kody</h2>
        {data.rows.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-[#8b827a]">Brak wykorzystań. Koszty pojawią się, gdy klienci zaczną korzystać z kodów i koła.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#ece5dc] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#faf7f3] text-[11px] uppercase tracking-wide text-[#8b827a]">
                <tr><th className="px-3 py-2">Nazwa</th><th className="px-3 py-2">Źródło</th><th className="px-3 py-2 text-right">Ten miesiąc</th><th className="px-3 py-2 text-right">Łącznie</th></tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={`${row.source}-${row.refId}`} className="border-t border-[#f1ece6]">
                    <td className="px-3 py-2 font-semibold text-[#262220]">{row.label || '—'}</td>
                    <td className="px-3 py-2 text-[#6f6861]">{row.source === 'wheel' ? 'Koło' : 'Kod'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.periodTotal)}<span className="block text-[11px] text-[#8b827a]">{row.periodUses}×</span></td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.total)}<span className="block text-[11px] text-[#8b827a]">{row.uses}×</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {data.events.length > 0 && (
        <section aria-labelledby="mk-events" className="flex flex-col gap-2">
          <h2 id="mk-events" className="text-base font-black text-[#262220]">Ostatnie wykorzystania</h2>
          <ul className="divide-y divide-[#f1ece6] rounded-2xl border border-[#ece5dc] bg-white">
            {data.events.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-[#262220]">{event.label}</span>
                  <span className="text-[11px] text-[#8b827a]">{event.source === 'wheel' ? 'Koło' : 'Kod'} · {new Date(event.created_at).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </span>
                <span className="tabular-nums text-[#262220]">{formatMoney(event.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
