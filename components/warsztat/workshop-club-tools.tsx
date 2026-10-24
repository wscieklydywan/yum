'use client'

import { useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { LoaderCircle, MailPlus, Save, Send, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { describeRate, MAX_LOYALTY_POINTS, MAX_LOYALTY_SPEND, purchasePoints, type LoyaltyRate } from '@/lib/loyalty-rate'

const card = 'rounded-2xl border border-[#e5ded6] bg-white p-4 shadow-sm sm:p-5'
const inputClass = 'h-10 min-w-0 flex-1 rounded-xl border border-[#e8e3dd] bg-white px-3 text-[13px] outline-none transition-colors placeholder:text-[#8d8780] focus:border-primary'

async function fetchRate(url: string): Promise<{ rate: LoyaltyRate }> {
  const response = await fetch(url)
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? 'Nie udało się pobrać przelicznika.')
  return result
}

export function useLoyaltyRate() {
  return useSWR('/api/workshop/loyalty', fetchRate, { revalidateOnFocus: false, dedupingInterval: 60_000 })
}

export function ClubInviteCard() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = email.trim().toLowerCase()
    if (!value) return
    setBusy(true)
    try {
      const response = await fetch('/api/workshop/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error)
      toast.success(`Zaproszenie wysłane na ${value}`)
      setEmail('')
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'Nie udało się wysłać zaproszenia.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="club-invite-title" className={card}>
      <h2 id="club-invite-title" className="flex items-center gap-2 text-[15px] font-bold">
        <MailPlus className="size-[17px] text-primary" aria-hidden="true" />
        Zaproś do Yummy Club
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-[#817871]">
        Klient dostanie maila z linkiem – po kliknięciu poda imię, numer telefonu i ustawi hasło.
      </p>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <label className="sr-only" htmlFor="club-invite-email">Adres e-mail zapraszanej osoby</label>
        <input
          id="club-invite-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="klient@example.com"
          autoComplete="off"
          maxLength={254}
          className={inputClass}
          required
        />
        <button
          type="submit"
          disabled={busy}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-[12px] font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
          Wyślij
        </button>
      </form>
    </section>
  )
}

export function LoyaltyRateCard() {
  const { data, mutate } = useLoyaltyRate()
  const [draft, setDraft] = useState<{ points: string; spend: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const rate = data?.rate
  const points = draft?.points ?? (rate ? String(rate.points) : '')
  const spend = draft?.spend ?? (rate ? String(rate.spend).replace('.', ',') : '')
  const preview: LoyaltyRate = { points: Number(points), spend: Number(spend.replace(',', '.')) }
  const previewValid = Number.isInteger(preview.points) && preview.points >= 0 && preview.spend > 0

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!previewValid) {
      toast.error('Podaj poprawne wartości przelicznika.')
      return
    }
    setBusy(true)
    try {
      const response = await fetch('/api/workshop/loyalty', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preview),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      await mutate(result, { revalidate: false })
      setDraft(null)
      toast.success(`Zapisano: ${describeRate(result.rate)}`)
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'Nie udało się zapisać przelicznika.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="loyalty-rate-title" className={card}>
      <h2 id="loyalty-rate-title" className="flex items-center gap-2 text-[15px] font-bold">
        <Sparkles className="size-[17px] text-primary" aria-hidden="true" />
        Przelicznik punktów
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-[#817871]">
        Ile punktów dostaje klient Yummy Club za wydane złotówki przy zamówieniu.
      </p>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-[#5c554f]">
          Punkty
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_LOYALTY_POINTS}
            step={1}
            value={points}
            onChange={(event) => setDraft({ points: event.target.value, spend })}
            className={`${inputClass} w-24 flex-none`}
            required
          />
        </label>
        <span className="pb-2.5 text-[12px] text-[#817871]">za każde</span>
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-[#5c554f]">
          Złotych
          <input
            type="text"
            inputMode="decimal"
            value={spend}
            onChange={(event) => setDraft({ points, spend: event.target.value })}
            pattern="[0-9]+([,.][0-9]{1,2})?"
            maxLength={String(MAX_LOYALTY_SPEND).length + 3}
            className={`${inputClass} w-24 flex-none`}
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy || !draft}
          className="flex h-10 items-center gap-1.5 rounded-xl bg-[#201d1a] px-4 text-[12px] font-bold text-white transition-colors hover:bg-[#36312d] disabled:opacity-50"
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          Zapisz
        </button>
      </form>
      <p className="mt-3 rounded-xl bg-[#fbf9f6] px-3 py-2 text-[11px] text-[#5c554f]">
        {previewValid
          ? `Przykład: zamówienie za 87,50 zł = ${purchasePoints(87.5, preview)} pkt`
          : 'Wpisz wartości, aby zobaczyć przykład.'}
      </p>
    </section>
  )
}
