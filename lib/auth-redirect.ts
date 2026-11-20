export function authCallbackUrl(nextPath: string) {
  const url = new URL('/auth/callback', window.location.origin)
  url.searchParams.set('next', nextPath)
  return url.toString()
}

type AuthErrorLike = { message?: string; status?: number; code?: string }

export function describeAuthError(error: AuthErrorLike, mode: 'login' | 'register' | 'reset' | 'update') {
  const message = error.message?.toLowerCase() ?? ''
  const code = error.code ?? ''

  if (error.status === 429 || code.includes('rate_limit') || message.includes('rate limit')) {
    return 'Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.'
  }
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'Potwierdź adres e-mail – kod aktywacyjny wysłaliśmy na Twoją skrzynkę.'
  }
  if (code === 'weak_password' || message.includes('password should')) {
    return 'Hasło jest zbyt słabe. Użyj co najmniej 8 znaków, w tym liter i cyfr.'
  }
  if (code === 'same_password') return 'Nowe hasło musi różnić się od poprzedniego.'
  if (code === 'email_address_invalid') return 'Ten adres e-mail nie jest akceptowany. Użyj innego adresu.'
  if (mode === 'login' && (code === 'invalid_credentials' || message.includes('invalid login'))) {
    return 'Nieprawidłowy e-mail lub hasło.'
  }
  if (mode === 'register' && (code === 'user_already_exists' || message.includes('already registered'))) {
    return 'Nie udało się założyć konta. Jeśli masz już konto, zaloguj się.'
  }
  return 'Coś poszło nie tak. Spróbuj ponownie za chwilę.'
}
