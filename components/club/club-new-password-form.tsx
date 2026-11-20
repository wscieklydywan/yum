'use client'

import { useState, type FormEvent } from 'react'
import { KeyRound, LoaderCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { describeAuthError } from '@/lib/auth-redirect'
import { isValidPhone, normalizePhone } from '@/lib/phone'

const inputClass =
  'mt-1.5 h-12 w-full rounded-xl bg-background/70 px-3.5 font-normal ring-1 ring-border outline-none focus-visible:ring-2 focus-visible:ring-primary/60'

export function ClubNewPasswordForm({ needsProfile = false, defaultName = '' }: { needsProfile?: boolean; defaultName?: string }) {
  const [password, setPassword] = useState('')
  const [name, setName] = useState(defaultName)
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const normalizedPhone = normalizePhone(phone)
    if (needsProfile && !isValidPhone(normalizedPhone)) {
      setError('Podaj poprawny numer telefonu – 9 cyfr.')
      return
    }
    setSubmitting(true)

    if (needsProfile) {
      const response = await fetch('/api/club/phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone, name }),
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        setError(payload?.error ?? 'Nie udało się zapisać numeru telefonu.')
        setSubmitting(false)
        return
      }
    }

    const { error: updateError } = await createClient().auth.updateUser({ password })
    if (updateError) {
      setError(describeAuthError(updateError, 'update'))
      setSubmitting(false)
      return
    }
    window.location.assign('/yummy-club')
  }

  return (
    <section className="rounded-3xl bg-card/80 p-6 shadow-[0_10px_40px_rgba(80,30,10,0.07)] ring-1 ring-border/60 sm:p-8">
      <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        <KeyRound className="size-6" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
        {needsProfile ? 'Dokończ rejestrację' : 'Ustaw nowe hasło'}
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {needsProfile
          ? 'Witaj w Yummy Club! Uzupełnij dane i ustaw hasło do swojego konta.'
          : 'Wpisz nowe hasło do swojego konta Yummy Club.'}
      </p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
        {needsProfile && (
          <>
            <label className="text-sm font-semibold">
              Imię
              <input
                type="text"
                autoComplete="given-name"
                required
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold">
              Numer telefonu
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="9 cyfr"
                required
                maxLength={16}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className={inputClass}
              />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                Podawaj go przy zamówieniach, aby zbierać punkty.
              </span>
            </label>
          </>
        )}
        <label className="text-sm font-semibold">
          {needsProfile ? 'Hasło' : 'Nowe hasło'}
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
          />
        </label>
        {error && <p role="alert" className="rounded-xl bg-primary/10 px-3 py-2.5 text-sm text-primary">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="mt-1 flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {submitting && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {needsProfile ? 'Załóż konto' : 'Zapisz hasło'}
        </button>
      </form>
    </section>
  )
}
