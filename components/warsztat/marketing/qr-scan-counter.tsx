'use client'

import useSWR from 'swr'
import { Loader2, RefreshCw, ScanLine } from 'lucide-react'
import { dashboardFetcher } from '@/lib/marketing-dashboard'

export const QR_SCANS_KEY = '/api/workshop/qr-scans'

export type QrScanRow = { campaign: string; total: number; month: number; week: number; ios: number; android: number; lastAt: string | null }
export type QrScanSummary = { rows: QrScanRow[]; total: number; month: number; week: number; installs: number; available: boolean }

const number = new Intl.NumberFormat('pl-PL')

export function QrScanCounter({ onPick }: { onPick: (campaign: string) => void }) {
  // Not time-critical: one query when the tab opens, then only on demand.
  const { data, error, isLoading, isValidating, mutate } = useSWR<QrScanSummary>(QR_SCANS_KEY, dashboardFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
  })

  return (
    <section aria-labelledby="qr-scans" className="flex flex-col gap-3 border-t border-zinc-200 pt-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><ScanLine className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h3 id="qr-scans" className="text-base font-black text-zinc-900">Licznik skanowań</h3>
          <p className="text-xs leading-relaxed text-zinc-500">Każde zeskanowanie kodu z tej zakładki liczy się raz na sesję, osobno dla każdego miejsca.</p>
        </div>
        <button
          type="button"
          onClick={() => void mutate()}
          disabled={isValidating}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <RefreshCw className={isValidating ? 'size-3.5 animate-spin' : 'size-3.5'} aria-hidden="true" />
          Odśwież
        </button>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error.message}</p>
      ) : isLoading || !data ? (
        <div className="flex justify-center p-6"><Loader2 className="size-5 animate-spin text-primary" aria-label="Wczytywanie" /></div>
      ) : !data.available ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Licznik nie jest jeszcze aktywny w bazie danych (brak tabeli skanowań).</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Łącznie" value={data.total} />
            <Stat label="Ten miesiąc" value={data.month} />
            <Stat label="Ostatnie 7 dni" value={data.week} />
            <Stat label="Instalacje aplikacji" value={data.installs} />
          </div>
          {data.rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">Nikt jeszcze nie zeskanował kodu. Wydrukuj go i postaw na stolikach albo dodaj do ulotek.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-bold">Miejsce</th>
                    <th className="px-3 py-2 text-right font-bold">Miesiąc</th>
                    <th className="px-3 py-2 text-right font-bold">Łącznie</th>
                    <th className="hidden px-3 py-2 text-right font-bold sm:table-cell">iPhone / Android</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.campaign} className="border-t border-zinc-100">
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => onPick(row.campaign)} className="font-semibold text-zinc-900 underline-offset-4 hover:underline" title="Użyj tego miejsca w kodzie">{row.campaign}</button>
                        {row.lastAt && <span className="block text-[11px] text-zinc-500">{`ostatnio ${new Date(row.lastAt).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}`}</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums text-zinc-900">{number.format(row.month)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-700">{number.format(row.total)}</td>
                      <td className="hidden px-3 py-2 text-right tabular-nums text-zinc-500 sm:table-cell">{`${number.format(row.ios)} / ${number.format(row.android)}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <p className="text-[11px] font-semibold text-zinc-500">{label}</p>
      <p className="mt-0.5 text-xl font-black tabular-nums text-zinc-900">{number.format(value)}</p>
    </div>
  )
}
