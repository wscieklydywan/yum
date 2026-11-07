'use client'

import { useEffect, useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Loader2, Settings2 } from 'lucide-react'
import type { MarketingOverview as Overview, MarketingSettings } from '@/lib/marketing'
import { inputClass, labelClass } from '../menu-editor/form-styles'
import { MARKETING_KEY, marketingFetcher, MarketingToggle } from './marketing-shared'

type Draft = { enabled: boolean; extraSpinEnabled: boolean; extraSpinCost: string }

export function WheelSettings({ onOpenBudget }: { onOpenBudget: () => void }) {
  const { data, error, mutate } = useSWR<Overview>(MARKETING_KEY, marketingFetcher)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data && !draft) setDraft({ enabled: data.settings.enabled, extraSpinEnabled: data.settings.extraSpinEnabled, extraSpinCost: String(data.settings.extraSpinCost) })
  }, [data, draft])

  if (error) return <p className="rounded-xl bg-red-50 p-3 sm:p-4 text-sm text-red-700">{error.message}</p>
  if (!data || !draft) return <div className="flex justify-center p-4 sm:p-6"><Loader2 className="size-5 animate-spin text-primary" aria-label="Wczytywanie" /></div>

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!data || !draft) return
    setSaving(true)
    const body: MarketingSettings = { ...data.settings, enabled: draft.enabled, extraSpinEnabled: draft.extraSpinEnabled, extraSpinCost: Number(draft.extraSpinCost) }
    try {
      const response = await fetch(MARKETING_KEY, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error ?? 'Nie udało się zapisać.')
      await mutate(result, { revalidate: false })
      toast.success('Zapisano ustawienia koła')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Nie udało się zapisać.')
    } finally {
      setSaving(false)
    }
  }

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft({ ...draft, [key]: value })
  const budget = data.settings.monthlyBudget

  return (
    <form onSubmit={save} aria-labelledby="wheel-settings-title" className="flex flex-col gap-3 rounded-xl bg-zinc-50 p-3 sm:p-4">
      <h2 id="wheel-settings-title" className="flex items-center gap-2 text-base font-black text-zinc-900"><Settings2 className="size-4 text-primary" aria-hidden="true" />Ustawienia koła</h2>
      <MarketingToggle checked={draft.enabled} onChange={(value) => update('enabled', value)} label="Pokazuj koło fortuny klientom" hint="Gdy wyłączysz, klienci nie zobaczą koła w aplikacji." />
      <MarketingToggle checked={draft.extraSpinEnabled} onChange={(value) => update('extraSpinEnabled', value)} label="Pozwól kręcić jeszcze raz za Stars" hint="Każdy ma 1 darmowe zakręcenie dziennie. Gdy to włączysz, klient może zakręcić ponownie, płacąc swoimi Stars." />
      <div className="sm:max-w-sm">
        <label htmlFor="wheel-spin-cost" className={labelClass}>Ile Stars kosztuje kolejne zakręcenie</label>
        <input id="wheel-spin-cost" inputMode="numeric" disabled={!draft.extraSpinEnabled} value={draft.extraSpinCost} onChange={(event) => update('extraSpinCost', event.target.value.replace(/\D/g, ''))} className={inputClass} />
        <p className="mt-1 text-[11px] text-zinc-500">{draft.extraSpinEnabled ? 'Tyle Stars zabierzemy klientowi za każde dodatkowe zakręcenie.' : 'Najpierw włącz opcję powyżej.'}</p>
      </div>
      <p className="text-xs text-zinc-600">
        Miesięczny limit wydatków na koło: <strong className="text-zinc-900">{budget === null ? 'bez limitu' : `${String(budget).replace('.', ',')} zł`}</strong>.{' '}
        <button type="button" onClick={onOpenBudget} className="font-bold text-primary underline-offset-2 hover:underline">Zmień w „Podsumowanie i budżet”</button>
      </p>
      <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">
        {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Zapisz ustawienia koła
      </button>
    </form>
  )
}
