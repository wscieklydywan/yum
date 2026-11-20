import { describe, expect, it } from 'vitest'
import { clubPricing } from '../lib/club-pricing'

const freeItemCode = { discountType: null, discountValue: null, items: [{ name: 'Frytki', quantity: 1 }] } as never

describe('clubPricing – loyalty discount', () => {
  it('applies the tier discount alongside a free-item code', () => {
    const pricing = clubPricing({ productsValue: 100, promotionDiscount: 0, code: freeItemCode, tierPercent: 5 })
    expect(pricing.tierAmount).toBe(5)
    expect(pricing.codeSkipped).toBe(false)
    expect(pricing.discount).toBe(5)
  })

  it('counts the tier discount only from regular-price products', () => {
    const pricing = clubPricing({ productsValue: 100, promotionDiscount: 10, regularValue: 60, code: null, tierPercent: 5 })
    expect(pricing.tierAmount).toBe(3)
    expect(pricing.discount).toBe(13)
  })

  it('picks the better of a price code and the tier discount', () => {
    const pricing = clubPricing({ productsValue: 100, promotionDiscount: 0, code: { discountType: 'percent', discountValue: 10, items: [] } as never, tierPercent: 5 })
    expect(pricing.tierAmount).toBe(0)
    expect(pricing.codeAmount).toBe(10)
  })
})
