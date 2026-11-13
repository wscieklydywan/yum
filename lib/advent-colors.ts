export type AdventColor = 'red' | 'green' | 'gold'

export const ADVENT_COLORS: { id: AdventColor; label: string }[] = [
  { id: 'red', label: 'Czerwony' },
  { id: 'green', label: 'Zielony' },
  { id: 'gold', label: 'Złoty' },
]

/** Kolor kafelka, gdy w warsztacie nie wybrano innego. */
export const adventDefaultColor = (day: number): AdventColor => (day % 5 === 0 ? 'green' : day % 7 === 0 ? 'gold' : 'red')

export const isAdventColor = (value: unknown): value is AdventColor => value === 'red' || value === 'green' || value === 'gold'
