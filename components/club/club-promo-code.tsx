'use client'

import { useState, type FormEvent } from 'react'
import { mutate } from 'swr'
import { LoaderCircle, TicketPercent } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { ACTIVE_COUPONS_KEY } from '@/lib/coupons'
import { PROMO_ERROR_MESSAGES, normalizePromoCode, promoRewardSummary, type PromoRewardType } from '@/lib/promo-codes'
import { cardClass } from './club-member-sections'

export type PromoRedeemResult = {
  type: PromoRewardType
  points: number
  productName: string
  discountValue: number
  description: string
  code: string | null
  expiresAt: string | null
  totalPoints: number
}

export function ClubPromoCode({ onRedeemed }: { onRedeemed: (result: PromoRedeemResult, promoCode: string) => void }) {
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = normalizePromoCode(code)
    if (value.length < 3) return
    setPending(true)
    const { data, error } = await createClient().rpc('redeem_promo_code', { p_code: value })
    setPending(false)
    if (error) {
      const key = Object.keys(PROMO_ERROR_MESSAGES).find((name) => error.message.includes(name))
      toast.error(key ? PROMO_ERROR_MESSAGES[key] : 'Nie udało się użyć kodu. Spróbuj ponownie.')
      return
    }
    const result = data as PromoRedeemResult
    const summary = promoRewardSummary({ reward_type: result.type, points: result.points, product_name: result.productName, discount_value: Number(result.discountValue) })
    if (result.type === 'points') {
      toast.success(`Kod aktywowany: ${summary}`)
    } else {
      toast.success(`Kod aktywowany: ${summary}`, { description: `Twój kupon ${result.code} czeka w „Aktywne kupony”.` })
      void mutate(ACTIVE_COUPONS_KEY)
    }
    setCode('')
    onRedeemed(result, value)
  }

  return (
    <section aria-labelledby="club-promo-title" className={`p-4 sm:p-5 ${cardClass}`}>
      <h2 id="club-promo-title" className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.08em] sm:text-base">
        <TicketPercent className="size-4 text-primary sm:size-5" aria-hidden="true" />
        Masz kod promocyjny?
      </h2>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <label htmlFor="club-promo-input" className="sr-only">Kod promocyjny</label>
        <input
          id="club-promo-input"
          value={code}
          onChange={(event) => setCode(normalizePromoCode(event.target.value))}
          placeholder="Wpisz kod"
          autoComplete="off"
          autoCapitalize="characters"
          className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 font-mono text-sm font-bold uppercase tracking-wider outline-none transition placeholder:font-sans placeholder:font-normal placeholder:normal-case placeholder:tracking-normal focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          disabled={pending || code.length < 3}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:brightness-105 disabled:opacity-50"
        >
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          Aktywuj
        </button>
      </form>
    </section>
  )
}
