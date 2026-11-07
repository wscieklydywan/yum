'use client'

import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Coins, LoaderCircle, MailPlus, Search, Send, UserRound, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { isValidPhone, normalizePhone } from '@/lib/phone'
import { purchasePoints } from '@/lib/loyalty-rate'
import { useLoyaltyRate } from './workshop-club-tools'
import { useTrainingSandbox } from './training/training-sandbox'

export type ClubMember = { id: string; full_name: string | null; email: string; phone: string; points: number }

type Props = {
  member: ClubMember | null
  onChange: (member: ClubMember | null) => void
  total: number
  fieldClass: string
}

export function WorkshopClubOrderField({ member, onChange, total, fieldClass }: Props) {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const { data } = useLoyaltyRate()
  const earned = data ? purchasePoints(total, data.rate) : null

  async function lookup() {
    const phone = normalizePhone(input)
    if (!isValidPhone(phone)) {
      setError('Numer musi mieć 9 cyfr.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/workshop/customers?phone=${phone}`)
      const result = (await response.json().catch(() => null)) as { customer?: ClubMember | null; error?: string } | null
      if (!response.ok) throw new Error(result?.error)
      if (!result?.customer) {
        setError('Brak konta Yummy Club z tym numerem.')
        return
      }
      onChange(result.customer)
      setInput('')
    } catch (lookupError) {
      setError(lookupError instanceof Error && lookupError.message ? lookupError.message : 'Nie udało się wyszukać klienta.')
    } finally {
      setBusy(false)
    }
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.keyCode === 229) return
    event.preventDefault()
    void lookup()
  }

  return (
    <div className="flex flex-col gap-1.5 border-t border-[#f0ece7] py-3.5">
      <span className="text-[11px] font-medium text-[#716962]" id="order-club-label">Yummy Club</span>
      {member ? (
        <div className="flex items-center gap-2 rounded-lg border border-[#e0a21f]/40 bg-[#fdf6e7] p-2.5">
          <UserRound className="size-4 shrink-0 text-[#b7811a]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">
              {member.full_name || member.email.split('@')[0]}
              <span className="ml-1.5 font-semibold text-[#b7811a]">{earned !== null ? `+${earned.toLocaleString('pl-PL')} pkt` : ''}</span>
            </p>
            <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
              {member.phone} · <Coins className="size-3 text-[#e0a21f]" aria-hidden="true" />{member.points.toLocaleString('pl-PL')} pkt na koncie
            </p>
          </div>
          <button type="button" aria-label="Odłącz konto Yummy Club" onClick={() => onChange(null)} className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              aria-labelledby="order-club-label"
              type="tel"
              inputMode="numeric"
              value={input}
              onChange={(event) => { setInput(event.target.value); setError('') }}
              onKeyDown={keyDown}
              placeholder="Telefon klienta, np. 600 123 456"
              autoComplete="off"
              maxLength={16}
              className={cn(fieldClass, 'min-w-0 flex-1 tabular-nums')}
            />
            <Button type="button" variant="outline" className="h-10" disabled={normalizePhone(input).length < 9 || busy} onClick={() => void lookup()}>
              {busy ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Search data-icon="inline-start" />}
              Znajdź
            </Button>
          </div>
          {error && <p role="alert" className="text-xs font-semibold text-destructive">{error}</p>}
          <button type="button" onClick={() => setInviteOpen(true)} className="flex w-fit items-center gap-1.5 rounded-md py-1 text-xs font-semibold text-[#b7811a] hover:underline">
            <MailPlus className="size-3.5" aria-hidden="true" />
            Zaproś klienta do Yummy Club
          </button>
        </>
      )}
      <ClubInviteDialog open={inviteOpen} onOpenChange={setInviteOpen} fieldClass={fieldClass} />
    </div>
  )
}

function ClubInviteDialog({ open, onOpenChange, fieldClass }: { open: boolean; onOpenChange: (open: boolean) => void; fieldClass: string }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const sandbox = useTrainingSandbox()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    event.stopPropagation()
    const value = email.trim().toLowerCase()
    if (!value || busy) return
    if (sandbox) {
      toast.success(`Zaproszenie dla ${value} (szkolenie)`, { description: 'Tryb szkoleniowy – żaden e-mail nie został wysłany.' })
      setEmail('')
      onOpenChange(false)
      return
    }
    setBusy(true)
    try {
      const response = await fetch('/api/workshop/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      })
      const result = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(result.error)
      toast.success(`Zaproszenie wysłane na ${value}`)
      setEmail('')
      onOpenChange(false)
    } catch (inviteError) {
      toast.error(inviteError instanceof Error && inviteError.message ? inviteError.message : 'Nie udało się wysłać zaproszenia.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Zaproś do Yummy Club</DialogTitle>
          <DialogDescription>Klient dostanie e-mail z linkiem do ustawienia hasła. Formularz zamówienia zostaje bez zmian.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="sr-only" htmlFor="order-club-invite-email">Adres e-mail klienta</label>
          <input
            id="order-club-invite-email"
            type="email"
            required
            autoFocus
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="klient@example.com"
            maxLength={254}
            className={cn(fieldClass, 'w-full')}
          />
          <Button type="submit" disabled={busy || !email.trim()}>
            {busy ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Send data-icon="inline-start" />}
            Wyślij zaproszenie
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
