import { describe, expect, it } from 'vitest'
import { compareKitchenOrders } from '../components/warsztat/order-data'
import type { KitchenOrder } from '../components/warsztat/order-data'

const order = (fields: Partial<KitchenOrder>) => ({ items: [], status: 'preparing', ...fields }) as unknown as KitchenOrder
const sortIds = (orders: KitchenOrder[]) => [...orders].sort(compareKitchenOrders).map((item) => item.id)

describe('kitchen queue order', () => {
  it('sorts scheduled orders by pickup/delivery time and keeps the result stable', () => {
    const pickup = order({ id: '#1583', type: 'Odbiór osobisty', scheduledFor: '2026-11-11T17:15:00+00:00' })
    const delivery = order({ id: '#1581', type: 'Dostawa', scheduledFor: '2026-11-11T17:30:00+00:00' })
    expect(sortIds([pickup, delivery])).toEqual(['#1583', '#1581'])
    expect(sortIds([delivery, pickup])).toEqual(['#1583', '#1581'])
  })

  it('sorts other orders oldest first regardless of type', () => {
    const delivery = order({ id: '#1590', type: 'Dostawa', receivedAt: '2026-11-11T17:00:00Z' })
    const dineIn = order({ id: '#1591', type: 'Stacjonarnie', receivedAt: '2026-11-11T17:05:00Z' })
    expect(sortIds([dineIn, delivery])).toEqual(['#1590', '#1591'])
  })

  it('places a scheduled order by its pickup time among orders by arrival time', () => {
    const scheduled = order({ id: '#1581', type: 'Odbiór osobisty', receivedAt: '2026-11-11T16:48:07Z', scheduledFor: '2026-11-11T17:15:00+00:00' })
    const earlier = order({ id: '#1582', type: 'Stacjonarnie', receivedAt: '2026-11-11T17:10:00Z' })
    const later = order({ id: '#1583', type: 'Stacjonarnie', receivedAt: '2026-11-11T17:20:00Z' })
    expect(sortIds([later, scheduled, earlier])).toEqual(['#1582', '#1581', '#1583'])
  })

  it('breaks exact ties by the lower order number', () => {
    const a = order({ id: '#1601', type: 'Dostawa', receivedAt: '2026-11-11T17:00:00Z' })
    const b = order({ id: '#1600', type: 'Stacjonarnie', receivedAt: '2026-11-11T17:00:00Z' })
    expect(sortIds([a, b])).toEqual(['#1600', '#1601'])
  })
})
