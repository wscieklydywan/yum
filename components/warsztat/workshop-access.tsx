'use client'

import { useState, type FormEvent } from 'react'
import { ArrowRight, LoaderCircle, LogOut, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/yummy/logo'

export type UserRole = 'admin' | 'szef' | 'kuchnia' | 'kelner' | 'klient' | 'kierowca' | 'kiosk'

export const isManagerRole = (role: UserRole) => role === 'admin' || role === 'szef'

export function WorkshopSignIn({ message, redirectTo = '/warsztat' }: { message?: string; redirectTo?: string }) {
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
      setError('!')
      setSubmitting(false)
      return
    }
    window.location.assign(redirectTo)
  }

  const inputClass = 'h-12 w-full rounded-xl border border-[#e5ded6] bg-white px-3.5 outline-none focus-visible:ring-2 focus-visible:ring-[#201d1a]/30'
  return <main className="grid min-h-dvh place-items-center bg-[#f1ede7] px-4 py-10 text-[#201d1a]">
    <form onSubmit={submit} className="w-full max-w-xs space-y-3">
      <input type="email" aria-label="E-mail" autoComplete="username" required value={email} onChange={(event) => { setEmail(event.target.value); setError('') }} className={inputClass} />
      <input type="password" aria-label="Hasło" autoComplete="current-password" required value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} className={`${inputClass} ${error ? 'border-red-400' : ''}`} aria-invalid={Boolean(error)} />
      <button type="submit" disabled={submitting} aria-label="Dalej" className="flex h-12 w-full items-center justify-center rounded-xl bg-[#201d1a] text-white transition-opacity hover:opacity-90 disabled:opacity-60">{submitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-5" aria-hidden="true" />}</button>
    </form>
  </main>
}

export function WorkshopAccessDenied({ email, role }: { email: string; role: UserRole }) {
  const labels: Record<UserRole, string> = { admin: 'administrator', szef: 'szef', kuchnia: 'kuchnia', kelner: 'kelner', klient: 'klient', kierowca: 'kierowca', kiosk: 'kiosk' }
  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut({ scope: 'local' })
    window.location.assign('/warsztat')
  }
  return <main className="grid min-h-dvh place-items-center bg-[#f1ede7] px-4 py-10 text-[#201d1a]"><section className="w-full max-w-md rounded-3xl border border-[#e7e0d8] bg-[#fffdfa] p-7 text-center shadow-sm"><Logo className="mx-auto h-10 w-auto" /><span className="mx-auto mt-8 grid size-12 place-items-center rounded-2xl bg-amber-100 text-amber-800"><ShieldCheck aria-hidden="true" /></span><h1 className="mt-4 text-2xl font-black">Brak dostępu do warsztatu</h1><p className="mt-2 text-sm leading-relaxed text-[#786f66]">Konto <span className="font-semibold text-[#39332d]">{email}</span> ma rolę: {labels[role]}. Poproś administratora o przydzielenie dostępu pracowniczego.</p><button type="button" onClick={signOut} className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border border-[#e5ded6] px-5 text-sm font-semibold hover:bg-[#f7f3ef]"><LogOut className="size-4" aria-hidden="true" />Wyloguj</button></section></main>
}
