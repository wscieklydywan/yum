/** Polski numer komórkowy: 9 cyfr, opcjonalny prefiks +48/0048 i spacje/myślniki są usuwane. */
export function normalizePhone(value: unknown) {
  if (typeof value !== 'string') return ''
  const digits = value.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('48')) return digits.slice(2)
  if (digits.length === 13 && digits.startsWith('0048')) return digits.slice(4)
  return digits
}

export const isValidPhone = (value: string) => /^[0-9]{9}$/.test(value)

export const formatPhone = (value: string) => value.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3')
