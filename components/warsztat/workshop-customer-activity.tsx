'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Gift, History, LoaderCircle, Receipt } from 'lucide-react'
import { POINT_KIND_LABELS, type PointTransaction } from '@/lib/loyalty'
import { statusLabels, type OrderStatus } from './order-data'

type ActivityTransaction = PointTransaction & { staff: string | null }
type ActivityOrder = { id: string; number: number; status: OrderStatus; type: string; source: string | null; total: number; summary: string; created_at: string }
type ActivityReward = { id: string; reward: string; cost: number; status: string; created_at: string }
type Activity = { transactions: ActivityTransaction[]; orders: ActivityOrder[]; rewards: ActivityReward[] }

const tabs = [
  { id: 'points', label: 'Punkty', icon: History },
  { id: 'orders', label: 'Zamówienia', icon: Receipt },
  { id: 'rewards', label: 'Nagrody', icon: Gift },
] as const

const sourceLabels: Record<string, string> = { glovo: 'Glovo', pyszne: 'Pyszne.pl', yummy: 'Online', own: 'Lokal' }
const money = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })

function formatDate(value: string) {
  return new Date(value).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function fetchActivity(url: string): Promise<Activity> {
  const response = await fetch(url)
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? 'Nie udało się pobrać historii konta.')
  return result
}

function Empty({ children }: { children: string }) {
  return <p className="rounded-xl border border-dashed border-[#d8d0c7] px-3 py-5 text-center text-[12px] text-[#817871]">{children}</p>
}

export function CustomerActivity({ customerId, points }: { customerId: string; points: number }) {
  const [tab, setTab] = useState<(typeof tabs)[number]['id']>('points')
  const { data, error, isLoading } = useSWR(['/api/workshop/customers?activity=' + customerId, points], ([url]) => fetchActivity(url), {
    keepPreviousData: true,
    revalidateOnFocus: false,
  })

  const earned = data?.transactions.filter((row) => row.amount > 0).reduce((sum, row) => sum + row.amount, 0) ?? 0
  const spent = data?.transactions.filter((row) => row.amount < 0).reduce((sum, row) => sum - row.amount, 0) ?? 0

  return (
    <section aria-label="Ostatnia aktywność konta" className="mt-4 rounded-xl border border-[#eee8e1] bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-bold">Ostatnie ruchy konta</h3>
        {isLoading && <LoaderCircle className="size-4 animate-spin text-[#817871]" aria-label="Ładowanie" />}
      </div>
      {data && data.transactions.length > 0 && (
        <p className="mt-1 text-[11px] text-[#817871]">
          {'Ostatnie operacje: '}<span className="font-semibold text-emerald-700">+{earned.toLocaleString('pl-PL')} pkt</span>{' zebrane, '}
          <span className="font-semibold text-red-600">−{spent.toLocaleString('pl-PL')} pkt</span>{' wydane'}
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-[#f5f2ee] p-1" role="tablist" aria-label="Rodzaj historii">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`flex h-8 items-center justify-center gap-1 rounded-lg text-[11px] font-semibold transition-colors ${tab === id ? 'bg-white text-[#201d1a] shadow-sm' : 'text-[#6f6963] hover:text-[#201d1a]'}`}>
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3" role="tabpanel">
        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-3 text-[12px] text-red-700">{error.message}</p>
        ) : !data ? (
          <div className="flex flex-col gap-2">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-11 animate-pulse rounded-xl bg-[#f2efeb]" />)}</div>
        ) : tab === 'points' ? (
          data.transactions.length === 0 ? <Empty>Brak ruchów punktowych.</Empty> : (
            <ul className="flex max-h-80 flex-col divide-y divide-[#eee8e1] overflow-y-auto">
              {data.transactions.map((row) => (
                <li key={row.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold">{row.note || POINT_KIND_LABELS[row.kind] || row.kind}</span>
                    <span className="block truncate text-[10px] text-[#817871]">
                      {POINT_KIND_LABELS[row.kind] ?? row.kind} · {formatDate(row.created_at)}{row.staff ? ` · ${row.staff}` : ''}
                    </span>
                  </span>
                  <span className={`shrink-0 text-[12px] font-bold tabular-nums ${row.amount > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {row.amount > 0 ? '+' : '−'}{Math.abs(row.amount).toLocaleString('pl-PL')} pkt
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : tab === 'orders' ? (
          data.orders.length === 0 ? <Empty>Brak zamówień przypisanych do konta.</Empty> : (
            <ul className="flex max-h-80 flex-col divide-y divide-[#eee8e1] overflow-y-auto">
              {data.orders.map((order) => (
                <li key={order.id} className="py-2">
                  <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">
                      #{order.number} · {order.type}{order.source && sourceLabels[order.source] ? ` · ${sourceLabels[order.source]}` : ''}
                    </span>
                    <span className="shrink-0 text-[12px] font-bold tabular-nums">{money.format(order.total)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-[#817871]">{formatDate(order.created_at)} · {statusLabels[order.status] ?? order.status}</p>
                  {order.summary && <p className="mt-0.5 line-clamp-2 text-[11px] text-[#5c554f]">{order.summary}</p>}
                </li>
              ))}
            </ul>
          )
        ) : data.rewards.length === 0 ? <Empty>Klient nie odebrał jeszcze nagród.</Empty> : (
          <ul className="flex max-h-80 flex-col divide-y divide-[#eee8e1] overflow-y-auto">
            {data.rewards.map((reward) => (
              <li key={reward.id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold">{reward.reward}</span>
                  <span className="block truncate text-[10px] text-[#817871]">{formatDate(reward.created_at)} · {reward.status}</span>
                </span>
                <span className="shrink-0 text-[12px] font-bold tabular-nums text-red-600">−{reward.cost.toLocaleString('pl-PL')} pkt</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
