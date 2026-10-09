'use client'

import { useState, type FormEvent } from 'react'
import { ArrowRight, ChevronRight, Eye, EyeOff, LoaderCircle, Lock, Mail, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { authCallbackUrl, describeAuthError } from '@/lib/auth-redirect'
import { cn } from '@/lib/utils'
import { ClubVerifyCode } from './club-verify-code'

type Mode = 'login' | 'register'

const tabs: { id: Mode; label: string }[] = [
  { id: 'login', label: 'Logowanie' },
  { id: 'register', label: 'Rejestracja' },
]

export function ClubAuthPanel({ initialNotice = '' }: { initialNotice?: string }) {
  const [mode, setMode] = useState<Mode>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [notice, setNotice] = useState(initialNotice)
  const [submitting, setSubmitting] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  const isLogin = mode === 'login'

  function switchMode(next: Mode) {
    setMode(next)
    setNotice('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    const name = String(form.get('name') ?? '').trim().slice(0, 80)

    setSubmitting(true)
    setNotice('')
    const supabase = createClient()

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error?.code === 'email_not_confirmed') {
        await supabase.auth.resend({ type: 'signup', email })
        setSubmitting(false)
        setPendingEmail(email)
        return
      }
      if (error) {
        setNotice(describeAuthError(error, 'login'))
        setSubmitting(false)
        return
      }
      window.location.assign('/yummy-club')
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: authCallbackUrl('/yummy-club/aktywowano'),
        data: { full_name: name },
      },
    })
    setSubmitting(false)
    if (error) {
      setNotice(describeAuthError(error, 'register'))
      return
    }
    if (data.session) {
      window.location.assign('/yummy-club')
      return
    }
    setPendingEmail(email)
  }

  if (pendingEmail) {
    return (
      <section
        aria-label="Potwierdzenie konta Yummy Club"
        className="rounded-3xl bg-card/80 p-4 shadow-[0_10px_40px_rgba(80,30,10,0.07)] ring-1 ring-border/60 sm:p-7 lg:sticky lg:top-6"
      >
        <ClubVerifyCode email={pendingEmail} onBack={() => setPendingEmail(null)} />
      </section>
    )
  }

  async function handleResetPassword() {
    const input = document.querySelector<HTMLInputElement>('#club-auth-form input[name="email"]')
    const email = input?.value.trim() ?? ''
    if (!email || !input?.checkValidity()) {
      setNotice('Wpisz adres e-mail, a wyślemy Ci link do zmiany hasła.')
      input?.focus()
      return
    }
    setSubmitting(true)
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: authCallbackUrl('/yummy-club/nowe-haslo'),
    })
    setSubmitting(false)
    setNotice(
      error && error.status === 429
        ? describeAuthError(error, 'reset')
        : 'Jeśli konto istnieje, wysłaliśmy link do zmiany hasła na podany adres.',
    )
  }

  async function handleSocial(provider: 'google' | 'apple') {
    setSubmitting(true)
    setNotice('')
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: authCallbackUrl('/yummy-club') },
    })
    if (error) {
      setSubmitting(false)
      const label = provider === 'google' ? 'Google' : 'Apple'
      setNotice(
        error.message?.toLowerCase().includes('not enabled')
          ? `Logowanie przez ${label} nie jest jeszcze włączone.`
          : describeAuthError(error, 'login'),
      )
    }
  }

  return (
    <section
      aria-label="Konto Yummy Club"
      className="rounded-3xl bg-card/80 p-4 shadow-[0_10px_40px_rgba(80,30,10,0.07)] ring-1 ring-border/60 sm:p-7 lg:sticky lg:top-6"
    >
      <div role="tablist" aria-label="Wybierz formularz" className="grid grid-cols-2 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={mode === tab.id}
            aria-controls="club-auth-form"
            onClick={() => switchMode(tab.id)}
            className={cn(
              '-mb-px border-b-2 pb-2.5 pt-1 text-sm font-semibold transition-colors sm:pb-3 sm:text-base',
              mode === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form
        id="club-auth-form"
        role="tabpanel"
        aria-labelledby={`tab-${mode}`}
        onSubmit={handleSubmit}
        className="mt-4 flex flex-col gap-2.5 sm:mt-6 sm:gap-3"
      >
        {!isLogin && (
          <AuthField icon={User} label="Imię">
            <input
              type="text"
              name="name"
              autoComplete="given-name"
              placeholder="Imię"
              required
              className="h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70 sm:text-base"
            />
          </AuthField>
        )}

        <AuthField icon={Mail} label="Adres e-mail">
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="Adres e-mail"
            required
            className="h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70 sm:text-base"
          />
        </AuthField>

        <AuthField icon={Lock} label="Hasło">
          <input
            type={showPassword ? 'text' : 'password'}
            name="password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            placeholder="Hasło"
            minLength={isLogin ? undefined : 8}
            required
            className="h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70 sm:text-base"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
            aria-pressed={showPassword}
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
          >
            {showPassword ? <Eye className="size-4" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}
          </button>
        </AuthField>

        {isLogin && (
          <button
            type="button"
            onClick={handleResetPassword}
            disabled={submitting}
            className="self-end text-xs font-medium text-primary hover:underline sm:text-sm"
          >
            Nie pamiętasz hasła?
          </button>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="group mt-1 flex h-12 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_8px_20px_rgba(226,38,28,0.25)] transition-colors hover:bg-primary/90 disabled:opacity-60 sm:h-14 sm:text-base"
        >
          <span className="flex-1 pl-5 text-center">{isLogin ? 'Zaloguj się' : 'Załóż konto'}</span>
          {submitting ? (
            <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          )}
        </button>

        <p role="status" aria-live="polite" className={cn('text-center text-xs text-primary', !notice && 'sr-only')}>
          {notice}
        </p>
      </form>

      <div className="my-3 flex items-center gap-3 text-xs text-muted-foreground sm:my-5">
        <span className="h-px flex-1 bg-border" />
        lub
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="flex flex-col gap-2.5 sm:gap-3">
        <SocialButton disabled={submitting} onClick={() => handleSocial('apple')} label={isLogin ? 'Zaloguj się z Apple' : 'Kontynuuj z Apple'}>
          <AppleIcon />
        </SocialButton>
        <SocialButton disabled={submitting} onClick={() => handleSocial('google')} label={isLogin ? 'Zaloguj się z Google' : 'Kontynuuj z Google'}>
          <GoogleIcon />
        </SocialButton>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground sm:mt-6 sm:text-sm">
        {isLogin ? 'Nie masz konta?' : 'Masz już konto?'}{' '}
        <button
          type="button"
          onClick={() => switchMode(isLogin ? 'register' : 'login')}
          className="inline-flex items-center font-semibold text-primary hover:underline"
        >
          {isLogin ? 'Załóż konto' : 'Zaloguj się'}
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </p>
    </section>
  )
}

function AuthField({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Mail
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex h-11 items-center gap-3 rounded-xl bg-background/70 px-3.5 ring-1 ring-border transition-shadow focus-within:ring-2 focus-within:ring-primary/60 sm:h-13 sm:px-4">
      <span className="sr-only">{label}</span>
      <Icon className="size-4 shrink-0 text-muted-foreground sm:size-5" aria-hidden="true" />
      {children}
    </label>
  )
}

function SocialButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 disabled:opacity-60 items-center justify-center gap-2.5 rounded-full bg-card text-sm font-medium text-foreground ring-1 ring-border transition-colors hover:bg-muted sm:h-13 sm:text-base"
    >
      {children}
      {label}
    </button>
  )
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current sm:size-5">
      <path d="M16.37 12.63c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.28-1.6 2.78-.41 6.89 1.15 9.14.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.67zM14.1 5.88c.63-.77 1.06-1.83.94-2.88-.91.04-2.01.6-2.66 1.37-.58.67-1.09 1.75-.95 2.78 1.01.08 2.04-.51 2.67-1.27z" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 sm:size-5">
      <path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.65z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.28a12 12 0 0 0 0 10.8l4.01-3.1z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.28 6.6l4.01 3.1C6.23 6.86 8.88 4.75 12 4.75z" />
    </svg>
  )
}
