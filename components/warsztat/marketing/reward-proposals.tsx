'use client'

import { useMemo } from 'react'
import { Check, Plus, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/marketing'
import type { LoyaltyRate } from '@/lib/loyalty-rate'
import { linkedMenuValue, REWARD_BUDGETS, suggestedStarCost, type RewardItem, type RewardMenuProduct } from '@/lib/loyalty-economics'

export type RewardBudgetKey = (typeof REWARD_BUDGETS)[number]['key']

type Template = { name: string; note: string; items: { product: string; quantity?: number; choice?: boolean }[] }

/** Proste kupony z tanich, szybkich pozycji – od „pierwszej nagrody” po duży cel. */
const TEMPLATES: Template[] = [
  { name: 'Sos do wyboru', note: 'Dowolny sos do zamówienia', items: [{ product: 'KETCHUP', choice: true }] },
  { name: 'Espresso', note: 'Na dobry początek', items: [{ product: 'ESPRESSO' }] },
  { name: 'Ciasto', note: 'Kawałek ciasta do kawy', items: [{ product: 'Ciasto' }] },
  { name: 'Napój 0,5 l', note: 'Pepsi, 7UP, Mirinda, lemoniada lub woda', items: [{ product: 'PEPSI', choice: true }] },
  { name: 'Frytki cienkie', note: 'Porcja frytek', items: [{ product: 'FRYTKI CIENKIE' }] },
  { name: 'Krążki cebulowe', note: 'Chrupiąca porcja', items: [{ product: 'KRĄŻKI CEBULOWE' }] },
  { name: 'Churros', note: '4 sztuki', items: [{ product: 'Churros łezka 4szt' }] },
  { name: 'Milkshake', note: 'Klasyczny shake', items: [{ product: 'MILKSHAKE' }] },
  { name: 'Burger Junior', note: 'Dowolny burger Junior', items: [{ product: 'Yummy Junior', choice: true }] },
  { name: 'Burger SERTASTIC', note: 'Wersja SINGLE', items: [{ product: 'SERTASTIC' }] },
  {
    name: 'Zestaw SERTASTIC',
    note: 'Burger + frytki + napój',
    items: [{ product: 'SERTASTIC' }, { product: 'FRYTKI CIENKIE' }, { product: 'PEPSI', choice: true }],
  },
]

export type RewardProposal = { name: string; note: string; items: RewardItem[]; value: number; cost: number }

export function useRewardProposals(products: RewardMenuProduct[], rate: LoyaltyRate, foodCostPercent: number, budget: RewardBudgetKey) {
  return useMemo(() => {
    const byName = new Map(products.map((product) => [product.name.trim().toLowerCase(), product]))
    const percent = REWARD_BUDGETS.find((entry) => entry.key === budget)!.businessCostPercent
    const proposals: RewardProposal[] = []
    for (const template of TEMPLATES) {
      const items: RewardItem[] = []
      for (const entry of template.items) {
        const product = byName.get(entry.product.toLowerCase())
        if (!product) break
        items.push({ product_id: product.id, name: product.name, quantity: entry.quantity ?? 1, choice: entry.choice === true })
      }
      if (items.length !== template.items.length) continue
      const value = linkedMenuValue(items, (id) => products.find((product) => product.id === id)?.price) ?? 0
      proposals.push({ name: template.name, note: template.note, items, value, cost: suggestedStarCost(value, rate, foodCostPercent, percent) })
    }
    return proposals
  }, [products, rate, foodCostPercent, budget])
}

export function RewardBudgetPicker({ value, onChange }: { value: RewardBudgetKey; onChange: (value: RewardBudgetKey) => void }) {
  return (
    <div role="radiogroup" aria-label="Poziom hojności kuponów" className="flex flex-wrap gap-1.5">
      {REWARD_BUDGETS.map((entry) => (
        <button
          key={entry.key}
          type="button"
          role="radio"
          aria-checked={value === entry.key}
          onClick={() => onChange(entry.key)}
          className={cn(
            'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
            value === entry.key ? 'border-primary bg-primary text-primary-foreground' : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300',
          )}
        >
          {entry.label} · {entry.businessCostPercent.toLocaleString('pl-PL')}% obrotu
        </button>
      ))}
    </div>
  )
}

export function RewardProposals({
  proposals,
  existingNames,
  onAdd,
  onAddAll,
}: {
  proposals: RewardProposal[]
  existingNames: Set<string>
  onAdd: (proposal: RewardProposal) => void
  onAddAll: () => void
}) {
  const missing = proposals.filter((proposal) => !existingNames.has(proposal.name.toLowerCase()))
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-bold text-zinc-900">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          Propozycje z Twojego menu
        </p>
        {missing.length > 0 && (
          <button type="button" onClick={onAddAll} className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-700">
            Dodaj wszystkie brakujące ({missing.length})
          </button>
        )}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {proposals.map((proposal) => {
          const added = existingNames.has(proposal.name.toLowerCase())
          return (
            <li key={proposal.name} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-zinc-900">{proposal.name}</p>
                <p className="truncate text-xs text-zinc-500">
                  {formatMoney(proposal.value)} w menu · <strong className="tabular-nums text-zinc-900">{proposal.cost} pkt</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => onAdd(proposal)}
                disabled={added}
                aria-label={added ? `${proposal.name} jest już na liście` : `Dodaj kupon ${proposal.name}`}
                className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:bg-emerald-50 disabled:text-emerald-700"
              >
                {added ? <Check className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
