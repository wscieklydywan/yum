'use client'

import { useState, type FormEvent } from 'react'
import { ChefHat, LoaderCircle, LogOut, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/yummy/logo'

export type UserRole = 'admin' | 'szef' | 'kuchnia' | 'kelner' | 'klient' | 'kierowca'

export const isManagerRole = (role: UserRole) => role === 'admin' || role === 'szef'

export function WorkshopSignIn({ message }: { message?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(message ?? '')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (authError) {
      setError('Nieprawidłowy e-mail lub hasło. Sprawdź dane i spróbuj ponownie.')
      setSubmitting(false)
      return
    }
    window.location.assign('/warsztat')
  }

  return <main className="grid min-h-dvh place-items-center bg-[#f1ede7] px-4 py-10 text-[#201d1a]">
    <section className="w-full max-w-md rounded-3xl border border-[#e7e0d8] bg-[#fffdfa] p-6 shadow-[0_20px_80px_rgba(35,29,24,0.08)] sm:p-9">
      <a href="/" aria-label="Wróć do Yummy" className="flex justify-center"><Logo className="h-10 w-auto" /></a>
      <div className="mt-8 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><ChefHat aria-hidden="true" /></span><h1 className="mt-4 text-2xl font-black tracking-tight">Wejście do warsztatu</h1><p className="mt-2 text-sm leading-relaxed text-[#786f66]">Zaloguj się danymi konta przydzielonego przez administratora.</p></div>
      <form onSubmit={submit} className="mt-7 space-y-4">
        <label className="block text-sm font-semibold">E-mail<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-[#e5ded6] bg-white px-3.5 font-normal outline-none focus-visible:ring-2 focus-visible:ring-primary" /></label>
        <label className="block text-sm font-semibold">Hasło<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-[#e5ded6] bg-white px-3.5 font-normal outline-none focus-visible:ring-2 focus-visible:ring-primary" /></label>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={submitting} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60">{submitting && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}Zaloguj się</button>
      </form>
      <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-[#887f76]"><ShieldCheck className="size-3.5" aria-hidden="true" />Dostęp tylko dla zaproszonych pracowników</p>
    </section>
  </main>
}

export function WorkshopAccessDenied({ email, role }: { email: string; role: UserRole }) {
  const labels: Record<UserRole, string> = { admin: 'administrator', szef: 'szef', kuchnia: 'kuchnia', kelner: 'kelner', klient: 'klient', kierowca: 'kierowca' }
  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.assign('/warsztat')
  }
  return <main className="grid min-h-dvh place-items-center bg-[#f1ede7] px-4 py-10 text-[#201d1a]"><section className="w-full max-w-md rounded-3xl border border-[#e7e0d8] bg-[#fffdfa] p-7 text-center shadow-sm"><Logo className="mx-auto h-10 w-auto" /><span className="mx-auto mt-8 grid size-12 place-items-center rounded-2xl bg-amber-100 text-amber-800"><ShieldCheck aria-hidden="true" /></span><h1 className="mt-4 text-2xl font-black">Brak dostępu do warsztatu</h1><p className="mt-2 text-sm leading-relaxed text-[#786f66]">Konto <span className="font-semibold text-[#39332d]">{email}</span> ma rolę: {labels[role]}. Poproś administratora o przydzielenie dostępu pracowniczego.</p><button type="button" onClick={signOut} className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border border-[#e5ded6] px-5 text-sm font-semibold hover:bg-[#f7f3ef]"><LogOut className="size-4" aria-hidden="true" />Wyloguj</button></section></main>
}
