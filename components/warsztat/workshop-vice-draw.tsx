'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { CheckCircle2, Dices, Loader2, Mail, Phone, Send, Ticket, TriangleAlert, Users } from 'lucide-react'
import type { ViceDrawAdmin } from '@/lib/vice-draw'
import { fetchJson } from './marketing/economics-parts'

type DrawData = { participants: number; tickets: number; draw: ViceDrawAdmin | null; emailConfigured: boolean }

const KEY = '/api/workshop/vice-draw'
const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const formatPhone = (phone: string) => phone.replace(/(\d{3})(?=\d)/g, '$1 ')

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#eee5d8] bg-white p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" aria-hidden="true" /></span>
      <div>
        <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function ContactRow({ icon: Icon, href, children }: { icon: typeof Mail; href?: string; children: React.ReactNode }) {
  const content = <><Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="min-w-0 break-all">{children}</span></>
  return href
    ? <a href={href} className="flex items-center gap-2 text-sm font-medium underline-offset-2 hover:underline">{content}</a>
    : <p className="flex items-center gap-2 text-sm text-muted-foreground">{content}</p>
}

export function WorkshopViceDraw() {
  const { data, error, isLoading, mutate } = useSWR<DrawData>(KEY, fetchJson, { refreshInterval: 30_000 })
  const [sending, setSending] = useState(false)
  const [confirmResend, setConfirmResend] = useState(false)

  async function sendEmail(drawId: string) {
    setSending(true)
    try {
      const response = await fetch(KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send_email', drawId }) })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error ?? 'Nie udało się wysłać maila.')
      await mutate((current) => (current ? { ...current, draw: result.draw } : current), { revalidate: false })
      setConfirmResend(false)
      toast.success('Mail do zwycięzcy wysłany')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Nie udało się wysłać maila.')
      mutate()
    } finally {
      setSending(false)
    }
  }

  if (error) return <p className="m-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error.message}</p>
  if (isLoading || !data) return <div className="flex justify-center p-6"><Loader2 className="size-5 animate-spin text-primary" aria-label="Wczytywanie" /></div>

  const { draw } = data
  const canEmail = Boolean(draw?.contact.email) && data.emailConfigured

  return (
    <section aria-labelledby="vice-draw-heading" className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 pb-28 sm:p-6 xl:pb-6">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Zakładka tymczasowa</p>
        <h1 id="vice-draw-heading" className="text-2xl font-bold tracking-tight">Losowanie GTA VI</h1>
        <p className="text-sm text-muted-foreground">Losujesz w widżecie na stronie Yummy Club. Tutaj widzisz dane kontaktowe zwycięzcy i ręcznie wysyłasz mu maila.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Stat icon={Users} label="Uczestników" value={data.participants.toLocaleString('pl-PL')} />
        <Stat icon={Ticket} label="Losów w puli" value={data.tickets.toLocaleString('pl-PL')} />
      </div>

      {!draw ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#e2d8ca] bg-white p-8 text-center">
          <Dices className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-semibold">Jeszcze nie wylosowano zwycięzcy</p>
          <p className="max-w-sm text-sm text-muted-foreground">Otwórz widżet GTA VI na stronie Yummy Club i kliknij „Losuj”. Wynik pojawi się tutaj automatycznie.</p>
        </div>
      ) : (
        <article className="flex flex-col gap-4 rounded-2xl border border-[#eee5d8] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Zwycięzca</p>
              <p className="text-xl font-bold">{draw.contact.name ?? draw.name}</p>
              <p className="text-xs text-muted-foreground">W widżecie widoczny jako „{draw.name}” · wylosowano {formatDate(draw.drawnAt)}</p>
            </div>
            <span className="rounded-full bg-[#fbf5ec] px-3 py-1 text-xs font-bold tabular-nums">Los #{draw.ticketNumber}/{draw.totalTickets} · {draw.tickets} {draw.tickets === 1 ? 'los' : 'losy'}</span>
          </div>

          <div className="flex flex-col gap-2 rounded-xl bg-[#fbf7f2] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Kontakt</p>
            {draw.contact.phone
              ? <ContactRow icon={Phone} href={`tel:+48${draw.contact.phone}`}>{formatPhone(draw.contact.phone)}</ContactRow>
              : <ContactRow icon={Phone}>Brak numeru telefonu</ContactRow>}
            {draw.contact.email
              ? <ContactRow icon={Mail} href={`mailto:${draw.contact.email}`}>{draw.contact.email}</ContactRow>
              : <ContactRow icon={Mail}>Brak adresu e-mail – skontaktuj się telefonicznie</ContactRow>}
          </div>

          <div className="flex flex-col gap-3 border-t border-[#eee5d8] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm" aria-live="polite">
              {draw.emailSentAt ? (
                <p className="flex items-center gap-2 font-medium text-emerald-700"><CheckCircle2 className="size-4" aria-hidden="true" />Mail wysłany {formatDate(draw.emailSentAt)}</p>
              ) : draw.emailError ? (
                <p className="flex items-start gap-2 text-red-700"><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Błąd wysyłki: {draw.emailError}</p>
              ) : (
                <p className="text-muted-foreground">Mail nie został jeszcze wysłany.</p>
              )}
              {!data.emailConfigured && <p className="mt-1 text-red-700">Brak konfiguracji Resend.</p>}
            </div>
            <button
              type="button"
              disabled={!canEmail || sending}
              onClick={() => (draw.emailSentAt && !confirmResend ? setConfirmResend(true) : sendEmail(draw.id))}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-opacity disabled:opacity-50"
            >
              {sending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
              {draw.emailSentAt ? (confirmResend ? 'Na pewno? Wyślij ponownie' : 'Wyślij ponownie') : 'Wyślij maila'}
            </button>
          </div>
        </article>
      )}
    </section>
  )
}
