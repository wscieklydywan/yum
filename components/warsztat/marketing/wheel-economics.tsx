'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { formatMoney, WHEEL_CONFIG_KEY, type WheelConfig } from '@/lib/marketing'
import { wheelPrizeCost } from '@/lib/loyalty-economics'
import type { WheelPrizeAdmin } from '@/lib/wheel'
import { EconomicsNote, fetchJson, Metric } from './economics-parts'
import { useStarCost } from './use-star-cost'

type Product = { id: string; price: number }

const SOURCE_LABEL = {
  none: 'bez kosztu',
  stars: 'Stars × koszt 1 Star',
  manual: 'koszt wpisany ręcznie',
  menu: 'surowiec z ceny menu',
  discount: 'kwota rabatu',
  unknown: 'wpisz „Koszt nagrody” w edycji',
} as const

export function useWheelCosts(prizes: WheelPrizeAdmin[], products: Product[]) {
  const star = useStarCost()
  return useMemo(() => {
    const prices = new Map(products.map((product) => [product.id, Number(product.price)]))
    const costs = new Map(prizes.map((prize) => [prize.id, wheelPrizeCost(prize, star.starCost, (id) => prices.get(id), star.foodCostPercent)]))
    const drawable = prizes.filter((prize) => prize.active && prize.chance > 0)
    const total = drawable.reduce((sum, prize) => sum + prize.chance, 0)
    const perSpin = total > 0 ? drawable.reduce((sum, prize) => sum + (prize.chance / total) * (costs.get(prize.id)?.cost ?? 0), 0) : 0
    const unknown = drawable.filter((prize) => costs.get(prize.id)?.source === 'unknown').length
    return { star, costs, perSpin, unknown }
  }, [prizes, products, star])
}

export function WheelEconomics({ perSpin, unknown, starCost, zlPerStar }: { perSpin: number; unknown: number; starCost: number; zlPerStar: number }) {
  const { data: config } = useSWR<WheelConfig>(WHEEL_CONFIG_KEY, fetchJson)
  const extraCost = config?.extraSpinCost ?? 0
  const paidValue = extraCost * starCost
  const paidNet = perSpin - paidValue
  const monthPerCustomer = perSpin * 30
  const monthSpendEquivalent = zlPerStar > 0 && starCost > 0 ? (monthPerCustomer / starCost) * zlPerStar : 0

  return (
    <section aria-labelledby="wheel-eco" className="flex flex-col gap-3">
      <h3 id="wheel-eco" className="text-sm font-black text-[#262220]">Opłacalność koła</h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Koszt 1 zakręcenia" value={formatMoney(perSpin)} hint="Średnio, z szans i kosztów nagród" />
        <Metric label="Na 100 zakręceń" value={formatMoney(perSpin * 100)} />
        <Metric label="Klient / miesiąc" value={formatMoney(monthPerCustomer)} hint="30 darmowych zakręceń" />
        {config?.extraSpinEnabled ? (
          <Metric label="Płatne zakręcenie" value={formatMoney(paidNet)} tone={paidNet <= 0 ? 'good' : 'warn'} hint={`Klient płaci ${extraCost} Stars (${formatMoney(paidValue)})`} />
        ) : (
          <Metric label="Płatne zakręcenie" value="Wyłączone" hint="Budżet i ustawienia" />
        )}
      </div>
      <EconomicsNote>
        <p>
          Koszt nagrody z punktami = Stars × koszt 1 Star ({formatMoney(starCost)}, z katalogu „Wydaj Stars”). Darmowa pozycja liczy się jako surowiec z ceny menu, rabat kwotowy jako jego kwota – chyba że wpiszesz własny „Koszt nagrody” w edycji pola.
          {' '}Aktywny klient kręcący codziennie kosztuje ok. {formatMoney(monthPerCustomer)} miesięcznie – tyle, ile Stars z zamówień za {formatMoney(monthSpendEquivalent)}.
          {paidNet > 0 && config?.extraSpinEnabled ? ' Płatne zakręcenie kosztuje więcej, niż klient za nie płaci – podnieś jego cenę lub obniż wygrane.' : ''}
          {unknown > 0 && <strong className="text-amber-700"> {unknown} {unknown === 1 ? 'pole nie ma' : 'pola nie mają'} kosztu – uzupełnij „Koszt nagrody”, żeby wynik był pełny.</strong>}
        </p>
      </EconomicsNote>
    </section>
  )
}

export { SOURCE_LABEL as WHEEL_COST_SOURCE_LABEL }
