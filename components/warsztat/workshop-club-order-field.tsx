'use client'

import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import useSWR from 'swr'
import { Coins, LoaderCircle, MailPlus, Search, Send, UserRound, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatPhone, isValidPhone, normalizePhone, phonePrefix } from '@/lib/phone'
import { getTier } from '@/lib/loyalty'
import { useClubTiers } from '@/lib/use-public-loyalty'
import { tierBadge } from '@/lib/club-tier-badge'
import { purchasePoints } from '@/lib/loyalty-rate'
import { useLoyaltyRate } from './workshop-club-tools'
import { useTrainingSandbox } from './training/training-sandbox'

export type ClubMember = { id: string; full_name: string | null; email: string; phone: string; points: number; status_points?: number | null }

type SuggestResult = { prefix: string; items: ClubMember[]; complete: boolean }

const SUGGEST_MIN_DIGITS = 3

async function fetchSuggestions(prefix: string): Promise<SuggestResult> {
  const response = await fetch(`/api/workshop/customers?suggest=${prefix}`)
  const result = (await response.json().catch(() => null)) as { items?: ClubMember[]; complete?: boolean; error?: string } | null
  if (!response.ok) throw new Error(result?.error ?? 'Nie udało się wyszukać klienta.')
  return { prefix, items: result?.items ?? [], complete: Boolean(result?.complete) }
}

/**
 * Podpowiedzi po początku numeru. Zapytanie leci dopiero od 3 cyfr i po krótkiej pauzie w pisaniu.
 * Gdy serwer zwrócił komplet wyników dla krótszego prefiksu, kolejne cyfry filtrują je lokalnie
 * zamiast pytać bazę ponownie.
 */
function usePhoneSuggestions(input: string) {
  const typed = phonePrefix(input)
  const [prefix, setPrefix] = useState(typed)
  const [completeBase, setCompleteBase] = useState<SuggestResult | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPrefix(typed)
      if (typed.length < SUGGEST_MIN_DIGITS) setCompleteBase(null)
    }, 220)
    return () => window.clearTimeout(timeout)
  }, [typed])

  const enoughDigits = prefix.length >= SUGGEST_MIN_DIGITS
  const coveredLocally = Boolean(completeBase && enoughDigits && prefix.startsWith(completeBase.prefix))
  const { data } = useSWR(enoughDigits && !coveredLocally ? prefix : null, fetchSuggestions, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    keepPreviousData: true,
    onSuccess: (result) => { if (result.complete) setCompleteBase(result) },
  })

  if (!enoughDigits || typed.length < SUGGEST_MIN_DIGITS) return { prefix, items: [] as ClubMember[] }
  const source = coveredLocally ? completeBase!.items : data?.items ?? []
  return { prefix, items: source.filter((customer) => customer.phone?.startsWith(prefix)) }
}

function ClubMemberBadge({ customer, matched, active, onSelect }: { customer: ClubMember; matched: string; active: boolean; onSelect: () => void }) {
  const tiers = useClubTiers()
  const tier = getTier(customer.status_points ?? 0, tiers)
  const phone = formatPhone(customer.phone)
  const matchedLength = matched.length + Math.floor(Math.max(matched.length - 1, 0) / 3)

  return (
    <button
      type="button"
      tabIndex={-1}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors',
        active ? 'border-[#e0a21f] bg-[#fdf6e7]' : 'border-[#f0ece7] bg-white hover:border-[#e0a21f]/60 hover:bg-[#fdf6e7]/60',
      )}
    >
      <UserRound className="size-4 shrink-0 text-[#b7811a]" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold">{customer.full_name || customer.email.split('@')[0]}</span>
        <span className="block truncate text-[11px] tabular-nums text-muted-foreground">
          <span className="font-bold text-foreground">{phone.slice(0, matchedLength)}</span>{phone.slice(matchedLength)}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', tierBadge[tier.name])}>{tier.name}</span>
        <span className="flex items-center gap-1 text-[11px] font-semibold tabular-nums">
          <Coins className="size-3 text-[#e0a21f]" aria-hidden="true" />
          {customer.points.toLocaleString('pl-PL')} pkt
        </span>
      </span>
    </button>
  )
}

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
  const [active, setActive] = useState(-1)
  const [dismissed, setDismissed] = useState(false)
  const { data } = useLoyaltyRate()
  const earned = data ? purchasePoints(total, data.rate) : null
  const { prefix, items } = usePhoneSuggestions(member ? '' : input)
  const suggestions = dismissed ? [] : items

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

  function select(customer: ClubMember) {
    onChange(customer)
    setInput('')
    setError('')
    setActive(-1)
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (suggestions.length > 0 && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((current) => (current + step + suggestions.length) % suggestions.length)
      return
    }
    if (event.key === 'Escape' && suggestions.length > 0) {
      event.preventDefault()
      event.stopPropagation()
      setDismissed(true)
      return
    }
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (active >= 0 && suggestions[active]) select(suggestions[active])
    else if (suggestions.length === 1 && isValidPhone(prefix)) select(suggestions[0])
    else void lookup()
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
              role="combobox"
              aria-expanded={suggestions.length > 0}
              aria-controls="order-club-suggestions"
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 && suggestions[active] ? `order-club-suggestion-${suggestions[active].id}` : undefined}
              value={input}
              onChange={(event) => { setInput(event.target.value); setError(''); setActive(-1); setDismissed(false) }}
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
          {suggestions.length > 0 && (
            <ul id="order-club-suggestions" role="listbox" aria-label="Podpowiedzi klientów Yummy Club" className="flex flex-col gap-1">
              {suggestions.map((customer, index) => (
                <li key={customer.id} id={`order-club-suggestion-${customer.id}`} role="option" aria-selected={index === active}>
                  <ClubMemberBadge customer={customer} matched={prefix} active={index === active} onSelect={() => select(customer)} />
                </li>
              ))}
            </ul>
          )}
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
