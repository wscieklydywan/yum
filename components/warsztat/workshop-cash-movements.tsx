'use client'

import { useState } from 'react'
import useSWR, { mutate as mutateCache } from 'swr'
import { toast } from 'sonner'
import { ArrowDownToLine, ArrowUpFromLine, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { isNativeAndroid, PosnetPrinter } from '@/lib/native-posnet'
import { cashMovementLabels, type CashMovement, type CashMovementKind } from '@/lib/cash-report-types'

export const CASH_MOVEMENTS_KEY = '/api/workshop/cash-movements'
const CASH_REPORT_KEY = '/api/workshop/cash-report'
const SIGNER_STORAGE_KEY = 'yummy-cash-signer'

const money = (value: number) => value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })
const time = (value: string) => new Date(value).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' })

const QUICK_REASONS: Record<CashMovementKind, string[]> = {
  withdrawal: ['Paliwo', 'Zakupy', 'Dostawca', 'Wypłata dla szefa'],
  deposit: ['Rozmienienie', 'Uzupełnienie kasy', 'Zwrot reszty z zakupów'],
}

async function fetchMovements(url: string): Promise<{ movements: CashMovement[] }> {
  const response = await fetch(url, { credentials: 'same-origin' })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? 'Nie udało się pobrać operacji kasowych.')
  return result
}

export function useCashMovements(enabled: boolean) {
  return useSWR(enabled ? CASH_MOVEMENTS_KEY : null, fetchMovements)
}

export const movementStyles: Record<CashMovementKind, { icon: typeof ArrowUpFromLine; tone: string; sign: string }> = {
  withdrawal: { icon: ArrowUpFromLine, tone: 'bg-red-50 text-red-700', sign: '-' },
  deposit: { icon: ArrowDownToLine, tone: 'bg-emerald-50 text-emerald-700', sign: '+' },
}

export function CashMovementList({ movements, empty }: { movements: CashMovement[]; empty?: string }) {
  if (!movements.length) return empty ? <p className="rounded-xl bg-[#f7f3ef] px-3 py-3 text-center text-[12px] text-[#756e67]">{empty}</p> : null
  return <ul className="flex flex-col divide-y divide-[#f0ebe5] rounded-xl border border-[#e5ded6] bg-white">
    {movements.map((entry) => {
      const style = movementStyles[entry.kind]
      const Icon = style.icon
      return <li key={entry.id} className="flex items-center gap-3 px-3 py-2">
        <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', style.tone)}><Icon className="size-4" aria-hidden="true" /><span className="sr-only">{cashMovementLabels[entry.kind]}</span></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold">{entry.reason}</span>
          <span className="block truncate text-[11px] text-[#756e67]">{entry.signedBy} · {time(entry.createdAt)}</span>
        </span>
        <b className={cn('shrink-0 text-[13px] tabular-nums', entry.kind === 'withdrawal' ? 'text-red-700' : 'text-emerald-700')}>{style.sign}{money(entry.amount)}</b>
      </li>
    })}
  </ul>
}

function readStoredSigner() {
  try { return window.localStorage.getItem(SIGNER_STORAGE_KEY) ?? '' } catch { return '' }
}

export function CashMovementDialog({ kind, onClose }: { kind: CashMovementKind | null; onClose: () => void }) {
  return <Dialog open={!!kind} onOpenChange={(open) => { if (!open) onClose() }}>
    {/* Preventing auto-focus keeps the on-screen keyboard closed on tablets until the cashier taps a field. */}
    <DialogContent initialFocus={false} className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
      {kind && <CashMovementForm key={kind} kind={kind} onDone={onClose} />}
    </DialogContent>
  </Dialog>
}

function CashMovementForm({ kind, onDone }: { kind: CashMovementKind; onDone: () => void }) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [signedBy, setSignedBy] = useState(readStoredSigner)
  const [saving, setSaving] = useState(false)
  const style = movementStyles[kind]
  const Icon = style.icon

  const value = amount.trim() === '' ? NaN : Number(amount.replace(',', '.'))
  const canSave = Number.isFinite(value) && value > 0 && reason.trim().length > 0 && signedBy.trim().length >= 2 && !saving

  async function save() {
    if (!canSave) return
    setSaving(true)
    const response = await fetch(CASH_MOVEMENTS_KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, amount: value, reason, signedBy }) }).catch(() => null)
    const result = response ? await response.json().catch(() => null) : null
    setSaving(false)
    if (!response?.ok) { toast.error(result?.error ?? 'Nie udało się zapisać operacji.'); return }
    try { window.localStorage.setItem(SIGNER_STORAGE_KEY, signedBy.trim()) } catch {}
    toast.success(`${cashMovementLabels[kind]}: ${money(value)} zapisana`)
    await Promise.all([mutateCache(CASH_MOVEMENTS_KEY), mutateCache(CASH_REPORT_KEY)])
    if (isNativeAndroid()) void PosnetPrinter.openCashDrawer().catch(() => undefined)
    onDone()
  }

  return <form onSubmit={(event) => { event.preventDefault(); void save() }} className="flex flex-col gap-4">
    <DialogHeader>
      <div className="flex items-center gap-3">
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', style.tone)}><Icon className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0 text-left">
          <DialogTitle>{cashMovementLabels[kind]}</DialogTitle>
          <DialogDescription>{kind === 'withdrawal' ? 'Gotówka zabrana z szuflady – odejmie się od oczekiwanej kwoty w raporcie.' : 'Gotówka dołożona do szuflady – doliczy się do oczekiwanej kwoty w raporcie.'}</DialogDescription>
        </div>
      </div>
    </DialogHeader>

    <label className="text-[12px] font-semibold">Kwota (zł)
      <input inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="np. 200" className="mt-1 h-12 w-full rounded-xl border border-[#e5ded6] px-3 text-lg font-bold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary" />
    </label>

    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-[12px] font-semibold">Powód</legend>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_REASONS[kind].map((option) => <button key={option} type="button" aria-pressed={reason === option} onClick={() => setReason(option)} className={cn('h-8 rounded-full border px-3 text-[12px] font-semibold transition-colors', reason === option ? 'border-primary bg-primary text-primary-foreground' : 'border-[#e5ded6] bg-white hover:bg-[#f7f3ef]')}>{option}</button>)}
      </div>
      <input aria-label="Powód operacji" required maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="lub wpisz własny…" className="h-10 w-full rounded-xl border border-[#e5ded6] px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-primary" />
    </fieldset>

    <label className="text-[12px] font-semibold">Podpis – Twoje imię
      <input required minLength={2} maxLength={60} autoComplete="name" value={signedBy} onChange={(event) => setSignedBy(event.target.value)} placeholder="np. Kasia" className="mt-1 h-10 w-full rounded-xl border border-[#e5ded6] px-3 text-[13px] font-normal outline-none focus-visible:ring-2 focus-visible:ring-primary" />
      <span className="mt-1 block text-[11px] font-normal text-[#756e67]">Imię trafi do raportu kasowego, żeby było wiadomo, kto zrobił operację.</span>
    </label>

    <DialogFooter>
      <Button type="button" variant="outline" onClick={onDone}>Anuluj</Button>
      <Button type="submit" disabled={!canSave} variant={kind === 'withdrawal' ? 'destructive' : 'default'}>
        {saving ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Icon data-icon="inline-start" />}
        {kind === 'withdrawal' ? 'Wypłać' : 'Wpłać'}{Number.isFinite(value) && value > 0 ? ` ${money(value)}` : ''}
      </Button>
    </DialogFooter>
  </form>
}
