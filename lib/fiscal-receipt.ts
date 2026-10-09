import type { KitchenOrder, OrderItem } from '@/components/warsztat/order-data'

export const VAT_RATES = { A: 23, B: 8, C: 5, D: 0 } as const
export type VatLetter = keyof typeof VAT_RATES
export const DEFAULT_VAT: VatLetter = 'B'

export type PaymentMethod = 'cash' | 'card' | 'transfer'
export const paymentLabels: Record<PaymentMethod, string> = { cash: 'Gotówka', card: 'Karta', transfer: 'Przelew / online' }

export const receiptSeller = {
  name: process.env.NEXT_PUBLIC_RECEIPT_SELLER_NAME || 'YUMMY',
  address: process.env.NEXT_PUBLIC_RECEIPT_SELLER_ADDRESS || 'ul. Generała Władysława Andersa 7, 44-270 Rybnik',
  nip: process.env.NEXT_PUBLIC_RECEIPT_SELLER_NIP || '',
}

export type ReceiptLine = {
  /** Order item this line fiscalizes; absent for the delivery fee. */
  itemId?: string
  name: string
  quantity: number
  /** Gross unit price in grosze. */
  unitPrice: number
  /** Gross line total in grosze. */
  total: number
  vat: VatLetter
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
  payment: PaymentMethod
  buyerNip?: string
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

const itemVat = (item: OrderItem): VatLetter => (item.vat && item.vat in VAT_RATES ? item.vat : DEFAULT_VAT)
const itemLabel = (item: OrderItem) => (item.options ? `${item.name} (${item.options})` : item.name)

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

/** Receipt for every unit that is not on a receipt yet. The first receipt also carries the delivery fee and order discount. */
export function createReceipt(order: ReceiptSource, payment: PaymentMethod, buyerNip?: string): ReceiptDraft {
  const issues: string[] = []
  const lines: ReceiptLine[] = []
  const supplement = order.items.some((item) => (item.receipted ?? 0) > 0)
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
    lines.push({ itemId: item.id, name: itemLabel(item), quantity, unitPrice, total: unitPrice * quantity, vat: itemVat(item) })
  }
  const deliveryFee = supplement ? 0 : toGrosze(order.deliveryFee) ?? 0
  if (deliveryFee > 0) lines.push({ name: 'Dostawa', quantity: 1, unitPrice: deliveryFee, total: deliveryFee, vat: DEFAULT_VAT })

  const summary = summarize(lines, supplement ? 0 : toGrosze(order.discount) ?? 0)
  if (lines.length === 0 && issues.length === 0) issues.push(supplement ? 'Wszystkie pozycje są już na paragonie.' : 'Brak pozycji do zafiskalizowania.')
  else if (lines.length > 0 && summary.total <= 0) issues.push('Suma paragonu musi być większa od zera.')
  const nip = buyerNip?.replace(/[\s-]/g, '')
  if (nip && !isValidNip(nip)) issues.push('Nieprawidłowy NIP nabywcy.')

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
      payment,
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
    lines.push({ itemId: item.id, name: itemLabel(item), quantity: request.quantity, unitPrice, total: unitPrice * request.quantity, vat: itemVat(item) })
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
${refund ? refundDetails : row(e(paymentLabels[receipt.payment]), formatMoney(receipt.total), 'payment')}
<footer>${refund ? signatures : fiscal ? '' : '<div class="note"><strong>NIEFISKALNY</strong>Dokument nie jest paragonem fiskalnym.<br>Paragon fiskalny wydaje kasa fiskalna.</div>'}<div class="thanks">Dziękujemy!</div><div class="muted">Smacznego i do zobaczenia w Yummy</div></footer>
</body></html>`
}

export interface ReceiptPrinterAdapter {
  id: string
  label: string
  /** True only for a certified fiscal device; non-fiscal printouts are marked as such. */
  fiscal: boolean
  print: (receipt: FiscalReceipt) => Promise<void>
}

export const browserReceiptAdapter: ReceiptPrinterAdapter = {
  id: 'browser',
  label: 'Drukarka systemowa (niefiskalna)',
  fiscal: false,
  print(receipt) {
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
