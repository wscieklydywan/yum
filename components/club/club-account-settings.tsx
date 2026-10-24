'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { AlertTriangle, LoaderCircle, Pencil, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { authCallbackUrl, describeAuthError } from '@/lib/auth-redirect'
import { formatPhone, isValidPhone, normalizePhone } from '@/lib/phone'
import { useBackButtonClose } from '@/lib/use-back-button-close'
import { ClubGroup } from './club-member-sections'

export type AccountDetails = { fullName: string | null; phone: string | null; email: string }

function splitName(fullName: string | null) {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') }
}

const inputClass =
  'h-11 w-full rounded-xl border border-input bg-background px-3.5 text-base outline-none transition-shadow placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 aria-invalid:border-destructive sm:text-sm'
const primaryButton =
  'flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60'
const ghostButton =
  'flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium text-muted-foreground ring-1 ring-border transition-colors hover:bg-muted hover:text-foreground'

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-4 py-3">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm font-semibold">{value || '—'}</dd>
    </div>
  )
}

function SubsectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
      <h3 className="text-sm font-bold">{title}</h3>
      {action}
    </div>
  )
}

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="-mr-3 flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/10">
      <Pencil className="size-3.5" aria-hidden="true" />
      {label}
    </button>
  )
}

function PersonalDetails({ details, onSaved }: { details: AccountDetails; onSaved: (next: AccountDetails) => void }) {
  const initial = splitName(details.fullName)
  const [editing, setEditing] = useState(false)
  const [firstName, setFirstName] = useState(initial.firstName)
  const [lastName, setLastName] = useState(initial.lastName)
  const [phone, setPhone] = useState(details.phone ? formatPhone(details.phone) : '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function startEditing() {
    const current = splitName(details.fullName)
    setFirstName(current.firstName)
    setLastName(current.lastName)
    setPhone(details.phone ? formatPhone(details.phone) : '')
    setError('')
    setEditing(true)
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!firstName.trim()) return setError('Podaj imię.')
    if (!isValidPhone(normalizePhone(phone))) return setError('Numer telefonu musi mieć 9 cyfr.')
    setSaving(true)
    setError('')
    const response = await fetch('/api/club/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, phone }),
    }).catch(() => null)
    const data = (await response?.json().catch(() => null)) as { fullName?: string; phone?: string; error?: string } | null
    setSaving(false)
    if (!response?.ok || !data?.phone) return setError(data?.error ?? 'Nie udało się zapisać danych.')
    onSaved({ ...details, fullName: data.fullName ?? null, phone: data.phone })
    setEditing(false)
    toast.success('Dane zapisane')
  }

  const name = splitName(details.fullName)

  return (
    <div className="flex min-w-0 flex-col">
      <SubsectionHeader title="Dane osobowe" action={!editing && <EditButton label="Edytuj" onClick={startEditing} />} />
      {editing ? (
        <form onSubmit={save} className="flex flex-col gap-3.5 pt-4" noValidate>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field id="settings-first-name" label="Imię">
              <input id="settings-first-name" className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" maxLength={40} required />
            </Field>
            <Field id="settings-last-name" label="Nazwisko">
              <input id="settings-last-name" className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" maxLength={40} />
            </Field>
          </div>
          <Field id="settings-phone" label="Telefon">
            <input id="settings-phone" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel-national" placeholder="np. 600 100 200" required />
          </Field>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setEditing(false)} className={ghostButton}>Anuluj</button>
            <button type="submit" disabled={saving} className={primaryButton}>
              {saving && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
              Zapisz zmiany
            </button>
          </div>
        </form>
      ) : (
        <dl className="divide-y divide-border/70">
          <DetailRow label="Imię" value={name.firstName} />
          <DetailRow label="Nazwisko" value={name.lastName} />
          <DetailRow label="Telefon" value={details.phone ? formatPhone(details.phone) : ''} />
        </dl>
      )}
    </div>
  )
}

function EmailSettings({ email }: { email: string }) {
  const [editing, setEditing] = useState(false)
  const [nextEmail, setNextEmail] = useState('')
  const [error, setError] = useState('')
  const [pendingEmail, setPendingEmail] = useState('')
  const [saving, setSaving] = useState(false)

  async function save(event: FormEvent) {
    event.preventDefault()
    const value = nextEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setError('Podaj poprawny adres e-mail.')
    if (value === email.toLowerCase()) return setError('To jest Twój obecny adres.')
    setSaving(true)
    setError('')
    const { error: updateError } = await createClient().auth.updateUser(
      { email: value },
      { emailRedirectTo: authCallbackUrl('/yummy-club') },
    )
    setSaving(false)
    if (updateError) return setError(describeAuthError(updateError, 'update'))
    setPendingEmail(value)
    setEditing(false)
    setNextEmail('')
  }

  return (
    <div className="flex min-w-0 flex-col">
      <SubsectionHeader title="Adres e-mail" action={!editing && <EditButton label="Zmień" onClick={() => { setEditing(true); setError('') }} />} />
      <dl>
        <DetailRow label="E-mail logowania" value={email} />
      </dl>
      {pendingEmail && !editing && (
        <p className="text-xs leading-relaxed text-muted-foreground" role="status">
          Wysłaliśmy link potwierdzający na <b className="text-foreground">{pendingEmail}</b>. Adres zmieni się po kliknięciu w link.
        </p>
      )}
      {editing && (
        <form onSubmit={save} className="flex flex-col gap-3.5 pt-2" noValidate>
          <Field id="settings-email" label="Nowy adres e-mail">
            <input id="settings-email" className={inputClass} value={nextEmail} onChange={(e) => setNextEmail(e.target.value)} type="email" autoComplete="email" placeholder="nowy@adres.pl" required />
          </Field>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setEditing(false)} className={ghostButton}>Anuluj</button>
            <button type="submit" disabled={saving} className={primaryButton}>
              {saving && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
              Wyślij link
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export function DeleteAccount({ isStaff }: { isStaff: boolean }) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const confirmed = confirm.trim().toUpperCase() === 'USUŃ'
  useBackButtonClose(open, (next) => !deleting && setOpen(next))

  async function remove(event: FormEvent) {
    event.preventDefault()
    if (!confirmed) return
    setDeleting(true)
    setError('')
    const response = await fetch('/api/club/profile', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm }),
    }).catch(() => null)
    const data = (await response?.json().catch(() => null)) as { error?: string } | null
    if (!response?.ok) {
      setDeleting(false)
      return setError(data?.error ?? 'Nie udało się usunąć konta.')
    }
    await createClient().auth.signOut().catch(() => undefined)
    window.location.assign('/yummy-club')
  }

  return (
    <div className="flex flex-col items-center">
      {isStaff ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">Konta pracowników może usunąć tylko administrator.</p>
      ) : (
        <button
          type="button"
          onClick={() => { setOpen(true); setConfirm(''); setError('') }}
          className="flex h-10 items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-destructive/80 transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          Usuń konto
        </button>
      )}
      <DialogPrimitive.Root open={open} onOpenChange={(next) => !deleting && setOpen(next)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
          <DialogPrimitive.Popup className="fixed inset-x-0 bottom-0 z-50 max-h-[90svh] overflow-y-auto rounded-t-3xl bg-card p-5 shadow-2xl outline-none transition-[opacity,translate,scale] data-[ending-style]:translate-y-6 data-[ending-style]:opacity-0 data-[starting-style]:translate-y-6 data-[starting-style]:opacity-0 sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-6">
            <DialogPrimitive.Close className="absolute right-4 top-4 grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Zamknij">
              <X className="size-4" aria-hidden="true" />
            </DialogPrimitive.Close>
            <span className="grid size-11 place-items-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </span>
            <DialogPrimitive.Title className="mt-3 pr-10 text-xl font-extrabold tracking-tight">Usunąć konto na zawsze?</DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Usuniemy Twoje dane, Stars, kupony i historię aktywności. Zamówienia pozostaną w rozliczeniach restauracji bez powiązania z kontem.
            </DialogPrimitive.Description>
            <form onSubmit={remove} className="mt-4 flex flex-col gap-3.5">
              <Field id="delete-confirm" label="Wpisz USUŃ, aby potwierdzić">
                <input id="delete-confirm" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" autoCapitalize="characters" />
              </Field>
              {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <DialogPrimitive.Close className={ghostButton} disabled={deleting}>Anuluj</DialogPrimitive.Close>
                <button
                  type="submit"
                  disabled={!confirmed || deleting}
                  className="flex h-11 items-center justify-center gap-2 rounded-full bg-destructive px-5 text-sm font-semibold text-white transition-colors hover:bg-destructive/90 disabled:opacity-50"
                >
                  {deleting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
                  Usuń konto
                </button>
              </div>
            </form>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  )
}

export function ClubAccountSettings({
  details,
  onDetailsChange,
}: {
  details: AccountDetails
  onDetailsChange: (next: AccountDetails) => void
}) {
  return (
    <ClubGroup id="ustawienia" title="Dane i ustawienia" description="Imię, telefon i adres e-mail">
      <div className="flex min-w-0 flex-col gap-6">
        <PersonalDetails details={details} onSaved={onDetailsChange} />
        <EmailSettings email={details.email} />
      </div>
    </ClubGroup>
  )
}
