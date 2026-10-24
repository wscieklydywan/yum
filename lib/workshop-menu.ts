import 'server-only'

export const ID_PATTERN = /^[A-Za-z0-9_-]{1,120}$/

export function slugify(value: string, fallback = 'pozycja') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[łŁ]/g, 'l')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || fallback
}

export const shortId = () => crypto.randomUUID().slice(0, 6)

export function money(value: unknown, max: number) {
  if (value === '' || value === null || value === undefined) return null
  const amount = Math.round(Number(value) * 100) / 100
  return Number.isFinite(amount) && amount >= 0 && amount <= max ? amount : null
}

export function integer(value: unknown, min: number, max: number) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : undefined
}

export function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function inList(ids: string[]) {
  return `(${ids.map((id) => `"${id}"`).join(',')})`
}
