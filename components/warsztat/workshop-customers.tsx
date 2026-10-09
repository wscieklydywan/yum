'use client'

import { useEffect, useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { ChevronLeft, ChevronRight, Coins, LoaderCircle, Plus, Search, UserRound, Users } from 'lucide-react'
import { toast } from 'sonner'
import { getTier, MAX_STAFF_POINTS } from '@/lib/loyalty'
import type { UserRole } from './workshop-access'

type Customer = { id: string; email: string; full_name: string | null; points: number; created_at: string }
type CustomerPage = { items: Customer[]; nextCursor: string | null }

const quickAmounts = [10, 25, 50, 100]
const card = 'rounded-2xl border border-[#e5ded6] bg-white p-4 shadow-sm sm:p-5'
const inputClass = 'h-10 min-w-0 flex-1 rounded-xl border border-[#e8e3dd] bg-white px-3 text-[13px] outline-none transition-colors placeholder:text-[#8d8780] focus:border-primary'

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? 'Błąd pobierania danych.')
  return result
}

function CustomerPoints({ customer, onUpdated }: { customer: Customer; onUpdated: (points: number) => void }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const tier = getTier(customer.points)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = Number(amount)
    if (!Number.isInteger(value) || value < 1 || value > MAX_STAFF_POINTS) {
      toast.error(`Podaj liczbę punktów od 1 do ${MAX_STAFF_POINTS}.`)
      return
    }
    setBusy(true)
    try {
      const response = await fetch('/api/workshop/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: customer.id, amount: value, note }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      onUpdated(result.points)
      setAmount('')
      setNote('')
      toast.success(`Dodano ${value} pkt dla ${customer.email}`)
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'Nie udało się dodać punktów.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-[#eee8e1] bg-[#fbf9f6] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><UserRound className="size-5" aria-hidden="true" /></span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold">{customer.full_name || customer.email.split('@')[0]}</p>
            <p className="truncate text-[11px] text-[#817871]">{customer.email}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="flex items-center justify-end gap-1 text-[18px] font-extrabold tabular-nums"><Coins className="size-4 text-[#e0a21f]" aria-hidden="true" />{customer.points.toLocaleString('pl-PL')}</p>
          <p className={`text-[10px] font-semibold ${tier.color}`}>{tier.name}</p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Szybki wybór punktów">
          {quickAmounts.map((value) => (
            <button key={value} type="button" onClick={() => setAmount(String(value))} aria-pressed={amount === String(value)} className={`h-8 rounded-lg px-3 text-[12px] font-semibold transition-colors ${amount === String(value) ? 'bg-primary text-white' : 'bg-white text-[#3e3833] ring-1 ring-[#e5ded6] hover:bg-[#f5f2ee]'}`}>+{value}</button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor={`points-${customer.id}`}>Liczba punktów</label>
          <input id={`points-${customer.id}`} type="number" inputMode="numeric" min={1} max={MAX_STAFF_POINTS} step={1} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Punkty" className={`${inputClass} sm:max-w-28`} required />
          <label className="sr-only" htmlFor={`note-${customer.id}`}>Notatka</label>
          <input id={`note-${customer.id}`} value={note} onChange={(event) => setNote(event.target.value)} maxLength={120} placeholder="Notatka, np. zamówienie #1042 (opcjonalnie)" className={inputClass} />
          <button type="submit" disabled={busy || !amount} className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-[12px] font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-60">
            {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            Dodaj punkty
          </button>
        </div>
      </form>
    </div>
  )
}

function CustomerLookup({ selected, onSelect }: { selected: Customer | null; onSelect: (customer: Customer | null) => void }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [notFound, setNotFound] = useState('')

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = email.trim().toLowerCase()
    if (!value) return
    setBusy(true)
    setNotFound('')
    try {
      const result = await fetchJson<{ customer: Customer | null }>(`/api/workshop/customers?email=${encodeURIComponent(value)}`)
      onSelect(result.customer)
      if (!result.customer) setNotFound(`Nie znaleziono klienta z adresem ${value}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się wyszukać klienta.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="customer-lookup-title" className={card}>
      <h2 id="customer-lookup-title" className="flex items-center gap-2 text-[15px] font-bold"><Coins className="size-[17px] text-primary" aria-hidden="true" />Dodaj punkty klientowi</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-[#817871]">Wpisz pełny adres e-mail konta Yummy Club, aby wyszukać klienta.</p>
      <form onSubmit={search} className="mt-3 flex gap-2">
        <label className="sr-only" htmlFor="customer-email">Adres e-mail klienta</label>
        <input id="customer-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="klient@example.com" autoComplete="off" className={inputClass} required />
        <button type="submit" disabled={busy} className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[#201d1a] px-4 text-[12px] font-bold text-white transition-colors hover:bg-[#36312d] disabled:opacity-60">
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Search className="size-4" aria-hidden="true" />}
          Szukaj
        </button>
      </form>
      <p aria-live="polite" className="text-[12px] text-[#817871]">{notFound && <span className="mt-3 block rounded-xl border border-dashed border-[#d8d0c7] px-3 py-3 text-center">{notFound}</span>}</p>
      {selected && <CustomerPoints key={selected.id} customer={selected} onUpdated={(points) => onSelect({ ...selected, points })} />}
    </section>
  )
}

function CustomerList({ selectedId, onSelect, refreshKey }: { selectedId: string | null; onSelect: (customer: Customer) => void; refreshKey: number }) {
  const [filter, setFilter] = useState('')
  const [query, setQuery] = useState('')
  const [cursors, setCursors] = useState<(string | null)[]>([null])
  const cursor = cursors[cursors.length - 1]

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const next = filter.trim().toLowerCase()
      setQuery(next.length >= 2 ? next : '')
      setCursors([null])
    }, 450)
    return () => window.clearTimeout(timeout)
  }, [filter])

  const params = new URLSearchParams({ list: '1' })
  if (query) params.set('q', query)
  if (cursor) params.set('cursor', cursor)
  const { data, error, isLoading, isValidating, mutate } = useSWR<CustomerPage>(`/api/workshop/customers?${params}`, fetchJson, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  useEffect(() => {
    if (refreshKey) void mutate()
  }, [refreshKey, mutate])

  return (
    <section aria-labelledby="customer-list-title" className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="customer-list-title" className="flex items-center gap-2 text-[15px] font-bold"><Users className="size-[17px] text-primary" aria-hidden="true" />Wszyscy klienci</h2>
        {isValidating && <LoaderCircle className="size-4 animate-spin text-[#817871]" aria-label="Ładowanie" />}
      </div>
      <label className="mt-3 flex h-10 items-center gap-2 rounded-xl border border-[#e8e3dd] bg-white px-3">
        <Search className="size-4 shrink-0 text-[#6f6963]" aria-hidden="true" />
        <span className="sr-only">Filtruj po początku adresu e-mail</span>
        <input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filtruj po początku e-maila…" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#8d8780]" />
      </label>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-3 text-[12px] text-red-700">{error.message}</p>
      ) : isLoading && !data ? (
        <div className="mt-4 flex flex-col gap-2">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-12 animate-pulse rounded-xl bg-[#f2efeb]" />)}</div>
      ) : data && data.items.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-[#d8d0c7] px-3 py-6 text-center text-[12px] text-[#817871]">{query ? 'Brak klientów pasujących do filtra.' : 'Nie ma jeszcze żadnych klientów.'}</p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-[#eee8e1] overflow-hidden rounded-xl border border-[#eee8e1]">
          {data?.items.map((customer) => (
            <li key={customer.id}>
              <button type="button" onClick={() => onSelect(customer)} aria-pressed={selectedId === customer.id} className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${selectedId === customer.id ? 'bg-primary/5' : 'hover:bg-[#faf8f5]'}`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold">{customer.email}</span>
                  <span className="block truncate text-[10px] text-[#817871]">{customer.full_name || 'Bez imienia'} · od {new Date(customer.created_at).toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw' })}</span>
                </span>
                <span className="shrink-0 text-[12px] font-bold tabular-nums">{customer.points.toLocaleString('pl-PL')} pkt</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <button type="button" onClick={() => setCursors((current) => current.slice(0, -1))} disabled={cursors.length <= 1} className="flex h-9 items-center gap-1 rounded-xl px-3 text-[12px] font-semibold text-[#3e3833] ring-1 ring-[#e5ded6] transition-colors hover:bg-[#f5f2ee] disabled:opacity-40"><ChevronLeft className="size-4" aria-hidden="true" />Poprzednia</button>
        <span className="text-[11px] text-[#817871]">Strona {cursors.length}</span>
        <button type="button" onClick={() => data?.nextCursor && setCursors((current) => [...current, data.nextCursor])} disabled={!data?.nextCursor} className="flex h-9 items-center gap-1 rounded-xl px-3 text-[12px] font-semibold text-[#3e3833] ring-1 ring-[#e5ded6] transition-colors hover:bg-[#f5f2ee] disabled:opacity-40">Następna<ChevronRight className="size-4" aria-hidden="true" /></button>
      </div>
    </section>
  )
}

export function WorkshopCustomers({ userRole }: { userRole: UserRole }) {
  const [selected, setSelected] = useState<Customer | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const isAdmin = userRole === 'admin' || userRole === 'szef'

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b827a]">Yummy Club</p>
        <h1 className="mt-1 text-[21px] font-extrabold tracking-tight sm:text-[24px]">Klienci i punkty</h1>
      </div>
      <div className={`grid items-start gap-4 ${isAdmin ? 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : 'max-w-2xl'}`}>
        <CustomerLookup
          selected={selected}
          onSelect={(customer) => {
            if (customer && selected?.id === customer.id && customer.points !== selected.points) setRefreshKey((key) => key + 1)
            setSelected(customer)
          }}
        />
        {isAdmin && <CustomerList selectedId={selected?.id ?? null} onSelect={setSelected} refreshKey={refreshKey} />}
      </div>
    </div>
  )
}
