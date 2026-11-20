import type { MarketingOverview } from '@/lib/marketing'

export const MARKETING_KEY = '/api/workshop/marketing'

export async function marketingFetcher(url: string): Promise<MarketingOverview> {
  const response = await fetch(url)
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error ?? 'Nie udało się wczytać danych.')
  return data
}

export function MarketingToggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3 transition-colors hover:border-zinc-300">
      <span>
        <span className="block text-sm font-bold text-zinc-900">{label}</span>
        <span className="block text-xs text-zinc-500">{hint}</span>
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
        <span aria-hidden="true" className="h-6 w-11 rounded-full bg-zinc-300 transition-colors peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40" />
        <span aria-hidden="true" className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  )
}
