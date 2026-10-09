'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, LoaderCircle, MailCheck, RotateCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { describeAuthError } from '@/lib/auth-redirect'
import { cn } from '@/lib/utils'

const RESEND_COOLDOWN = 120
const CODE_LENGTH = 6

export function ClubVerifyCode({ email, onBack }: { email: string; onBack: () => void }) {
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendAt, setResendAt] = useState(() => Date.now() + RESEND_COOLDOWN * 1000)
  const [now, setNow] = useState(() => Date.now())

  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000))

  useEffect(() => {
    if (secondsLeft === 0) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [secondsLeft])

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (code.length !== CODE_LENGTH) {
      setNotice(`Wpisz ${CODE_LENGTH}-cyfrowy kod z e-maila.`)
      return
    }
    setSubmitting(true)
    setNotice('')
    const { error } = await createClient().auth.verifyOtp({ email, token: code, type: 'signup' })
    if (error) {
      setSubmitting(false)
      const expired = error.code === 'otp_expired' || error.message?.toLowerCase().includes('expired')
      setNotice(expired ? 'Kod jest nieprawidłowy lub wygasł. Sprawdź go albo wyślij nowy.' : describeAuthError(error, 'register'))
      return
    }
    window.location.assign('/yummy-club/aktywowano')
  }

  async function resend() {
    setResending(true)
    setNotice('')
    const { error } = await createClient().auth.resend({ type: 'signup', email })
    setResending(false)
    if (error) {
      setNotice(describeAuthError(error, 'register'))
      return
    }
    setCode('')
    setResendAt(Date.now() + RESEND_COOLDOWN * 1000)
    setNow(Date.now())
    setNotice('Wysłaliśmy nowy kod. Poprzedni przestał działać.')
  }

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = String(secondsLeft % 60).padStart(2, '0')

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 self-start text-xs font-medium text-muted-foreground hover:text-foreground sm:text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Wróć do rejestracji
      </button>

      <div className="flex flex-col items-center gap-2 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
          <MailCheck className="size-6" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-extrabold sm:text-xl">Wpisz kod z e-maila</h2>
        <p className="text-sm text-muted-foreground">
          Wysłaliśmy {CODE_LENGTH}-cyfrowy kod na <strong className="break-all text-foreground">{email}</strong>
        </p>
      </div>

      <form onSubmit={verify} className="flex flex-col gap-3">
        <label className="sr-only" htmlFor="club-signup-code">Kod aktywacyjny</label>
        <input
          id="club-signup-code"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          placeholder={'•'.repeat(CODE_LENGTH)}
          maxLength={CODE_LENGTH}
          className="h-14 w-full rounded-xl bg-background/70 text-center font-mono text-2xl font-bold tracking-[0.5em] outline-none ring-1 ring-border transition-shadow placeholder:text-muted-foreground/40 focus:ring-2 focus:ring-primary/60"
        />
        <button
          type="submit"
          disabled={submitting || code.length !== CODE_LENGTH}
          className="group flex h-12 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_8px_20px_rgba(226,38,28,0.25)] transition-colors hover:bg-primary/90 disabled:opacity-60 sm:h-14 sm:text-base"
        >
          <span className="flex-1 pl-5 text-center">Aktywuj konto</span>
          {submitting ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-5" aria-hidden="true" />}
        </button>
      </form>

      <button
        type="button"
        onClick={resend}
        disabled={secondsLeft > 0 || resending}
        className={cn(
          'flex items-center justify-center gap-1.5 text-xs font-semibold sm:text-sm',
          secondsLeft > 0 ? 'text-muted-foreground' : 'text-primary hover:underline',
        )}
      >
        {resending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <RotateCw className="size-4" aria-hidden="true" />}
        {secondsLeft > 0 ? `Wyślij kod ponownie za ${minutes}:${seconds}` : 'Wyślij kod ponownie'}
      </button>

      <p role="status" aria-live="polite" className={cn('text-center text-xs text-primary', !notice && 'sr-only')}>
        {notice}
      </p>
    </div>
  )
}
