'use client'

import type { ClubMember } from './workshop-club-order-field'
import type { WorkshopCodePreview } from './workshop-code'
import type { LineSelection } from './workshop-line-configurator'
import type { KitchenOrder, OrderSource, OrderType } from './order-data'
import type { DatabaseOrder } from './order-rows'
import type { PackagingCounts } from '@/lib/packaging'

/** Everything typed into the „Nowe zamówienie” form, so a failed save can be reopened exactly as it was. */
export type OrderDraft = {
  clientRequestId: string
  source: Exclude<OrderSource, 'yummy'>
  type: OrderType
  customer: string
  phone: string
  address: string
  externalNumber: string
  note: string
  lines: ({ key: number; productId: string; quantity: number; note: string } & Partial<LineSelection>)[]
  packagingAdjust: PackagingCounts
  code: WorkshopCodePreview | null
  clubMember: ClubMember | null
  when: 'asap' | 'scheduled'
  time: string
  dayOffset: number
}

export type PendingOrder = {
  clientRequestId: string
  payload: Record<string, unknown> & { clientRequestId: string; payNow?: boolean }
  draft: OrderDraft
  /** Built in the browser so the payment dialog can open before the server answers. */
  provisional: KitchenOrder
  createdAt: number
}

export type CreatedOrder = { orderId: string; orderNumber: number; clubPoints?: number | null; order?: DatabaseOrder; duplicate?: boolean }
export type SaveResult = { ok: true; data: CreatedOrder } | { ok: false; error: string; retryable: boolean }

const STORAGE_KEY = 'yummy:workshop:pending-orders'
const MAX_AGE = 3 * 86_400_000

export function newRequestId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (char) => (Number(char) ^ (Math.random() * 16 >> (Number(char) / 4))).toString(16))
}

export function readPendingOrders(): PendingOrder[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as PendingOrder[]
    return Array.isArray(parsed) ? parsed.filter((entry) => entry?.clientRequestId && Date.now() - entry.createdAt < MAX_AGE) : []
  } catch {
    return []
  }
}

function writePendingOrders(entries: PendingOrder[]) {
  try {
    if (entries.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage full or blocked (private mode): the in-memory flow still works, only the crash backup is lost.
  }
}

export function savePendingOrder(entry: PendingOrder) {
  writePendingOrders([...readPendingOrders().filter((item) => item.clientRequestId !== entry.clientRequestId), entry])
}

export function removePendingOrder(clientRequestId: string) {
  writePendingOrders(readPendingOrders().filter((item) => item.clientRequestId !== clientRequestId))
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Sends the order with a few retries. Safe to repeat: the server dedupes by clientRequestId,
 * so a request that reached the database but lost its response returns the same order.
 */
export async function postOrder(payload: PendingOrder['payload'], attempts = 3): Promise<SaveResult> {
  let lastError = 'Brak połączenia z serwerem.'
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await wait(attempt * 1200)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    const response = await fetch('/api/workshop/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).catch(() => null)
    clearTimeout(timeout)
    const result = (await response?.json().catch(() => null)) as (CreatedOrder & { error?: string }) | null
    if (response?.ok && result?.orderId) return { ok: true, data: result }
    lastError = result?.error ?? (response ? 'Nie udało się zapisać zamówienia.' : 'Brak połączenia z serwerem.')
    // 4xx means the order itself needs fixing (e.g. used code); retrying the same body would fail the same way.
    if (response && response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
      return { ok: false, error: lastError, retryable: false }
    }
  }
  return { ok: false, error: lastError, retryable: true }
}
