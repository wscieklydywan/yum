import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error ?? 'Nie udało się wczytać danych.')
  return data as T
}

export function Metric({ label, value, hint, tone = 'default' }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'good' | 'warn' | 'bad' }) {
  return (
    <div className="rounded-2xl border border-[#ece5dc] bg-white p-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#8b827a]">{label}</p>
      <p className={cn('mt-1 text-xl font-black tabular-nums', tone === 'good' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : tone === 'bad' ? 'text-red-600' : 'text-[#262220]')}>{value}</p>
      {hint && <p className="mt-0.5 text-xs leading-snug text-[#8b827a]">{hint}</p>}
    </div>
  )
}

export function EconomicsNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl bg-[#faf7f3] p-3.5 text-sm leading-relaxed text-[#5d5650]">
      <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function costTone(percentOfTurnover: number) {
  return percentOfTurnover <= 1 ? 'good' : percentOfTurnover <= 2 ? 'warn' : 'bad'
}
