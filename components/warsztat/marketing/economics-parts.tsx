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
    <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-3">
      <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', tone === 'good' ? 'bg-emerald-500' : tone === 'warn' ? 'bg-amber-500' : tone === 'bad' ? 'bg-red-500' : 'bg-zinc-200')} />
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className={cn('mt-1 text-xl font-bold tracking-tight tabular-nums', tone === 'good' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : tone === 'bad' ? 'text-red-600' : 'text-zinc-900')}>{value}</p>
      {hint && <p className="mt-0.5 text-xs leading-snug text-zinc-500">{hint}</p>}
    </div>
  )
}

export function EconomicsNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-sky-100 bg-sky-50/70 p-3 text-sm leading-relaxed text-sky-950/80">
      <Info className="mt-0.5 size-4 shrink-0 text-sky-600" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function costTone(percentOfTurnover: number) {
  return percentOfTurnover <= 1 ? 'good' : percentOfTurnover <= 2 ? 'warn' : 'bad'
}
