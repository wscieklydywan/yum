import { cashMethodLabels, type CashReportRecord } from './cash-report-types'
import { receiptSeller } from './fiscal-receipt'

const money = (value: number) => value.toFixed(2).replace('.', ',')
const dateTime = (value: string) => new Date(value).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Warsaw' })
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)

/** Plain-text lines so a fiscal bridge can print the report as a non-fiscal printout. */
export function cashReportLines(report: CashReportRecord): string[] {
  const { summary } = report
  const lines = [
    'RAPORT KASOWY ZMIANY',
    `Od: ${dateTime(report.periodFrom)}`,
    `Do: ${dateTime(report.periodTo)}`,
    '',
    `Zamówienia: ${summary.orders}`,
    `Sprzedaż: ${money(summary.sales)} zł`,
    `Zwroty (${summary.refunds}): -${money(summary.refundsValue)} zł`,
    `Razem netto: ${money(summary.net)} zł`,
    `Rabaty: ${money(summary.discounts)} zł`,
    `Dostawy: ${money(summary.deliveryFees)} zł`,
    `Anulowane (${summary.cancelledOrders}): ${money(summary.cancelledValue)} zł`,
    '',
    'FORMY PŁATNOŚCI',
  ]
  for (const entry of summary.methods) {
    if (entry.orders === 0 && entry.refunds === 0) continue
    lines.push(`${cashMethodLabels[entry.method]}: ${money(entry.net)} zł (${entry.orders} zam.${entry.refunds ? `, zwroty -${money(entry.refundsValue)}` : ''})`)
  }
  if (summary.unassignedOrders > 0) lines.push(`Bez formy płatności (${summary.unassignedOrders}): ${money(summary.unassignedValue)} zł`)
  lines.push(
    '',
    'GOTÓWKA W SZUFLADZIE',
    `Stan początkowy: ${money(report.openingCash)} zł`,
    `Oczekiwana: ${money(report.expectedCash)} zł`,
    `Policzona: ${money(report.countedCash)} zł`,
    `Różnica: ${report.difference > 0 ? '+' : ''}${money(report.difference)} zł`,
  )
  if (report.note) lines.push('', `Uwagi: ${report.note}`)
  lines.push('', `Wydrukowano: ${dateTime(new Date().toISOString())}`)
  return lines
}

function renderHtml(report: CashReportRecord) {
  const body = cashReportLines(report).map((line) => line ? `<div>${escapeHtml(line)}</div>` : '<hr>').join('')
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Raport kasowy</title><style>
@page{size:80mm auto;margin:4mm}body{font:12px/1.45 ui-monospace,Menlo,monospace;color:#000;margin:0}
header{text-align:center;margin-bottom:6px}div:first-child{font-weight:700}hr{border:0;border-top:1px dashed #000;margin:6px 0}
.sign{margin-top:28px;border-top:1px solid #000;text-align:center;font-size:10px;padding-top:2px}
</style></head><body><header><strong>${escapeHtml(receiptSeller.name)}</strong><br>${escapeHtml(receiptSeller.address)}</header>${body}<div class="sign">Podpis osoby rozliczającej</div><p style="text-align:center;font-size:10px">WYDRUK NIEFISKALNY</p></body></html>`
}

function printInBrowser(report: CashReportRecord) {
  return new Promise<void>((resolve, reject) => {
    const frame = document.createElement('iframe')
    frame.title = 'Wydruk raportu kasowego'
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:320px;height:1px;border:0'
    frame.onload = () => {
      const target = frame.contentWindow
      if (!target) { frame.remove(); reject(new Error('Drukowanie jest niedostępne w tej przeglądarce.')); return }
      target.addEventListener('afterprint', () => frame.remove(), { once: true })
      try { target.focus(); target.print(); resolve() } catch { frame.remove(); reject(new Error('Nie udało się otworzyć okna drukowania.')) }
    }
    frame.srcdoc = renderHtml(report)
    document.body.appendChild(frame)
  })
}

const fiscalBridgeUrl = process.env.NEXT_PUBLIC_FISCAL_BRIDGE_URL

/** Prints on the fiscal printer (as a non-fiscal printout) when the bridge is configured, otherwise on the system printer. */
export async function printCashReport(report: CashReportRecord): Promise<'fiscal' | 'browser'> {
  if (!fiscalBridgeUrl) {
    await printInBrowser(report)
    return 'browser'
  }
  let response: Response
  try {
    response = await fetch(`${fiscalBridgeUrl.replace(/\/$/, '')}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `cash-report-${report.id}-${Date.now()}` },
      body: JSON.stringify({ kind: 'cash_report', id: report.id, lines: cashReportLines(report), report }),
    })
  } catch {
    throw new Error('Brak połączenia z kasą fiskalną.')
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Kasa fiskalna odrzuciła wydruk (${response.status}).`)
  }
  return 'fiscal'
}
