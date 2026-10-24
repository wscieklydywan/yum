'use client'

import { useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { LoaderCircle, Plus, Trash2, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SettingsCard } from './workshop-settings-layout'

type Role = 'admin' | 'szef' | 'kuchnia' | 'kelner' | 'kierowca' | 'kiosk' | 'klient'
type Profile = { id: string; email: string; full_name: string | null; role: Role; created_at: string }
const roleLabels: Record<Role, string> = { admin: 'Administrator', szef: 'Szef', kuchnia: 'Kuchnia', kelner: 'Kelner', kierowca: 'Kierowca', kiosk: 'Kiosk', klient: 'Klient' }
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

  return <>
    <SettingsCard icon={Users} title="Konta pracowników" titleId="team-list-title" description={isLoading ? 'Wczytywanie…' : `${users.length} ${users.length === 1 ? 'konto' : 'kont'} z dostępem do warsztatu. Rolę możesz zmienić w każdej chwili.`}>
      {error && <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error.message}</p>}
      {isLoading ? <p className="text-sm text-[#817970]">Wczytywanie użytkowników…</p> : users.length === 0 ? <p className="text-sm text-[#817970]">Nie ma jeszcze kont użytkowników.</p> : <ul className="-my-2 flex flex-col divide-y divide-[#f0ebe5]">
        {users.map((user) => {
          const name = user.full_name || user.email
          const self = user.id === currentUserId
          return <li key={user.id} className="flex flex-wrap items-center gap-3 py-3">
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f3efea] text-[13px] font-bold uppercase text-[#6f6760]">{name.slice(0, 1)}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#2b2622]">{name}{self && <span className="ml-2 rounded-full bg-[#fbf1ea] px-2 py-0.5 text-[10px] font-bold text-primary">To Ty</span>}</p><p className="truncate text-xs text-[#817970]">{user.email}</p></div>
            <select value={user.role} disabled={busy || self} aria-label={`Rola: ${user.email}`} onChange={(event) => void updateRole(user.id, event.target.value as Role)} className="h-9 rounded-lg border border-[#e5ded6] bg-white px-2 text-xs font-semibold disabled:opacity-60">{roles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select>
            {self ? <span className="size-9" aria-hidden="true" /> : <button type="button" disabled={busy} onClick={() => void removeUser(user)} aria-label={`Usuń konto ${user.email}`} className="grid size-9 place-items-center rounded-lg text-[#80786f] hover:bg-red-50 hover:text-red-700 disabled:opacity-50"><Trash2 className="size-4" aria-hidden="true" /></button>}
          </li>
        })}
      </ul>}
    </SettingsCard>

    <SettingsCard icon={UserPlus} title="Dodaj pracownika" titleId="team-add-title" description="Utwórz konto i przekaż pracownikowi e-mail oraz hasło początkowe.">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold text-[#48423d]">Imię i nazwisko<input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required maxLength={120} className="mt-1.5 h-10 w-full rounded-lg border border-[#e5ded6] bg-white px-3 text-sm font-normal outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30" /></label>
        <label className="text-xs font-semibold text-[#48423d]">E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="mt-1.5 h-10 w-full rounded-lg border border-[#e5ded6] bg-white px-3 text-sm font-normal outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30" /></label>
        <label className="text-xs font-semibold text-[#48423d]">Hasło początkowe<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} maxLength={128} autoComplete="new-password" required className="mt-1.5 h-10 w-full rounded-lg border border-[#e5ded6] bg-white px-3 text-sm font-normal outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30" /><span className="mt-1 block font-normal text-[#817970]">Co najmniej 10 znaków.</span></label>
        <label className="text-xs font-semibold text-[#48423d]">Rola<select value={role} onChange={(event) => setRole(event.target.value as Role)} className="mt-1.5 h-10 w-full rounded-lg border border-[#e5ded6] bg-white px-3 text-sm font-normal outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30">{roles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select></label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button disabled={busy} type="submit">{busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}Utwórz konto</Button>
          {feedback && <p role="status" className="text-[13px] text-[#625a52]">{feedback}</p>}
        </div>
      </form>
    </SettingsCard>
  </>
}
