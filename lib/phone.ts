/** Polski numer komórkowy: 9 cyfr, opcjonalny prefiks +48/0048 i spacje/myślniki są usuwane. */
export function normalizePhone(value: unknown) {
  if (typeof value !== 'string') return ''
  const digits = value.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('48')) return digits.slice(2)
  if (digits.length === 13 && digits.startsWith('0048')) return digits.slice(4)
  return digits
}

/** Początek numeru do wyszukiwania prefiksowego (max 9 cyfr, bez +48/0048). */
export function phonePrefix(value: unknown) {
  if (typeof value !== 'string') return ''
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('0048')) digits = digits.slice(4)
  else if ((value.trim().startsWith('+') || digits.length > 9) && digits.startsWith('48')) digits = digits.slice(2)
  return digits.slice(0, 9)
}

export const looksLikePhone = (value: string) => /^[\d\s+()-]+$/.test(value.trim())

export const isValidPhone = (value: string) => /^[0-9]{9}$/.test(value)

export const formatPhone = (value: string) => value.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3')
