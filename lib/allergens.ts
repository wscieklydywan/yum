export const ALLERGENS = [
  { id: 'gluten', label: 'Gluten' },
  { id: 'mleko', label: 'Mleko' },
  { id: 'jaja', label: 'Jaja' },
  { id: 'gorczyca', label: 'Gorczyca' },
  { id: 'sezam', label: 'Sezam' },
  { id: 'soja', label: 'Soja' },
  { id: 'seler', label: 'Seler' },
  { id: 'orzeszki', label: 'Orzeszki ziemne' },
  { id: 'orzechy', label: 'Orzechy' },
  { id: 'ryby', label: 'Ryby' },
  { id: 'skorupiaki', label: 'Skorupiaki' },
  { id: 'mieczaki', label: 'Mięczaki' },
  { id: 'siarczyny', label: 'Siarczyny' },
  { id: 'lubin', label: 'Łubin' },
] as const

export type AllergenId = (typeof ALLERGENS)[number]['id']

const allergenIds = new Set<string>(ALLERGENS.map((allergen) => allergen.id))

export function normalizeAllergens(raw: unknown): AllergenId[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.filter((value): value is AllergenId => typeof value === 'string' && allergenIds.has(value)))]
}

export function normalizeIngredients(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of raw) {
    if (typeof value !== 'string') continue
    const clean = value.replace(/\s+/g, ' ').trim().slice(0, 40)
    const key = clean.toLocaleLowerCase('pl-PL')
    if (!clean || seen.has(key)) continue
    seen.add(key)
    result.push(clean)
    if (result.length >= 30) break
  }
  return result
}

export function allergenLabel(id: string) {
  return ALLERGENS.find((allergen) => allergen.id === id)?.label ?? id
}

const EMOJI_PATTERN = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu

export function splitDescription(description: string, productName: string) {
  const lines = description
    .replace(EMOJI_PATTERN, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && line.toLocaleLowerCase('pl-PL') !== productName.toLocaleLowerCase('pl-PL'))
  const text = lines.join(' ').replace(/\s+/g, ' ').trim()
  const sentences = text.match(/[^.!?]+[.!?]*/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? []
  const listIndex = sentences.findIndex((sentence) => (sentence.match(/,/g)?.length ?? 0) >= 2)
  if (listIndex === -1) return { ingredients: [] as string[], tagline: text }

  const ingredients = sentences[listIndex]
    .replace(/[.!?]+$/, '')
    .replace(/\s[–-]\s.*$/, '')
    .split(/,\s*|\s+i\s+(?=[^,]+$)/)
    .map((part) => part.replace(/^(do tego|oraz|a także)\s+/i, '').trim())
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase('pl-PL') + part.slice(1))
  if (ingredients.length < 3 || ingredients.some((part) => part.length > 70)) return { ingredients: [] as string[], tagline: text }

  const tagline = sentences.filter((_, index) => index !== listIndex).join(' ').trim()
  return { ingredients, tagline }
}
