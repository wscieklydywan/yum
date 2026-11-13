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
  stars: 'wyliczone z punktów',
  manual: 'wpisane przez Ciebie',
  menu: 'wyliczone z ceny menu',
  discount: 'kwota rabatu',
  unknown: 'brak – otwórz i wpisz koszt',
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
      <h3 id="wheel-eco" className="text-sm font-black text-zinc-900">Ile Cię to kosztuje?</h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Jedno zakręcenie" value={formatMoney(perSpin)} hint="Średnio tyle oddajesz za jeden obrót koła" />
        <Metric label="100 zakręceń" value={formatMoney(perSpin * 100)} hint="Np. 100 klientów zakręci raz" />
        <Metric label="1 klient przez miesiąc" value={formatMoney(monthPerCustomer)} hint="Jeśli kręci codziennie" />
        {config?.extraSpinEnabled ? (
          <Metric label="Dodatkowe zakręcenie" value={formatMoney(paidNet)} tone={paidNet <= 0 ? 'good' : 'warn'} hint={paidNet <= 0 ? `Zarabiasz – klient płaci ${extraCost} Stars` : `Tracisz – klient płaci tylko ${extraCost} Stars`} />
        ) : (
          <Metric label="Dodatkowe zakręcenie" value="Wyłączone" hint="Zmienisz w „Podsumowanie i budżet”" />
        )}
      </div>
      <EconomicsNote>
        <p>
          Liczymy to sami na podstawie nagród i ich szans. Jeśli klient kręci codziennie, przez miesiąc oddasz mu ok. <strong className="tabular-nums">{formatMoney(monthPerCustomer)}</strong> – to tak, jakby dostał punkty za zamówienia warte {formatMoney(monthSpendEquivalent)}.
          {paidNet > 0 && config?.extraSpinEnabled ? ' Dodatkowe zakręcenie jest dla Ciebie stratne – podnieś jego cenę albo zmniejsz szanse na drogie nagrody.' : ''}
          {unknown > 0 && <strong className="text-amber-700"> {unknown} {unknown === 1 ? 'pole nie ma' : 'pola nie mają'} wpisanego kosztu – otwórz je i wpisz „Ile Cię to kosztuje?”.</strong>}
        </p>
      </EconomicsNote>
    </section>
  )
}

export { SOURCE_LABEL as WHEEL_COST_SOURCE_LABEL }
