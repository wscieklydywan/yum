'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { CalendarClock, Copy, LoaderCircle, Pencil, Plus, TicketPercent, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PROMO_STATUS_LABELS, promoRewardSummary, promoStatus, type PromoCode, type PromoStatus } from '@/lib/promo-codes'
import { PromoCodeEditor, type PromoProduct } from './promo-code-editor'

const API = '/api/workshop/promo-codes'
type PromoData = { codes: PromoCode[]; products: PromoProduct[] }

const statusStyles: Record<PromoStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  inactive: 'bg-[#f1efec] text-[#777068]',
  expired: 'bg-amber-50 text-amber-700',
  exhausted: 'bg-red-50 text-red-700',
}

async function fetchCodes(url: string): Promise<PromoData> {
  const response = await fetch(url)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? 'Nie udało się wczytać kodów.')
  return data
}

async function send(method: string, body?: unknown, query = '') {
  const response = await fetch(`${API}${query}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? 'Operacja nie powiodła się.')
  return data.codes as PromoCode[]
}

const dateFormat = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export function WorkshopPromoCodes() {
  const { data, error, isLoading, mutate } = useSWR<PromoData>(API, fetchCodes)
  const [editing, setEditing] = useState<PromoCode | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const codes = data?.codes ?? []

  async function apply(action: Promise<PromoCode[]>, success: string) {
    const next = await action
    await mutate((current) => (current ? { ...current, codes: next } : current), { revalidate: false })
    toast.success(success)
  }

  function openEditor(promo: PromoCode | null) {
    setEditing(promo)
    setEditorOpen(true)
  }

  async function copy(code: string) {
    await navigator.clipboard?.writeText(code).catch(() => undefined)
    toast.success(`Skopiowano ${code}`)
  }

  return (
    <section aria-labelledby="promo-title">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="promo-title" className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-[#211e1b]">
            <TicketPercent className="size-5 text-primary" aria-hidden="true" />
            Kody rabatowe
          </h2>
          <p className="mt-0.5 text-sm text-[#7a726a]">Własne kody: darmowe produkty, rabaty lub punkty, z limitem użyć i terminem ważności.</p>
        </div>
        <Button onClick={() => openEditor(null)} disabled={!data}>
          <Plus className="size-4" aria-hidden="true" />
          Nowy kod
        </Button>
      </header>

      {isLoading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-[#7a726a]"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Wczytywanie kodów…</p>
      ) : error ? (
        <p className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error.message}</p>
      ) : !codes.length ? (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#e2dad1] bg-white px-4 py-10 text-center">
          <TicketPercent className="size-8 text-[#c9bfb4]" aria-hidden="true" />
          <p className="text-sm text-[#7a726a]">Nie masz jeszcze żadnych kodów rabatowych.</p>
          <Button variant="outline" onClick={() => openEditor(null)}><Plus className="size-4" aria-hidden="true" />Utwórz pierwszy kod</Button>
        </div>
      ) : (
        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {codes.map((promo) => {
            const status = promoStatus(promo)
            return (
              <li key={promo.id} className={cn('flex flex-col gap-3 rounded-2xl border border-[#ece6df] bg-white p-3.5', status !== 'active' && 'bg-[#fcfbf9]')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <button type="button" onClick={() => copy(promo.code)} className="group inline-flex max-w-full items-center gap-1.5 rounded-lg border-2 border-dashed border-primary/35 bg-primary/5 px-2 py-0.5 font-mono text-sm font-extrabold tracking-wider text-primary hover:bg-primary/10">
                      <span className="truncate">{promo.code}</span>
                      <Copy className="size-3.5 shrink-0 opacity-60 group-hover:opacity-100" aria-hidden="true" />
                      <span className="sr-only">Kopiuj kod</span>
                    </button>
                    <p className="mt-1.5 text-sm font-bold text-[#262220]">{promoRewardSummary(promo)}</p>
                    {promo.description && <p className="truncate text-xs text-[#7a726a]">{promo.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className={cn('rounded-full px-2 py-1 text-[10px] font-bold', statusStyles[status])}>{PROMO_STATUS_LABELS[status]}</span>
                    <button type="button" onClick={() => openEditor(promo)} aria-label={`Edytuj kod ${promo.code}`} className="grid size-8 place-items-center rounded-lg text-[#8b827a] hover:bg-[#f1ece6] hover:text-[#211e1b]"><Pencil className="size-4" aria-hidden="true" /></button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[#f0ece7] pt-2.5 text-[11px] text-[#7a726a]">
                  <span className="flex items-center gap-1"><Users className="size-3.5" aria-hidden="true" />Użyto <strong className="tabular-nums text-[#262220]">{promo.uses_count}{promo.max_uses !== null ? ` / ${promo.max_uses}` : ''}</strong>{promo.max_uses === null && ' · bez limitu'}</span>
                  <span className="flex items-center gap-1"><CalendarClock className="size-3.5" aria-hidden="true" />{promo.expires_at ? <>Do <strong className="text-[#262220]">{dateFormat.format(new Date(promo.expires_at))}</strong></> : 'Bezterminowo'}</span>
                  <span>{promo.per_user_limit}× na klienta</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <PromoCodeEditor
        open={editorOpen}
        promo={editing}
        products={data?.products ?? []}
        onOpenChange={setEditorOpen}
        onSave={(payload) => apply(send(payload.id ? 'PATCH' : 'POST', payload), payload.id ? 'Zapisano kod' : 'Dodano kod')}
        onDelete={(id) => apply(send('DELETE', undefined, `?id=${encodeURIComponent(id)}`), 'Usunięto kod')}
      />
    </section>
  )
}
