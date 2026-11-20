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
      toast.success(`Kod aktywowany: ${summary}`, { description: `Twój kupon ${result.code} czeka w Yummy QPON.` })
      void mutate(ACTIVE_COUPONS_KEY)
    }
    setCode('')
    onRedeemed(result, value)
  }

  return (
    <div className={`p-3.5 sm:p-4 ${cardClass}`}>
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <TicketPercent className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 id="club-promo-title" className="text-sm font-extrabold">Masz kod promocyjny?</h3>
          <p className="text-xs text-muted-foreground">Wpisz go i odbierz Stars lub kupon</p>
        </div>
      </div>
      <form
        onSubmit={submit}
        className="mt-3 flex items-center gap-1 rounded-full bg-background p-1 ring-1 ring-border transition-shadow focus-within:ring-2 focus-within:ring-primary"
      >
        <label htmlFor="club-promo-input" className="sr-only">Kod promocyjny</label>
        <input
          id="club-promo-input"
          value={code}
          onChange={(event) => setCode(normalizePromoCode(event.target.value))}
          placeholder="Wpisz kod"
          autoComplete="off"
          autoCapitalize="characters"
          className="h-10 min-w-0 flex-1 rounded-full bg-transparent px-3.5 font-mono text-sm font-bold uppercase tracking-wider outline-none placeholder:font-sans placeholder:font-normal placeholder:normal-case placeholder:tracking-normal"
        />
        <button
          type="submit"
          disabled={pending || code.length < 3}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:bg-muted disabled:text-muted-foreground"
        >
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          Aktywuj
        </button>
      </form>
    </div>
  )
}
