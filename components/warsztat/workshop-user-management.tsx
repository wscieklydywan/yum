'use client'

import { useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { LoaderCircle, Plus, Shield, Trash2, Users } from 'lucide-react'

type Role = 'admin' | 'szef' | 'kuchnia' | 'kelner' | 'kierowca' | 'klient'
type Profile = { id: string; email: string; full_name: string | null; role: Role; created_at: string }
const roleLabels: Record<Role, string> = { admin: 'Administrator', szef: 'Szef', kuchnia: 'Kuchnia', kelner: 'Kelner', kierowca: 'Kierowca', klient: 'Klient' }
const allRoles = (Object.keys(roleLabels) as Role[]).filter((item) => item !== 'klient')

async function fetchUsers(url: string): Promise<Profile[]> {
  const response = await fetch(url)
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? 'Nie udało się pobrać kont.')
  return result
}

export function WorkshopUserManagement({ currentUserId, currentUserRole }: { currentUserId: string; currentUserRole: 'admin' | 'szef' }) {
  const roles = currentUserRole === 'szef' ? allRoles.filter((item) => item !== 'admin') : allRoles
  const { data: users = [], error, isLoading, mutate } = useSWR<Profile[]>('/api/workshop/users', fetchUsers)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('kuchnia')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setFeedback('')
    try {
      const response = await fetch('/api/workshop/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, fullName, password, role }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Nie udało się utworzyć konta.')
      setEmail('')
      setFullName('')
      setPassword('')
      await mutate()
      setFeedback('Konto utworzone. Przekaż pracownikowi e-mail i ustawione hasło.')
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Nie udało się utworzyć konta.')
    } finally {
      setBusy(false)
    }
  }

  async function updateRole(userId: string, nextRole: Role) {
    setBusy(true)
    setFeedback('')
    try {
      const response = await fetch('/api/workshop/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, role: nextRole }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Nie udało się zmienić roli.')
      await mutate()
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Nie udało się zmienić roli.')
      await mutate()
    } finally {
      setBusy(false)
    }
  }

  async function removeUser(user: Profile) {
    if (!window.confirm(`Usunąć konto ${user.email}? Ta operacja jest nieodwracalna.`)) return
    setBusy(true)
    setFeedback('')
    try {
      const response = await fetch('/api/workshop/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Nie udało się usunąć konta.')
      await mutate()
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Nie udało się usunąć konta.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="motion-safe:animate-in motion-safe:fade-in-0">
    <div className="mb-5 flex items-center gap-2 text-primary"><Users className="size-4" aria-hidden="true" /><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b827a]">Zespół warsztatu</p></div>
    <h1 className="text-[22px] font-extrabold tracking-tight sm:text-2xl">Użytkownicy i role</h1>
    <p className="mt-1 text-xs text-[#817970]">Twórz konta pracowników i kontroluj dostęp do stanowisk.</p>
    <form onSubmit={submit} className="mt-5 grid gap-3 rounded-2xl border border-[#e8e1d9] bg-white p-4 sm:grid-cols-2 sm:p-5">
      <label className="text-xs font-semibold">Imię i nazwisko<input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required maxLength={120} className="mt-1.5 h-10 w-full rounded-lg border border-[#e5ded6] px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-primary" /></label>
      <label className="text-xs font-semibold">E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="mt-1.5 h-10 w-full rounded-lg border border-[#e5ded6] px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-primary" /></label>
      <label className="text-xs font-semibold">Hasło początkowe<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} maxLength={128} autoComplete="new-password" required className="mt-1.5 h-10 w-full rounded-lg border border-[#e5ded6] px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-primary" /><span className="mt-1 block font-normal text-[#817970]">Co najmniej 10 znaków. Przekaż je pracownikowi bezpiecznie.</span></label>
      <label className="text-xs font-semibold">Rola<select value={role} onChange={(event) => setRole(event.target.value as Role)} className="mt-1.5 h-10 w-full rounded-lg border border-[#e5ded6] bg-white px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-primary">{roles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select></label>
      <div className="sm:col-span-2"><button disabled={busy} type="submit" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-60">{busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}Utwórz konto</button></div>
    </form>
    {feedback && <p role="status" className="mt-3 rounded-xl bg-[#fffdfa] px-3 py-2 text-sm text-[#625a52]">{feedback}</p>}
    {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error.message}</p>}
    <div className="mt-5 overflow-hidden rounded-2xl border border-[#e8e1d9] bg-white">
      <div className="flex items-center gap-2 border-b border-[#eee9e3] bg-[#faf8f5] px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#898178]"><Shield className="size-3.5" aria-hidden="true" />Konta i uprawnienia</div>
      {isLoading ? <p className="p-5 text-sm text-[#817970]">Wczytywanie użytkowników…</p> : users.map((user) => <div key={user.id} className="flex flex-wrap items-center gap-3 border-b border-[#f0ece7] px-4 py-3 last:border-b-0">
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{user.full_name || user.email}</p><p className="truncate text-xs text-[#817970]">{user.email}</p></div>
        <select value={user.role} disabled={busy || user.id === currentUserId} aria-label={`Rola: ${user.email}`} onChange={(event) => void updateRole(user.id, event.target.value as Role)} className="h-9 rounded-lg border border-[#e5ded6] bg-white px-2 text-xs disabled:opacity-60">{roles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select>
        {user.id !== currentUserId && <button type="button" disabled={busy} onClick={() => void removeUser(user)} aria-label={`Usuń konto ${user.email}`} className="grid size-9 place-items-center rounded-lg text-[#80786f] hover:bg-red-50 hover:text-red-700 disabled:opacity-50"><Trash2 className="size-4" aria-hidden="true" /></button>}
      </div>)}
      {!isLoading && users.length === 0 && <p className="p-5 text-sm text-[#817970]">Nie ma jeszcze kont użytkowników.</p>}
    </div>
  </section>
}
