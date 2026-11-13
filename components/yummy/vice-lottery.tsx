'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Check, ChevronDown, Loader2, Ticket } from 'lucide-react'
import { toast } from 'sonner'
import type { LotteryStatus } from '@/lib/vice-lottery'
import { cn } from '@/lib/utils'

const KEY = '/api/club/lottery'

async function fetchStatus(url: string): Promise<LotteryStatus> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('lottery status failed')
  return response.json()
}

const RULES = [
  'Organizatorem losowania jest restauracja Yummy. Akcja trwa od 13 listopada 2026 do 18 listopada 2026, godz. 23:59:59.',
  'Udział może wziąć każdy zalogowany członek Yummy Club, który zgłosi się do losowania i zaakceptuje ten regulamin. Pracownicy Yummy nie biorą udziału.',
  'Każdy zestaw w zrealizowanym zamówieniu złożonym na Twoje konto w czasie akcji to 1 los. Im więcej zestawów, tym większa szansa na wygraną.',
  'Zestawy zamówione przed zgłoszeniem, ale w czasie akcji, też się liczą. Zamówienia anulowane i niezrealizowane nie dają losów.',
  'Losowanie odbędzie się 19 listopada 2026 o godz. 15:00. Zwycięzca zostanie wylosowany spośród wszystkich losów.',
  'Zwycięzcę powiadomimy przez Yummy Club lub telefonicznie. Na odbiór nagrody jest 7 dni od powiadomienia.',
  'Nagroda nie podlega wymianie na gotówkę ani przeniesieniu na inną osobę.',
  'Reklamacje można zgłaszać w restauracji do 7 dni po losowaniu. Organizator może wykluczyć zgłoszenia naruszające regulamin.',
]

function ticketsLabel(count: number) {
  if (count === 1) return '1 los'
  const lastTwo = count % 100
  const last = count % 10
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} losy`
  return `${count} losów`
}

export function ViceLottery() {
  const { data, mutate, isLoading } = useSWR<LotteryStatus>(KEY, fetchStatus, { revalidateOnFocus: true })
  const [rulesOpen, setRulesOpen] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [saving, setSaving] = useState(false)

  async function join() {
    setSaving(true)
    try {
      const response = await fetch(KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acceptTerms: true }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Nie udało się zapisać zgłoszenia.')
      await mutate(body, { revalidate: false })
      toast.success('Bierzesz udział w losowaniu!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się zapisać zgłoszenia.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="vice-lottery-title" className="border-t border-black/10 bg-[#1a0b24] px-3 py-3 text-white">
      <div className="flex items-center gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ff6fa8] to-[#ff8a3d]">
          <Ticket className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="vice-lottery-title" className="text-xs font-black uppercase tracking-wide">Losowanie Yummy City</h2>
          <p className="text-[10px] text-white/65">Do 18.11, 23:59:59 · losowanie 19.11, 15:00</p>
        </div>
      </div>

      {data?.joined ? (
        <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg bg-white/10 px-2.5 py-2">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#7ee2a8]">
            <Check className="size-3.5" aria-hidden="true" />
            Bierzesz udział
          </span>
          <span className="text-[11px] font-black text-[#ffd166]">{ticketsLabel(data.tickets)}</span>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setRulesOpen((value) => !value)}
        aria-expanded={rulesOpen}
        aria-controls="vice-lottery-rules"
        className="mt-2 flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-wider text-white/70 hover:text-white"
      >
        Regulamin losowania
        <ChevronDown className={cn('size-3.5 transition-transform', rulesOpen && 'rotate-180')} aria-hidden="true" />
      </button>
      {rulesOpen && (
        <ol id="vice-lottery-rules" className="mt-1.5 max-h-40 list-decimal space-y-1 overflow-y-auto rounded-lg bg-white/5 py-2 pl-6 pr-2 text-[10px] leading-snug text-white/80">
          {RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
      )}

      {isLoading ? (
        <div className="mt-2.5 flex justify-center py-1">
          <Loader2 className="size-4 animate-spin text-white/60" aria-label="Ładowanie" />
        </div>
      ) : data?.joined ? null : !data?.open ? (
        <p className="mt-2.5 text-[11px] font-semibold text-white/70">Zgłoszenia są zamknięte.</p>
      ) : !data.signedIn ? (
        <Link
          href="/yummy-club"
          className="mt-2.5 block rounded-lg bg-gradient-to-r from-[#ff6fa8] to-[#ff8a3d] px-3 py-2 text-center text-xs font-black uppercase tracking-wide"
        >
          Zaloguj się i weź udział
        </Link>
      ) : (
        <>
          <label className="mt-2.5 flex items-start gap-2 text-[10px] leading-snug text-white/80">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-0.5 size-3.5 shrink-0 accent-[#ff6fa8]"
            />
            Akceptuję regulamin losowania
          </label>
          <button
            type="button"
            onClick={join}
            disabled={!accepted || saving}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#ff6fa8] to-[#ff8a3d] px-3 py-2 text-xs font-black uppercase tracking-wide transition-opacity disabled:opacity-50"
          >
            {saving && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
            Weź udział w losowaniu
          </button>
        </>
      )}
    </section>
  )
}
