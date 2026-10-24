import type { KitchenOrder, OrderItem } from '@/components/warsztat/order-data'
import { FOOD_VAT, isVatLetter, SERVICE_VAT, STANDALONE_PACKAGING_VAT, VAT_RATES, type VatLetter } from './vat'

export { VAT_RATES, type VatLetter } from './vat'

export type PaymentMethod = 'cash' | 'card' | 'transfer'
export const paymentLabels: Record<PaymentMethod, string> = { cash: 'Gotówka', card: 'Karta', transfer: 'Przelew / BLIK' }

/** One part of a split bill; amount in grosze. */
export type PaymentPart = { method: PaymentMethod; amount: number }

export const receiptSeller = {
  name: process.env.NEXT_PUBLIC_RECEIPT_SELLER_NAME || 'YUMMY',
  address: process.env.NEXT_PUBLIC_RECEIPT_SELLER_ADDRESS || 'ul. Generała Władysława Andersa 7, 44-270 Rybnik',
  nip: process.env.NEXT_PUBLIC_RECEIPT_SELLER_NIP || '',
}

export type ReceiptLine = {
  /** Order item this line fiscalizes; absent for the delivery fee and extra VAT parts of a split item. */
  itemId?: string
  /** Units of the order item this line covers when it differs from `quantity` (an item split across VAT rates). */
  units?: number
  name: string
  quantity: number
  /** Gross unit price in grosze. */
  unitPrice: number
  /** Gross line total in grosze. */
  total: number
  vat: VatLetter
  /** PTU percent of `vat`; the fiscal bridge matches the printer's PTU slot by this value. */
  vatRate: number
}

export type VatSummary = { vat: VatLetter; rate: number; gross: number; tax: number }

/** Device-agnostic receipt payload. Amounts are integers in grosze so fiscal drivers never see float rounding. */
export type FiscalReceipt = {
  version: 1
  /** "refund" is a return protocol (protokół zwrotu) for units from an earlier receipt. */
  kind: 'receipt' | 'refund'
  /** Unique document id issued by the server — fiscal bridges must use it as an idempotency key so a retry never prints twice. */
  id: string
  /** A follow-up receipt for items added after the first receipt was printed. */
  supplement?: boolean
  reason?: string
  orderNumber: string
  issuedAt: string
  currency: 'PLN'
  lines: ReceiptLine[]
  discount: number
  vatSummary: VatSummary[]
  totalTax: number
  total: number
  /** Main method (the largest part for a split bill), kept for drivers that only support one. */
  payment: PaymentMethod
  /** Split bill: every method with its amount; sums to `total`. */
  payments?: PaymentPart[]
  buyerNip?: string
  /** Cash tendered on a paid cash receipt; the fiscal printer calculates change. */
  cashReceived?: number
}

export type ReceiptDraft = { receipt: FiscalReceipt; issues: string[] }

const toGrosze = (value: unknown) => {
  const number = typeof value === 'string' ? Number(value) : value
  return typeof number === 'number' && Number.isFinite(number) ? Math.round(number * 100) : null
}

export const formatMoney = (grosze: number) => (grosze / 100).toFixed(2).replace('.', ',')

export function isValidNip(value: string) {
  const digits = value.replace(/[\s-]/g, '')
  if (!/^\d{10}$/.test(digits)) return false
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7]
  const sum = weights.reduce((total, weight, index) => total + weight * Number(digits[index]), 0)
  return sum % 11 === Number(digits[9])
}

export type ReceiptSource = Pick<KitchenOrder, 'id' | 'databaseId' | 'items' | 'discount' | 'deliveryFee'>

/** A menu item without a stored rate is reported, never guessed. Only legacy packaging lines fall back to the service rate. */
const itemVat = (item: OrderItem): VatLetter | null => (isVatLetter(item.vat) ? item.vat : item.packaging ? SERVICE_VAT : null)
const missingVat = (item: OrderItem) => `Brak stawki VAT: ${item.name} – ustaw ją w edycji pozycji lub w menu.`
const receiptLine = (item: OrderItem, quantity: number, unitPrice: number, vat: VatLetter): ReceiptLine =>
  ({ itemId: item.id, name: itemLabel(item), quantity, unitPrice, total: unitPrice * quantity, vat, vatRate: VAT_RATES[vat] })
/** POSNET printers reject longer item names; menu names are capped at this length too. */
export const MAX_RECEIPT_NAME = 40
/** Options stay in the receipt name only while it fits; otherwise the bare product name is used. */
export function itemLabel(item: Pick<OrderItem, 'name' | 'options'>) {
  const name = Array.from(item.name.trim()).slice(0, MAX_RECEIPT_NAME).join('').trim()
  const withOptions = item.options ? `${name} (${item.options})` : name
  return Array.from(withOptions).length <= MAX_RECEIPT_NAME ? withOptions : name
}

function summarize(lines: ReceiptLine[], requestedDiscount: number) {
  const gross = lines.reduce((sum, line) => sum + line.total, 0)
  const discount = Math.min(Math.max(requestedDiscount, 0), gross)
  const groups = new Map<VatLetter, number>()
  for (const line of lines) groups.set(line.vat, (groups.get(line.vat) ?? 0) + line.total)
  const letters = [...groups.keys()].sort()
  let discountLeft = discount
  const vatSummary = letters.map((vat, index) => {
    const groupGross = groups.get(vat)!
    const share = index === letters.length - 1 ? discountLeft : Math.round((discount * groupGross) / gross)
    discountLeft -= share
    const net = groupGross - share
    const rate = VAT_RATES[vat]
    return { vat, rate, gross: net, tax: Math.round((net * rate) / (100 + rate)) }
  })
  return { discount, vatSummary, totalTax: vatSummary.reduce((sum, group) => sum + group.tax, 0), total: gross - discount }
}

type VatWeights = [VatLetter, number][]

/** Gross value of the order's products per VAT letter (packaging excluded) — the basis for packaging and delivery VAT. */
export function productVatWeights(items: OrderItem[]): VatWeights {
  const groups = new Map<VatLetter, number>()
  for (const item of items) {
    if (item.cancelled || item.packaging || !isVatLetter(item.vat)) continue
    const gross = (toGrosze(item.unitPrice) ?? 0) * item.quantity
    if (gross > 0) groups.set(item.vat, (groups.get(item.vat) ?? 0) + gross)
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
}

/**
 * All packaging (containers, foil and the bag) sold with products is 8%; packaging with no product
 * in the order is sold on its own at 23%. Delivery is split proportionally across the order's product rates.
 */
export function serviceVatWeights(weights: VatWeights, packaging?: OrderItem['packaging']): VatWeights {
  if (weights.length === 0) return [[STANDALONE_PACKAGING_VAT, 1]]
  if (packaging) return [[FOOD_VAT, 1]]
  return weights
}

/** Splits an amount in grosze across VAT letters by weight; the last part takes the rounding remainder. */
export function allocateByVat(amount: number, weights: VatWeights): [VatLetter, number][] {
  const totalWeight = weights.reduce((sum, [, weight]) => sum + weight, 0)
  let left = amount
  return weights
    .map(([vat, weight], index): [VatLetter, number] => {
      const part = index === weights.length - 1 ? left : Math.round((amount * weight) / totalWeight)
      left -= part
      return [vat, part]
    })
    .filter(([, part]) => part > 0)
}

function serviceLines(name: string, quantity: number, unitPrice: number, weights: VatWeights, itemId?: string): ReceiptLine[] {
  if (weights.length === 1) {
    const vat = weights[0][0]
    return [{ ...(itemId ? { itemId } : {}), name, quantity, unitPrice, total: unitPrice * quantity, vat, vatRate: VAT_RATES[vat] }]
  }
  return allocateByVat(unitPrice * quantity, weights).map(([vat, part], index) => ({
    ...(itemId && index === 0 ? { itemId, units: quantity } : {}),
    name,
    quantity: 1,
    unitPrice: part,
    total: part,
    vat,
    vatRate: VAT_RATES[vat],
  }))
}

/** Receipt for every unit that is not on a receipt yet. The first receipt also carries the delivery fee and order discount. */
export function createReceipt(order: ReceiptSource, payment: PaymentMethod, buyerNip?: string, payments?: PaymentPart[] | null): ReceiptDraft {
  const issues: string[] = []
  const lines: ReceiptLine[] = []
  const supplement = order.items.some((item) => (item.receipted ?? 0) > 0)
  const weights = productVatWeights(order.items)
  for (const item of order.items) {
    if (item.cancelled) continue
    const quantity = item.quantity - (item.receipted ?? 0)
    if (quantity <= 0) continue
    const unitPrice = toGrosze(item.unitPrice)
    if (unitPrice === null) {
      issues.push(`Brak ceny: ${item.name}`)
      continue
    }
    // 0 zł set components (e.g. the drink of a burger set) are only for station check-off; fiscal printers reject 0 zł lines.
    if (unitPrice === 0) continue
    if (item.packaging) {
      lines.push(...serviceLines(itemLabel(item), quantity, unitPrice, serviceVatWeights(weights, item.packaging), item.id))
      continue
    }
    const vat = itemVat(item)
    if (!vat) {
      issues.push(missingVat(item))
      continue
    }
    lines.push(receiptLine(item, quantity, unitPrice, vat))
  }
  const deliveryFee = supplement ? 0 : toGrosze(order.deliveryFee) ?? 0
  if (deliveryFee > 0) {
    const delivery = serviceLines('Dostawa', 1, deliveryFee, serviceVatWeights(weights))
    // One-off test for #1245: the printer seems to reject "Dostawa" at 23% because it already knows it at 8%.
    if (order.id === '#1245') for (const line of delivery) if (line.vat === 'A') line.name = 'Dostawa.'
    lines.push(...delivery)
  }

  const summary = summarize(lines, supplement ? 0 : toGrosze(order.discount) ?? 0)
  if (lines.length === 0 && issues.length === 0) issues.push(supplement ? 'Wszystkie pozycje są już na paragonie.' : 'Brak pozycji do zafiskalizowania.')
  else if (lines.length > 0 && summary.total <= 0) issues.push('Suma paragonu musi być większa od zera.')
  const nip = buyerNip?.replace(/[\s-]/g, '')
  if (nip && !isValidNip(nip)) issues.push('Nieprawidłowy NIP nabywcy.')
  const split = payments && payments.length > 1 ? payments : null
  if (split && summary.total > 0 && split.reduce((sum, part) => sum + part.amount, 0) !== summary.total) issues.push('Części płatności muszą sumować się do kwoty paragonu.')

  return {
    issues,
    receipt: {
      version: 1,
      kind: 'receipt',
      id: order.databaseId ?? order.id,
      orderNumber: order.id,
      issuedAt: new Date().toISOString(),
      currency: 'PLN',
      lines,
      ...summary,
      payment: split ? split.reduce((top, part) => (part.amount > top.amount ? part : top)).method : payment,
      ...(split ? { payments: split } : {}),
      ...(supplement ? { supplement: true } : {}),
      ...(nip ? { buyerNip: nip } : {}),
    },
  }
}

export type RefundRequestLine = { itemId: string; quantity: number }

/** Refund for units already on a receipt. Values are reduced by the order discount share the customer actually paid. */
export function createRefund(order: ReceiptSource, requested: RefundRequestLine[], reason: string, payment: PaymentMethod): ReceiptDraft {
  const issues: string[] = []
  const lines: ReceiptLine[] = []
  for (const request of requested) {
    if (!Number.isInteger(request.quantity) || request.quantity <= 0) continue
    const item = order.items.find((entry) => entry.id === request.itemId)
    if (!item) {
      issues.push('Pozycja zwrotu nie istnieje.')
      continue
    }
    const refundable = Math.max(0, (item.receipted ?? 0) - (item.refunded ?? 0))
    if (request.quantity > refundable) {
      issues.push(`${item.name}: do zwrotu zostało ${refundable} szt.`)
      continue
    }
    const unitPrice = toGrosze(item.unitPrice)
    if (unitPrice === null) {
      issues.push(`Brak ceny: ${item.name}`)
      continue
    }
    if (item.packaging) {
      lines.push(...serviceLines(itemLabel(item), request.quantity, unitPrice, serviceVatWeights(productVatWeights(order.items), item.packaging), item.id))
      continue
    }
    const vat = itemVat(item)
    if (!vat) {
      issues.push(missingVat(item))
      continue
    }
    lines.push(receiptLine(item, request.quantity, unitPrice, vat))
  }
  const itemsGross = order.items.filter((item) => !item.cancelled).reduce((sum, item) => sum + (toGrosze(item.unitPrice) ?? 0) * item.quantity, 0)
  const linesGross = lines.reduce((sum, line) => sum + line.total, 0)
  const orderDiscount = toGrosze(order.discount) ?? 0
  const discount = itemsGross > 0 ? Math.round((orderDiscount * linesGross) / itemsGross) : 0
  const summary = summarize(lines, discount)
  const trimmedReason = reason.trim().slice(0, 200)
  if (lines.length === 0 && issues.length === 0) issues.push('Wybierz pozycje do zwrotu.')
  if (trimmedReason.length < 3) issues.push('Podaj powód zwrotu.')

  return {
    issues,
    receipt: {
      version: 1,
      kind: 'refund',
      id: order.databaseId ?? order.id,
      orderNumber: order.id,
      issuedAt: new Date().toISOString(),
      currency: 'PLN',
      lines,
      ...summary,
      payment,
      reason: trimmedReason,
    },
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

export function renderReceiptHtml(receipt: FiscalReceipt, { fiscal }: { fiscal: boolean }) {
  const e = escapeHtml
  const issued = new Date(receipt.issuedAt).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })
  const row = (left: string, right: string, className = '') => `<div class="row${className ? ` ${className}` : ''}"><span>${left}</span><span>${right}</span></div>`
  const refund = receipt.kind === 'refund'
  const title = refund ? 'Protokół zwrotu' : fiscal ? 'Paragon fiskalny' : 'Paragon · niefiskalny'
  const logoUrl = typeof window === 'undefined' ? '/images/yummy-logo-email.png' : `${window.location.origin}/images/yummy-logo-email.png`
  const refundDetails = refund ? `<div class="sep"></div>${row('Powód', e(receipt.reason ?? ''))}${row('Zwrot formą', e(paymentLabels[receipt.payment]))}` : ''
  const signatures = refund ? '<div class="signatures"><div><div class="sign-line"></div>podpis sprzedawcy</div><div><div class="sign-line"></div>podpis klienta</div></div>' : ''
  const styles = `@page{size:80mm auto;margin:4mm 3mm}*{box-sizing:border-box}html,body{margin:0;background:#fff;color:#111}body{max-width:74mm;margin:0 auto;padding:7mm 5mm 9mm;font:12px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;-webkit-print-color-adjust:exact;print-color-adjust:exact}
header,footer{text-align:center}.logo{display:block;width:42mm;max-width:70%;height:auto;margin:0 auto 8px}.seller{font-size:11px;color:#333}.seller strong{display:block;font-size:12px;color:#111;letter-spacing:.06em;text-transform:uppercase}
.badge{display:inline-block;margin:12px 0 0;padding:4px 12px;border-radius:999px;background:#111;color:#fff;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.badge-soft{display:block;margin-top:6px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
.order{margin:14px 0 4px;padding:10px 8px;border:2px solid #111;border-radius:10px;text-align:center}.order-label{font-size:10px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#444}.order-number{font-size:34px;line-height:1.05;font-weight:800;letter-spacing:-.01em}.order-date{margin-top:4px;font-size:10px;color:#444}
.buyer{margin-top:8px;font-size:11px}.sep{border-top:1px dashed #999;margin:12px 0}.row{display:flex;justify-content:space-between;align-items:baseline;gap:10px}.row span:last-child{white-space:nowrap;text-align:right}
.line{padding:5px 0;break-inside:avoid}.line+.line{border-top:1px dotted #ccc}.line-name{font-weight:600;font-size:12.5px}.line .row{font-size:11px;color:#444}.line .row span:last-child{color:#111;font-weight:600;font-size:12px}
.small{font-size:10.5px;color:#444}.strong{font-weight:700;color:#111}.total{margin:12px 0 6px;padding:10px 12px;border-radius:10px;background:#111;color:#fff}.total span:first-child{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}.total span:last-child{font-size:22px;font-weight:800}
.payment{font-size:12px;padding:0 2px}footer{margin-top:4px}.thanks{font-size:16px;font-weight:800;letter-spacing:.02em;margin-top:14px}.muted{font-size:10px;color:#555;margin-top:4px}.note{margin-top:10px;padding:8px;border:1px dashed #999;border-radius:8px;font-size:10px}.note strong{display:block;font-size:11px;letter-spacing:.1em}
.signatures{display:flex;gap:12px;margin-top:28px;font-size:10px;color:#555}.signatures>div{flex:1}.sign-line{border-top:1px solid #111;margin-bottom:4px}`
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Paragon ${e(receipt.orderNumber)}</title><style>${styles}</style></head><body>
<header><img class="logo" src="${logoUrl}" alt="${e(receiptSeller.name)}"><div class="seller"><strong>${e(receiptSeller.name)}</strong>${e(receiptSeller.address)}${receiptSeller.nip ? `<br>NIP ${e(receiptSeller.nip)}` : ''}</div><div class="badge">${title}</div>${receipt.supplement ? '<div class="badge-soft">Dopłata do zamówienia</div>' : ''}
<div class="order"><div class="order-label">Zamówienie</div><div class="order-number">${e(receipt.orderNumber)}</div><div class="order-date">${e(issued)}</div></div>${receipt.buyerNip ? `<div class="buyer">NIP nabywcy: <strong>${e(receipt.buyerNip)}</strong></div>` : ''}</header>
<div class="sep"></div>
${receipt.lines.map((line) => `<div class="line"><div class="line-name">${e(line.name)}</div>${row(`${line.quantity} × ${formatMoney(line.unitPrice)}`, `${formatMoney(line.total)} ${line.vat}`)}</div>`).join('')}
${receipt.discount > 0 ? `<div class="sep"></div>${row('Rabat', `-${formatMoney(receipt.discount)}`, 'strong')}` : ''}
<div class="sep"></div>
${receipt.vatSummary.map((group) => `${row(`Sprzedaż opod. ${group.vat}`, formatMoney(group.gross), 'small')}${row(`PTU ${group.vat} ${group.rate}%`, formatMoney(group.tax), 'small')}`).join('')}
${row('Suma PTU', formatMoney(receipt.totalTax), 'small strong')}
${row(refund ? 'Do zwrotu PLN' : 'Suma PLN', formatMoney(receipt.total), 'total')}
${refund ? refundDetails : receipt.payments?.length ? receipt.payments.map((part) => row(e(paymentLabels[part.method]), formatMoney(part.amount), 'payment')).join('') : row(e(paymentLabels[receipt.payment]), formatMoney(receipt.total), 'payment')}
<footer>${refund ? signatures : fiscal ? '' : '<div class="note"><strong>NIEFISKALNY</strong>Dokument nie jest paragonem fiskalnym.<br>Paragon fiskalny wydaje kasa fiskalna.</div>'}<div class="thanks">Dziękujemy!</div><div class="muted">Smacznego i do zobaczenia w Yummy</div></footer>
</body></html>`
}

export interface ReceiptPrinterAdapter {
  id: string
  label: string
  /** True only for a certified fiscal device; non-fiscal printouts are marked as such. */
  fiscal: boolean
  print: (receipt: FiscalReceipt) => Promise<void>
  canVoidDocument?: (receiptId: string) => Promise<boolean>
  getRecoveryStatus?: (receiptId: string) => Promise<ReceiptRecoveryStatus | null>
  forceRetryReceipt?: (receipt: FiscalReceipt) => Promise<void>
}

export type ReceiptRecoveryStatus = {
  matchesDocument: boolean
  commandId: string
  commandIndex: number
  commandCount: number
  token: string | null
  recoverable: boolean
  fiscalEndMayHaveBeenSent: boolean
}

export const RECEIPT_REQUIRES_POSNET = 'Drukarka fiskalna nie podłączona.'

export const browserReceiptAdapter: ReceiptPrinterAdapter = {
  id: 'browser',
  label: 'Drukarka systemowa (niefiskalna)',
  fiscal: false,
  print(receipt) {
    // A browser print dialog cannot confirm that a fiscal device issued the receipt, so it would be falsely recorded as printed.
    if (receipt.kind === 'receipt') return Promise.reject(new Error(RECEIPT_REQUIRES_POSNET))
    return new Promise((resolve, reject) => {
      const frame = document.createElement('iframe')
      frame.title = `Wydruk paragonu ${receipt.orderNumber}`
      frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:320px;height:1px;border:0'
      const cleanup = () => frame.remove()
      frame.onerror = () => { cleanup(); reject(new Error('Nie udało się przygotować wydruku.')) }
      frame.onload = () => {
        const target = frame.contentWindow
        if (!target) { cleanup(); reject(new Error('Drukowanie jest niedostępne w tej przeglądarce.')); return }
        target.addEventListener('afterprint', cleanup, { once: true })
        try {
          target.focus()
          target.print()
          resolve()
        } catch {
          cleanup()
          reject(new Error('Nie udało się otworzyć okna drukowania.'))
        }
      }
      frame.srcdoc = renderReceiptHtml(receipt, { fiscal: false })
      document.body.appendChild(frame)
    })
  },
}

/** Sends the receipt to a local fiscal-printer bridge (e.g. Posnet/Novitus/Elzab driver) listening on the cashier PC. */
export function createFiscalBridgeAdapter(baseUrl: string): ReceiptPrinterAdapter {
  return {
    id: 'fiscal-bridge',
    label: 'Kasa fiskalna',
    fiscal: true,
    async print(receipt) {
      let response: Response
      try {
        response = await fetch(`${baseUrl.replace(/\/$/, '')}/${receipt.kind === 'refund' ? 'refunds' : 'receipts'}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': receipt.id },
          body: JSON.stringify(receipt),
        })
      } catch {
        throw new Error('Brak połączenia z kasą fiskalną.')
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `Kasa fiskalna odrzuciła paragon (${response.status}).`)
      }
    },
  }
}

const fiscalBridgeUrl = process.env.NEXT_PUBLIC_FISCAL_BRIDGE_URL
export const defaultReceiptAdapter: ReceiptPrinterAdapter = fiscalBridgeUrl ? createFiscalBridgeAdapter(fiscalBridgeUrl) : browserReceiptAdapter
