export const LOTTERY_START = '2026-11-13T00:00:00+01:00'
export const LOTTERY_END = '2026-11-18T23:59:59+01:00'
export const LOTTERY_DRAW = '2026-11-19T15:00:00+01:00'

export type LotteryStatus = {
  signedIn: boolean
  joined: boolean
  tickets: number
  open: boolean
}

type OrderLine = { name?: string; set?: string; quantity?: number; cancelled?: boolean }

/** Every set bought in a completed order is one entry in the draw. */
export function countSets(items: unknown): number {
  if (!Array.isArray(items)) return 0
  const setGroups = new Set<string>()
  let standalone = 0
  for (const line of items as OrderLine[]) {
    if (!line || line.cancelled) continue
    if (line.set) {
      setGroups.add(line.set)
      continue
    }
    const name = line.name ?? ''
    if (/zestaw/i.test(name) && !/\(zestaw\)/i.test(name)) standalone += Math.max(1, Number(line.quantity) || 1)
  }
  return setGroups.size + standalone
}

export function isLotteryOpen(now = new Date()) {
  return now >= new Date(LOTTERY_START) && now <= new Date(LOTTERY_END)
}
