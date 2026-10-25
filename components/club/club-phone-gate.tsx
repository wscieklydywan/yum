'use client'

import { useState, type FormEvent } from 'react'
import { LoaderCircle, LogOut, Phone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isValidPhone, normalizePhone } from '@/lib/phone'

const inputClass =
  'mt-1.5 h-12 w-full rounded-xl bg-background/70 px-3.5 font-normal ring-1 ring-border outline-none focus-visible:ring-2 focus-visible:ring-primary/60'

export function ClubPhoneGate({ defaultName = '' }: { defaultName?: string }) {
  const [name, setName] = useState(defaultName)
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const normalizedPhone = normalizePhone(phone)
    if (!isValidPhone(normalizedPhone)) {
      setError('Podaj poprawny numer telefonu – 9 cyfr.')
      return
    }
    setSubmitting(true)
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
    window.location.assign('/yummy-club')
  }

  async function signOut() {
    await createClient().auth.signOut()
    window.location.assign('/yummy-club')
  }

  return (
    <section className="mx-auto mt-4 w-full max-w-md rounded-3xl bg-card/80 p-6 shadow-[0_10px_40px_rgba(80,30,10,0.07)] ring-1 ring-border/60 sm:mt-10 sm:p-8">
      <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Phone className="size-6" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Uzupełnij numer telefonu</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Do korzystania z Yummy Club potrzebujemy Twojego numeru telefonu – po nim przypisujemy punkty do zamówień.
      </p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
        {!defaultName && (
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
        )}
        <label className="text-sm font-semibold">
          Numer telefonu
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="9 cyfr"
            required
            pattern="[0-9 +\-]{9,16}"
            title="Podaj 9-cyfrowy numer telefonu"
            maxLength={16}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
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
          Zapisz i przejdź dalej
        </button>
        <button
          type="button"
          onClick={signOut}
          className="flex h-10 items-center justify-center gap-2 rounded-full text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Wyloguj się
        </button>
      </form>
    </section>
  )
}
