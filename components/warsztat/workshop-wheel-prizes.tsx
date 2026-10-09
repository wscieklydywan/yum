'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import useSWR, { mutate as globalMutate } from 'swr'
import { AlertTriangle, ArrowDown, ArrowUp, Disc3, LoaderCircle, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PrizeWheel } from '@/components/yummy/prize-wheel'
import { cn } from '@/lib/utils'
import { MAX_WHEEL_SEGMENTS, WHEEL_PRIZES_KEY, WHEEL_REWARD_LABELS, formatChance, rewardSummary, wheelIcon, type WheelPrizeAdmin } from '@/lib/wheel'
import { WheelPrizeEditor, type WheelProduct } from './wheel-editor/wheel-prize-editor'

const API = '/api/workshop/wheel'
type WheelData = { prizes: WheelPrizeAdmin[]; products: WheelProduct[] }

async function fetchWheel(url: string): Promise<WheelData> {
  const response = await fetch(url)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? 'Nie udało się wczytać nagród.')
  return data
}

async function send(method: string, body?: unknown, query = '') {
  const response = await fetch(`${API}${query}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? 'Operacja nie powiodła się.')
  return data.prizes as WheelPrizeAdmin[]
}

export function WorkshopWheelPrizes() {
  const { data, error, isLoading, mutate } = useSWR<WheelData>(API, fetchWheel)
  const [editing, setEditing] = useState<WheelPrizeAdmin | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const prizes = useMemo(() => data?.prizes ?? [], [data])
  const products = data?.products ?? []
  const active = prizes.filter((prize) => prize.active)
  const totalChance = Math.round(active.reduce((sum, prize) => sum + prize.chance, 0) * 1000) / 1000

  async function apply(action: Promise<WheelPrizeAdmin[]>, success: string) {
    const next = await action
    await mutate((current) => (current ? { ...current, prizes: next } : current), { revalidate: false })
    void globalMutate(WHEEL_PRIZES_KEY)
    toast.success(success)
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= prizes.length) return
    const order = prizes.map((prize) => prize.id)
    ;[order[index], order[target]] = [order[target], order[index]]
    setBusy(true)
    try {
      await apply(send('PUT', { order }), 'Zmieniono kolejność')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Nie udało się zmienić kolejności.')
    } finally {
      setBusy(false)
    }
  }

  function openEditor(prize: WheelPrizeAdmin | null) {
    setEditing(prize)
    setEditorOpen(true)
  }

  return (
    <section aria-labelledby="wheel-title" className="mx-auto w-full max-w-6xl p-3 sm:p-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="wheel-title" className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-[#211e1b]">
            <Disc3 className="size-5 text-primary" aria-hidden="true" />
            Koło fortuny
          </h2>
          <p className="mt-0.5 text-sm text-[#7a726a]">Nagrody, wygląd pól i szanse na wylosowanie.</p>
        </div>
        <Button onClick={() => openEditor(null)} disabled={!data || active.length >= MAX_WHEEL_SEGMENTS}>
          <Plus className="size-4" aria-hidden="true" />
          Dodaj nagrodę
        </Button>
      </header>

      {isLoading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-[#7a726a]"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Wczytywanie nagród…</p>
      ) : error ? (
        <p className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error.message}</p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className={cn('flex items-start gap-2 rounded-2xl px-4 py-3 text-sm', Math.abs(totalChance - 100) < 0.0005 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800')}>
              {Math.abs(totalChance - 100) >= 0.0005 && <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
              <p>
                Suma szans aktywnych pól: <strong className="tabular-nums">{formatChance(totalChance)}</strong>.{' '}
                {Math.abs(totalChance - 100) < 0.0005 ? 'Szanse sumują się do 100%.' : 'Szanse nie sumują się do 100% — losowanie użyje proporcji (kolumna „Rzeczywista”).'}
              </p>
            </div>

            <ul className="flex flex-col gap-2">
              {prizes.map((prize, index) => {
                const Icon = wheelIcon(prize.icon)
                const real = prize.active && totalChance > 0 ? Math.round((prize.chance / totalChance) * 100000) / 1000 : 0
                return (
                  <li key={prize.id} className={cn('flex items-center gap-3 rounded-2xl border border-[#ece6df] bg-white p-2.5 pr-3', !prize.active && 'opacity-60')}>
                    <div className="flex flex-col">
                      <button type="button" aria-label={`Przesuń ${prize.label} wyżej`} disabled={busy || index === 0} onClick={() => move(index, -1)} className="grid size-6 place-items-center rounded-md text-[#8b827a] hover:bg-[#f1ece6] disabled:opacity-30"><ArrowUp className="size-3.5" aria-hidden="true" /></button>
                      <button type="button" aria-label={`Przesuń ${prize.label} niżej`} disabled={busy || index === prizes.length - 1} onClick={() => move(index, 1)} className="grid size-6 place-items-center rounded-md text-[#8b827a] hover:bg-[#f1ece6] disabled:opacity-30"><ArrowDown className="size-3.5" aria-hidden="true" /></button>
                    </div>
                    <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-primary">
                      {prize.visual === 'image' && prize.image ? <Image src={prize.image} alt="" fill sizes="44px" className="object-cover" /> : <Icon className="size-5" aria-hidden="true" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-bold text-[#262220]">
                        {prize.label}
                        {!prize.active && <span className="rounded-full bg-[#f1ece6] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#7a726a]">Ukryte</span>}
                      </p>
                      <p className="truncate text-xs text-[#8b827a]">{WHEEL_REWARD_LABELS[prize.reward_type]} · <span className="font-semibold text-primary">{rewardSummary(prize)}</span></p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="text-sm font-bold tabular-nums text-[#262220]">{formatChance(prize.chance)}</p>
                      <p className="text-[11px] tabular-nums text-[#8b827a]">Rzeczywista {formatChance(real)}</p>
                    </div>
                    <button type="button" onClick={() => openEditor(prize)} aria-label={`Edytuj ${prize.label}`} className="grid size-10 shrink-0 place-items-center rounded-xl text-[#8b827a] hover:bg-[#f1ece6] hover:text-[#211e1b]">
                      <Pencil className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <aside className="rounded-2xl border border-[#ece6df] bg-white p-4 lg:sticky lg:top-4 lg:self-start">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#7a726a]">Podgląd dla klienta</p>
            <div className="mx-auto mt-2 w-full max-w-[240px] [container-type:inline-size]">
              <PrizeWheel prizes={active} className="max-w-full" />
            </div>
            <p className="mt-3 text-center text-xs text-[#8b827a]">{active.length} z maks. {MAX_WHEEL_SEGMENTS} aktywnych pól</p>
          </aside>
        </div>
      )}

      <WheelPrizeEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        prize={editing}
        prizes={prizes}
        products={products}
        totalChance={totalChance}
        onSave={(payload, isNew) => apply(send(isNew ? 'POST' : 'PATCH', payload), isNew ? 'Dodano nagrodę' : 'Zapisano nagrodę')}
        onDelete={(id) => apply(send('DELETE', undefined, `?id=${encodeURIComponent(id)}`), 'Usunięto nagrodę')}
      />
    </section>
  )
}
