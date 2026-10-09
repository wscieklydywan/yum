import type { SupabaseClient } from '@supabase/supabase-js'
import { loadCatalog, type CatalogProduct } from '@/lib/menu-catalog'
import { hasConfigurator, parseSelection, resolveSelection, type MenuSelection } from '@/lib/menu-config'

export const MAX_LINE_QUANTITY = 20

export type PricedItem = { quantity: number; name: string; options?: string; unitPrice: number; station: 'kitchen' | 'cashier' }
type ParsedLine = { productId: string; quantity: number; note: string; selection: MenuSelection }
type Result<T> = { ok: true; value: T } | { ok: false; error: string; status: number }

/** Validates raw order lines from the client and prices them from the server-side catalog. */
type PricedLines = { items: PricedItem[]; productCount: number; products: { product: CatalogProduct; quantity: number }[] }

export async function priceOrderLines(admin: SupabaseClient, rawLines: unknown): Promise<Result<PricedLines>> {
  if (!Array.isArray(rawLines) || rawLines.length > 30) return { ok: false, error: 'Nieprawidłowe pozycje zamówienia.', status: 400 }
  const quantities = new Map<string, number>()
  const lines: ParsedLine[] = []
  for (const line of rawLines as { productId?: unknown; quantity?: unknown; note?: unknown; selection?: unknown }[]) {
    if (typeof line?.productId !== 'string' || !Number.isInteger(line.quantity) || (line.quantity as number) < 1) {
      return { ok: false, error: 'Nieprawidłowa pozycja zamówienia.', status: 400 }
    }
    const quantity = line.quantity as number
    const total = (quantities.get(line.productId) ?? 0) + quantity
    if (total > MAX_LINE_QUANTITY) return { ok: false, error: `Limit jednej pozycji to ${MAX_LINE_QUANTITY} sztuk.`, status: 400 }
    quantities.set(line.productId, total)
    const selection = parseSelection(line.selection)
    if (!selection) return { ok: false, error: 'Nieprawidłowe opcje produktu.', status: 400 }
    const note = typeof line.note === 'string' ? line.note.trim().slice(0, 200) : ''
    lines.push({ productId: line.productId, quantity, note, selection })
  }
  if (!quantities.size) return { ok: true, value: { items: [], productCount: 0, products: [] } }

  const products = await loadCatalog(admin, [...quantities.keys()])
  if (!products || products.length !== quantities.size) return { ok: false, error: 'Niektóre dania nie istnieją w menu.', status: 409 }

  const items: PricedItem[] = []
  for (const line of lines) {
    const product = products.find((entry) => entry.id === line.productId)!
    if (!hasConfigurator(product)) {
      items.push({ quantity: line.quantity, name: product.name, ...(line.note ? { options: line.note } : {}), unitPrice: Number(product.price), station: product.station })
      continue
    }
    const resolved = resolveSelection(product, line.selection)
    if (!resolved.ok) return { ok: false, error: `${product.name}: ${resolved.error}`, status: 409 }
    const options = [...resolved.baseDetails, line.note].filter(Boolean).join(', ')
    items.push({ quantity: line.quantity, name: product.name, ...(options ? { options } : {}), unitPrice: resolved.baseUnitPrice, station: product.station })
    for (const extra of resolved.separateLines) items.push({ quantity: line.quantity, name: extra.name, unitPrice: extra.unitPrice, station: extra.station })
  }
  const lineProducts = lines.map((line) => ({ product: products.find((entry) => entry.id === line.productId)!, quantity: line.quantity }))
  return { ok: true, value: { items, productCount: quantities.size, products: lineProducts } }
}
