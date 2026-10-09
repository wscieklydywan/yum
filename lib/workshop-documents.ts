import 'server-only'
import { NextResponse } from 'next/server'
import type { OrderItem } from '@/components/warsztat/order-data'
import type { FiscalReceipt, ReceiptSource } from '@/lib/fiscal-receipt'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export type DocumentStatus = 'pending' | 'printed' | 'void'
export type DocumentResponse = { document: FiscalReceipt; status: DocumentStatus; resumed?: boolean }

export async function requireCashier() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Zaloguj się ponownie.' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!['admin', 'szef', 'kelner'].includes(profile?.role ?? '')) return { error: NextResponse.json({ error: 'Paragony i zwroty obsługuje bar.' }, { status: 403 }) }
  return { userId: user.id, admin: createAdminClient() }
}

export type OrderRow = { id: string; number: number; status: string; items: OrderItem[]; discount: number | string | null; delivery_fee: number | string | null }

export const toReceiptSource = (row: OrderRow): ReceiptSource => ({
  id: `#${row.number}`,
  databaseId: row.id,
  items: row.items,
  discount: Number(row.discount ?? 0),
  deliveryFee: Number(row.delivery_fee ?? 0),
})

/** Applies a per-item delta to the receipted/refunded counters, keyed by item id. */
export function adjustItems(items: OrderItem[], document: FiscalReceipt, direction: 1 | -1): OrderItem[] {
  const field = document.kind === 'refund' ? 'refunded' : 'receipted'
  const deltas = new Map<string, number>()
  for (const line of document.lines) if (line.itemId) deltas.set(line.itemId, (deltas.get(line.itemId) ?? 0) + line.quantity)
  return items.map((item) => {
    const delta = item.id ? deltas.get(item.id) : undefined
    if (!delta) return item
    return { ...item, [field]: Math.max(0, (item[field] ?? 0) + delta * direction) }
  })
}

export function dbError(message: string | undefined, fallback: string) {
  const conflict = message?.includes('zmieniło się')
  return NextResponse.json({ error: message && /[ąćęłńóśźż]|Zamówienie|Dokument|Pozycja/i.test(message) ? message : fallback }, { status: conflict ? 409 : 400 })
}
