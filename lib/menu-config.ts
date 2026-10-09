import type { ModifierGroup, ModifierOption, Product, Station } from './menu'

export type MenuSelection = {
  variantId?: string
  modifiers?: Record<string, string[]>
}

/** A modifier sold as its own order line (drink, coffee, fries, set…), so it is billed and checked off separately. */
export type SeparateLine = {
  name: string
  unitPrice: number
  /** Station set for this option (part) in the menu editor. */
  station: Station
}

export type ResolvedSelection =
  | {
    ok: true
    /** Full price of the configured product including every add-on (cart display). */
    unitPrice: number
    /** Every chosen option, for the cart. */
    details: string[]
    /** Price of the main product without separately billed add-ons. */
    baseUnitPrice: number
    /** Options that stay on the main product (variant, burger toppings, included sauces). */
    baseDetails: string[]
    separateLines: SeparateLine[]
    selection: MenuSelection
  }
  | { ok: false; error: string }

const SEPARATE_GROUP_PREFIXES = ['zestaw', 'napoj', 'kawa', 'milkshake', 'deser', 'frytki']

export function isSeparateGroup(group: Pick<ModifierGroup, 'id'>) {
  return isSauceGroup(group) || SEPARATE_GROUP_PREFIXES.some((prefix) => group.id.startsWith(prefix))
}

const isSauceGroup = (group: Pick<ModifierGroup, 'id'>) => group.id.startsWith('sosy')

export function separateLineName(group: Pick<ModifierGroup, 'id'>, optionName: string) {
  if (group.id.startsWith('zestaw')) return `Zestaw: ${optionName}`
  if (isSauceGroup(group)) return `Sos ${optionName.toLocaleLowerCase('pl-PL')}`
  return displayName(optionName)
}

/** Parts of an option that land on the order as separate lines: "Pepsi + frytki" → ["Pepsi", "frytki"]. */
export function optionParts(group: Pick<ModifierGroup, 'id'>, optionName: string): string[] {
  if (!group.id.startsWith('zestaw') && !optionName.includes('+')) return [optionName]
  const parts = optionName.split('+').map((part) => part.trim()).filter(Boolean)
  return parts.length > 0 ? parts : [optionName]
}

/** Station of each option part exactly as set in the menu editor (the group's station when the option has none). */
export function optionStations(group: Pick<ModifierGroup, 'id' | 'station'>, option: Pick<ModifierOption, 'name' | 'stations'>): Station[] {
  return optionParts(group, option.name).map((_, index) => option.stations?.[index] ?? group.station ?? 'cashier')
}

export type StationCheck = (station: Station) => boolean

/** An add-on can be chosen only when every station preparing one of its parts is open. */
export function optionAvailable(group: Pick<ModifierGroup, 'id' | 'station'>, option: Pick<ModifierOption, 'name' | 'stations'>, isOpen?: StationCheck) {
  return !isOpen || optionStations(group, option).every(isOpen)
}

/** Drops chosen add-ons whose station has been switched off. */
export function availableModifiers(product: Product, modifiers: Record<string, string[]>, isOpen?: StationCheck) {
  if (!isOpen) return modifiers
  const result: Record<string, string[]> = {}
  for (const group of product.modifierGroups ?? []) {
    const ids = modifiers[group.id]
    if (!ids) continue
    result[group.id] = ids.filter((id) => {
      const option = group.options.find((entry) => entry.id === id)
      return option ? optionAvailable(group, option, isOpen) : false
    })
  }
  return result
}

/** Splits a chosen add-on into the lines that land on the order, each on the station set for it in the menu editor. */
export function separateLinesFor(group: Pick<ModifierGroup, 'id' | 'station'>, option: Pick<ModifierOption, 'name' | 'price' | 'stations'>): SeparateLine[] {
  const stations = optionStations(group, option)
  if (group.id.startsWith('zestaw') || option.name.includes('+')) {
    const parts = optionParts(group, option.name).map((part) => displayName(part)).map((part) => part.charAt(0).toLocaleUpperCase('pl-PL') + part.slice(1))
    // A set option has one price for the whole set: it goes on the first part, the rest are 0 zł components.
    return parts.map((part, index) => ({ name: `${part} (zestaw)`, unitPrice: index === 0 ? round(option.price) : 0, station: stations[index] }))
  }
  const inSet = (group.id.startsWith('napoj_') || isSauceGroup(group)) && option.price === 0
  return [{ name: `${separateLineName(group, option.name)}${inSet ? ' (zestaw)' : ''}`, unitPrice: round(option.price), station: stations[0] }]
}

export const NO_SAUCE_LABEL = 'Bez sosu'

export function hasConfigurator(product: Product) {
  return Boolean(product.variants?.length || product.modifierGroups?.length)
}

export function displayName(value: string) {
  if (value !== value.toLocaleUpperCase('pl-PL')) return value
  const lower = value.toLocaleLowerCase('pl-PL')
  return lower.charAt(0).toLocaleUpperCase('pl-PL') + lower.slice(1)
}

export function variantGroupLabel(category: string, names: string[]) {
  if (names.some((name) => /single|double/i.test(name))) return 'Ilość mięsa'
  if (names.some((name) => /^(mały|duży|mala|duza|mała|duża)$/i.test(name.trim()))) return 'Rozmiar'
  if (names.some((name) => /szt/i.test(name))) return 'Ilość'
  if (names.some((name) => /ml|l$/i.test(name))) return 'Pojemność'
  if (category.startsWith('frytki')) return 'Rodzaj frytek'
  return 'Wariant'
}

export function isRequiredGroup(group: ModifierGroup) {
  return group.min > 0
}

export function groupMax(group: ModifierGroup) {
  if (group.mode === 'single') return 1
  return group.max ?? group.options.length
}

export function groupDetail(group: ModifierGroup, names: string[]) {
  if (group.id.startsWith('zestaw')) return `Zestaw: ${names.join(', ')}`
  if (group.id === 'dodatki_burger') return names.map((name) => `+ ${name.toLocaleLowerCase('pl-PL')}`).join(', ')
  return `${group.name}: ${names.join(', ')}`
}

const round = (value: number) => Math.round(value * 100) / 100

export function resolveSelection(product: Product, selection: MenuSelection = {}): ResolvedSelection {
  const variants = product.variants ?? []
  const groups = product.modifierGroups ?? []
  const details: string[] = []
  const baseDetails: string[] = []
  const separateLines: SeparateLine[] = []
  let unitPrice = product.price
  let baseUnitPrice = product.price
  let variantId: string | undefined

  if (variants.length > 0) {
    const variant = selection.variantId === undefined ? variants[0] : variants.find((entry) => entry.id === selection.variantId)
    if (!variant) return { ok: false, error: 'Wybrany wariant nie jest dostępny.' }
    unitPrice = variant.price
    baseUnitPrice = variant.price
    variantId = variant.id
    details.push(displayName(variant.name))
    baseDetails.push(displayName(variant.name))
  }

  const submitted = selection.modifiers ?? {}
  for (const groupId of Object.keys(submitted)) {
    if (!groups.some((group) => group.id === groupId)) return { ok: false, error: 'Wybrany dodatek nie jest dostępny.' }
  }

  const modifiers: Record<string, string[]> = {}
  for (const group of groups) {
    const ids = [...new Set(submitted[group.id] ?? [])]
    if (ids.length < group.min) return { ok: false, error: `Wybierz: ${group.name.toLocaleLowerCase('pl-PL')}.` }
    if (ids.length > groupMax(group)) return { ok: false, error: `Za dużo pozycji w grupie „${group.name}”.` }
    const chosen = ids.map((id) => group.options.find((option) => option.id === id))
    if (chosen.some((option) => !option)) return { ok: false, error: 'Wybrany dodatek nie jest dostępny.' }
    if (chosen.length === 0) continue
    modifiers[group.id] = ids
    const groupPrice = chosen.reduce((sum, option) => sum + option!.price, 0)
    unitPrice += groupPrice
    const noSauce = isSauceGroup(group) && chosen.every((option) => option!.name === NO_SAUCE_LABEL)
    if (isSeparateGroup(group) && !noSauce) {
      for (const option of chosen) {
        if (option!.name === NO_SAUCE_LABEL) continue
        const lines = separateLinesFor(group, option!)
        separateLines.push(...lines)
        details.push(lines.length > 1 ? `Zestaw: ${lines.map((line) => line.name.replace(' (zestaw)', '')).join(' + ')}` : `+ ${lines[0].name}`)
      }
    } else {
      details.push(groupDetail(group, chosen.map((option) => option!.name)))
      baseUnitPrice += groupPrice
      baseDetails.push(groupDetail(group, chosen.map((option) => option!.name)))
    }
  }

  return { ok: true, unitPrice: round(unitPrice), details, baseUnitPrice: round(baseUnitPrice), baseDetails, separateLines, selection: { variantId, modifiers } }
}

export function priceHint(group: ModifierGroup) {
  const prices = group.options.map((option) => option.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const format = (value: number) => `${value.toFixed(2).replace('.', ',')} zł`
  if (max === 0) return 'w cenie'
  if (min === max) return `+${format(min)}`
  return `od ${format(min)}`
}

/** Validates a selection submitted by a client before it is resolved against the catalog. */
export function parseSelection(raw: unknown): MenuSelection | null {
  if (raw === undefined || raw === null) return {}
  if (typeof raw !== 'object' || Array.isArray(raw)) return null
  const { variantId, modifiers } = raw as { variantId?: unknown; modifiers?: unknown }
  if (variantId !== undefined && (typeof variantId !== 'string' || variantId.length > 100)) return null
  const parsed: Record<string, string[]> = {}
  if (modifiers !== undefined) {
    if (typeof modifiers !== 'object' || modifiers === null || Array.isArray(modifiers)) return null
    const entries = Object.entries(modifiers)
    if (entries.length > 20) return null
    for (const [groupId, ids] of entries) {
      if (!Array.isArray(ids) || ids.length > 20 || !ids.every((id) => typeof id === 'string' && id.length <= 100)) return null
      parsed[groupId] = ids
    }
  }
  return { variantId, modifiers: parsed }
}
