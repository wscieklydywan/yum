'use client'

import { useState } from 'react'
import { Banknote, Download, FileText, LoaderCircle, Users } from 'lucide-react'
import { toast } from 'sonner'
import type { DocumentationKind, DocumentationResponse } from '@/lib/documentation-types'

const pad = (value: number) => String(value).padStart(2, '0')
const toInput = (value: Date) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`

const presets = [
  { id: 'month', label: 'Ten miesiąc', range: (now: Date) => [new Date(now.getFullYear(), now.getMonth(), 1), now] },
  { id: 'last-month', label: 'Poprzedni miesiąc', range: (now: Date) => [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0)] },
  { id: 'quarter', label: 'Ostatnie 3 miesiące', range: (now: Date) => [new Date(now.getFullYear(), now.getMonth() - 2, 1), now] },
  { id: 'year', label: 'Ten rok', range: (now: Date) => [new Date(now.getFullYear(), 0, 1), now] },
] as const

const documents: { kind: DocumentationKind; title: string; description: string; icon: typeof FileText; usesRange: boolean }[] = [
  { kind: 'financial', title: 'Raporty finansowe', description: 'Podsumowanie okresu, zestawienie VAT i wszystkie raporty dzienne.', icon: FileText, usesRange: true },
  { kind: 'cash', title: 'Raporty kasowe', description: 'Wszystkie raporty kasowe z metodami płatności, stanem kasy i różnicami.', icon: Banknote, usesRange: true },
  { kind: 'users', title: 'Baza użytkowników', description: 'Pełna lista kont z rolami, telefonami i punktami lojalnościowymi.', icon: Users, usesRange: false },
]

const fileNames: Record<DocumentationKind, string> = { financial: 'raporty-finansowe', cash: 'raporty-kasowe', users: 'baza-uzytkownikow' }

export function WorkshopDocumentation() {
  const now = new Date()
  const [from, setFrom] = useState(() => toInput(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [to, setTo] = useState(() => toInput(now))
  const [busy, setBusy] = useState<DocumentationKind | 'all' | null>(null)

  const rangeValid = Boolean(from && to && from <= to)
  const rangeLabel = `${new Date(`${from}T00:00:00`).toLocaleDateString('pl-PL')} – ${new Date(`${to}T00:00:00`).toLocaleDateString('pl-PL')}`

  async function download(kind: DocumentationKind) {
    const params = new URLSearchParams({ kind, from, to })
    const response = await fetch(`/api/workshop/documentation?${params}`, { cache: 'no-store' })
    const data = await response.json().catch(() => null) as (DocumentationResponse & { error?: string }) | null
    if (!response.ok || !data) throw new Error(data?.error ?? 'Nie udało się pobrać danych.')
    const pdf = await import('@/lib/documentation-pdf')
    const doc = data.kind === 'financial' ? await pdf.buildFinancialPdf(data.days, rangeLabel)
      : data.kind === 'cash' ? await pdf.buildCashPdf(data.cashReports, rangeLabel)
      : await pdf.buildUsersPdf(data.users)
    const suffix = kind === 'users' ? toInput(new Date()) : `${from}_${to}`
    doc.save(`yummy-${fileNames[kind]}-${suffix}.pdf`)
  }

  async function run(target: DocumentationKind | 'all') {
    if (target !== 'users' && !rangeValid) {
      toast.error('Wybierz poprawny zakres dat.')
      return
    }
    setBusy(target)
    try {
      const kinds = target === 'all' ? documents.map((item) => item.kind) : [target]
      for (const kind of kinds) await download(kind)
      toast.success(target === 'all' ? 'Pobrano całą dokumentację.' : 'Pobrano dokument PDF.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się wygenerować PDF.')
    } finally {
      setBusy(null)
    }
  }

  const inputClass = 'mt-1.5 h-10 w-full rounded-xl border border-[#e5ded6] bg-white px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30'

  return <section className="mx-auto w-full max-w-5xl min-w-0 px-3 py-5 pb-28 sm:px-5 xl:px-6 xl:pb-8 motion-safe:animate-in motion-safe:fade-in-0 duration-300">
    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8b827a]">Szef i administrator</p>
    <h1 className="mt-1 text-[22px] font-extrabold tracking-tight sm:text-[26px]">Dokumentacja</h1>
    <p className="mt-1 text-sm text-[#786f66]">Hurtowe pobieranie raportów i bazy użytkowników w formacie PDF.</p>

    <div className="mt-5 rounded-3xl border border-[#ebe5de] bg-white p-4 sm:p-5">
      <h2 className="text-[14px] font-bold">Zakres dat</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {presets.map((preset) => {
          const [start, end] = preset.range(now)
          const active = from === toInput(start) && to === toInput(end)
          return <button key={preset.id} type="button" aria-pressed={active} onClick={() => { setFrom(toInput(start)); setTo(toInput(end)) }} className={`rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${active ? 'bg-[#201d1a] text-white' : 'bg-[#f1ede7] text-[#48423d] hover:bg-[#e8e1d9]'}`}>{preset.label}</button>
        })}
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="flex-1 text-xs font-semibold text-[#48423d]">Od<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} className={inputClass} /></label>
        <label className="flex-1 text-xs font-semibold text-[#48423d]">Do<input type="date" value={to} min={from} max={toInput(now)} onChange={(event) => setTo(event.target.value)} className={inputClass} /></label>
      </div>
      <button type="button" disabled={busy !== null} onClick={() => void run('all')} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto sm:px-5">
        {busy === 'all' ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
        Pobierz wszystko (3 pliki PDF)
      </button>
    </div>

    <ul className="mt-4 grid gap-3 md:grid-cols-3">
      {documents.map(({ kind, title, description, icon: Icon, usesRange }) => <li key={kind} className="flex flex-col rounded-3xl border border-[#ebe5de] bg-white p-4 sm:p-5">
        <span className="grid size-10 place-items-center rounded-2xl bg-[#f1ede7] text-[#201d1a]"><Icon className="size-5" aria-hidden="true" /></span>
        <h2 className="mt-3 text-[15px] font-bold">{title}</h2>
        <p className="mt-1 flex-1 text-[13px] leading-relaxed text-[#786f66]">{description}</p>
        <p className="mt-3 text-[11px] font-medium text-[#8b827a]">{usesRange ? `Okres: ${rangeValid ? rangeLabel : '—'}` : 'Stan na dziś'}</p>
        <button type="button" disabled={busy !== null} onClick={() => void run(kind)} className="mt-3 flex h-10 items-center justify-center gap-2 rounded-xl border border-[#e5ded6] text-sm font-semibold transition-colors hover:bg-[#f7f3ef] disabled:opacity-60">
          {busy === kind || (busy === 'all') ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
          Pobierz PDF
        </button>
      </li>)}
    </ul>
  </section>
}
