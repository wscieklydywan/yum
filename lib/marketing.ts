export type WheelConfig = {
  enabled: boolean
  extraSpinEnabled: boolean
  extraSpinCost: number
}

export const DEFAULT_WHEEL_CONFIG: WheelConfig = { enabled: true, extraSpinEnabled: true, extraSpinCost: 50 }

export const WHEEL_CONFIG_KEY = '/api/wheel/config'

export type MarketingSettings = WheelConfig & { monthlyBudget: number | null }

export type MarketingSource = 'wheel' | 'promo'

export type MarketingCostRow = {
  source: MarketingSource
  refId: string
  label: string
  uses: number
  total: number
  periodUses: number
  periodTotal: number
}

export type MarketingEvent = {
  id: number
  source: MarketingSource
  label: string
  amount: number
  created_at: string
}

export type MarketingOverview = {
  settings: MarketingSettings
  monthStart: string
  wheel: { monthTotal: number; monthUses: number }
  promo: { monthTotal: number; monthUses: number }
  rows: MarketingCostRow[]
  events: MarketingEvent[]
}

const currency = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 2 })

export function formatMoney(value: number) {
  return currency.format(value)
}

export function monthStartIso(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}
