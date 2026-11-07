import { jsPDF } from 'jspdf'
import autoTable, { type RowInput } from 'jspdf-autotable'
import { cashMethodLabels, type CashReportRecord } from './cash-report-types'
import type { DocumentationDay, DocumentationUser } from './documentation-types'

const FONT = 'Roboto'
const ACCENT: [number, number, number] = [32, 29, 26]
const roleLabels: Record<string, string> = { admin: 'Administrator', szef: 'Szef', kuchnia: 'Kuchnia', kelner: 'Kelner', kierowca: 'Kierowca', kiosk: 'Kiosk', klient: 'Klient' }

let fontCache: Promise<[string, string]> | null = null

function formatVatRate(rate: number) {
  const percent = rate > 1 ? rate : rate * 100
  return `${Number(percent.toFixed(2))}%`
}

async function toBase64(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Nie udało się wczytać czcionki PDF.')
  const bytes = new Uint8Array(await response.arrayBuffer())
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

function loadFonts() {
  fontCache ??= Promise.all([toBase64('/fonts/Roboto-Regular.ttf'), toBase64('/fonts/Roboto-Bold.ttf')]).catch((error) => {
    fontCache = null
    throw error
  })
  return fontCache
}

const money = (value: number | undefined) => `${(value ?? 0).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
const dateTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }) : '—'
const date = (value: string) => new Date(value).toLocaleDateString('pl-PL')

async function createDocument(title: string, subtitle: string, orientation: 'portrait' | 'landscape' = 'portrait') {
  const [regular, bold] = await loadFonts()
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  doc.addFileToVFS('Roboto-Regular.ttf', regular)
  doc.addFont('Roboto-Regular.ttf', FONT, 'normal')
  doc.addFileToVFS('Roboto-Bold.ttf', bold)
  doc.addFont('Roboto-Bold.ttf', FONT, 'bold')
  doc.setFont(FONT, 'bold')
  doc.setFontSize(18)
  doc.text(title, 14, 18)
  doc.setFont(FONT, 'normal')
  doc.setFontSize(10)
  doc.setTextColor(110)
  doc.text(subtitle, 14, 25)
  doc.text(`Wygenerowano: ${new Date().toLocaleString('pl-PL')} · YUMMY`, 14, 30)
  doc.setTextColor(0)
  return doc
}

function table(doc: jsPDF, head: string[], body: RowInput[], startY: number, foot?: RowInput[]) {
  autoTable(doc, {
    head: [head],
    body,
    foot,
    startY,
    styles: { font: FONT, fontSize: 8, cellPadding: 1.8 },
    headStyles: { font: FONT, fontStyle: 'bold', fillColor: ACCENT, textColor: 255 },
    footStyles: { font: FONT, fontStyle: 'bold', fillColor: [241, 237, 231], textColor: ACCENT },
    alternateRowStyles: { fillColor: [250, 248, 245] },
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      const pageSize = doc.internal.pageSize
      doc.setFont(FONT, 'normal')
      doc.setFontSize(8)
      doc.setTextColor(140)
      doc.text(`Strona ${doc.getNumberOfPages()}`, pageSize.getWidth() - 14, pageSize.getHeight() - 8, { align: 'right' })
      doc.setTextColor(0)
    },
  })
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
}

function sectionTitle(doc: jsPDF, text: string, y: number) {
  if (y > doc.internal.pageSize.getHeight() - 30) {
    doc.addPage()
    y = 18
  }
  doc.setFont(FONT, 'bold')
  doc.setFontSize(12)
  doc.text(text, 14, y)
  return y + 4
}

export async function buildFinancialPdf(days: DocumentationDay[], rangeLabel: string) {
  const doc = await createDocument('Raport finansowy', `Okres: ${rangeLabel} · Dni robocze: ${days.length}`, 'landscape')
  const sum = (pick: (day: DocumentationDay) => number | undefined) => days.reduce((total, day) => total + (pick(day) ?? 0), 0)

  let y = sectionTitle(doc, 'Podsumowanie okresu', 40)
  const totalOrders = sum((day) => day.summary.orders)
  const totalRevenue = sum((day) => day.summary.revenue)
  y = table(doc, ['Pozycja', 'Wartość'], [
    ['Zamówienia', String(totalOrders)],
    ['Sprzedaż brutto', money(totalRevenue)],
    ['Zwroty', `${sum((day) => day.summary.refunds)} szt. · ${money(sum((day) => day.summary.refundsValue))}`],
    ['Sprzedaż po zwrotach', money(sum((day) => day.summary.netRevenue))],
    ['Netto (bez VAT)', money(sum((day) => day.summary.net))],
    ['VAT', money(sum((day) => day.summary.tax))],
    ['Rabaty', money(sum((day) => day.summary.discounts))],
    ['Opłaty za dostawę', money(sum((day) => day.summary.deliveryFees))],
    ['Anulowane', `${sum((day) => day.summary.cancelledOrders)} szt. · ${money(sum((day) => day.summary.cancelledValue))}`],
    ['Paragony', `${sum((day) => day.summary.receipts)} szt. · ${money(sum((day) => day.summary.receiptsValue))}`],
    ['Średnia wartość zamówienia', money(totalOrders ? totalRevenue / totalOrders : 0)],
  ], y)

  const vat = new Map<string, { rate: number; gross: number; net: number; tax: number }>()
  for (const day of days) for (const row of day.summary.vat ?? []) {
    const current = vat.get(row.vat) ?? { rate: row.rate, gross: 0, net: 0, tax: 0 }
    vat.set(row.vat, { rate: row.rate, gross: current.gross + row.gross, net: current.net + row.net, tax: current.tax + row.tax })
  }
  if (vat.size) {
    y = sectionTitle(doc, 'Zestawienie VAT', y + 10)
    y = table(doc, ['Stawka', 'Brutto', 'Netto', 'VAT'], [...vat.entries()].sort().map(([letter, row]) => [`${letter} (${formatVatRate(row.rate)})`, money(row.gross), money(row.net), money(row.tax)]), y)
  }

  y = sectionTitle(doc, 'Raporty dzienne', y + 10)
  table(
    doc,
    ['Otwarcie', 'Zamknięcie', 'Zamówienia', 'Wydane', 'Sprzedaż', 'Zwroty', 'Po zwrotach', 'Netto', 'VAT', 'Rabaty', 'Dostawy', 'Anulowane'],
    days.map((day) => [dateTime(day.openedAt), dateTime(day.closedAt), String(day.summary.orders), String(day.summary.handedOff), money(day.summary.revenue), money(day.summary.refundsValue), money(day.summary.netRevenue), money(day.summary.net), money(day.summary.tax), money(day.summary.discounts), money(day.summary.deliveryFees), `${day.summary.cancelledOrders} · ${money(day.summary.cancelledValue)}`]),
    y,
    days.length ? [['Razem', '', String(totalOrders), String(sum((day) => day.summary.handedOff)), money(totalRevenue), money(sum((day) => day.summary.refundsValue)), money(sum((day) => day.summary.netRevenue)), money(sum((day) => day.summary.net)), money(sum((day) => day.summary.tax)), money(sum((day) => day.summary.discounts)), money(sum((day) => day.summary.deliveryFees)), money(sum((day) => day.summary.cancelledValue))]] : undefined,
  )
  return doc
}

export async function buildCashPdf(reports: CashReportRecord[], rangeLabel: string) {
  const doc = await createDocument('Raporty kasowe', `Okres: ${rangeLabel} · Liczba raportów: ${reports.length}`, 'landscape')
  const methodTotal = (report: CashReportRecord, method: keyof typeof cashMethodLabels) => report.summary.methods?.find((item) => item.method === method)?.net ?? 0
  const sum = (pick: (report: CashReportRecord) => number) => reports.reduce((total, report) => total + pick(report), 0)

  let y = sectionTitle(doc, 'Zestawienie raportów', 40)
  y = table(
    doc,
    ['Utworzono', 'Okres od', 'Okres do', 'Zamówienia', 'Sprzedaż netto', 'Gotówka', 'Karta', 'Przelew/BLIK', 'Platformy', 'Stan otw.', 'Oczekiwano', 'Policzono', 'Różnica'],
    reports.map((report) => [dateTime(report.createdAt), dateTime(report.periodFrom), dateTime(report.periodTo), String(report.summary.orders), money(report.summary.net), money(methodTotal(report, 'cash')), money(methodTotal(report, 'card')), money(methodTotal(report, 'transfer')), money(methodTotal(report, 'online')), money(report.openingCash), money(report.expectedCash), money(report.countedCash), money(report.difference)]),
    y,
    reports.length ? [['Razem', '', '', String(sum((report) => report.summary.orders)), money(sum((report) => report.summary.net)), money(sum((report) => methodTotal(report, 'cash'))), money(sum((report) => methodTotal(report, 'card'))), money(sum((report) => methodTotal(report, 'transfer'))), money(sum((report) => methodTotal(report, 'online'))), '', money(sum((report) => report.expectedCash)), money(sum((report) => report.countedCash)), money(sum((report) => report.difference))]] : undefined,
  )

  const movements = reports.flatMap((report) => report.summary.movements ?? [])
  if (movements.length) {
    y = sectionTitle(doc, 'Wpłaty i wypłaty z kasy', y + 10)
    y = table(doc, ['Data', 'Rodzaj', 'Kwota', 'Powód', 'Podpis'], movements.map((movement) => [dateTime(movement.createdAt), movement.kind === 'withdrawal' ? 'Wypłata' : 'Wpłata', money(movement.amount), movement.reason, movement.signedBy]), y)
  }

  const notes = reports.filter((report) => report.note)
  if (notes.length) {
    y = sectionTitle(doc, 'Uwagi do raportów', y + 10)
    table(doc, ['Raport z dnia', 'Uwagi'], notes.map((report) => [dateTime(report.createdAt), report.note ?? '']), y)
  }
  return doc
}

export async function buildUsersPdf(users: DocumentationUser[]) {
  const counts = users.reduce<Record<string, number>>((acc, user) => ({ ...acc, [user.role]: (acc[user.role] ?? 0) + 1 }), {})
  const breakdown = Object.entries(counts).map(([role, count]) => `${roleLabels[role] ?? role}: ${count}`).join(' · ')
  const doc = await createDocument('Baza użytkowników', `Łącznie: ${users.length} · ${breakdown}`, 'landscape')
  table(
    doc,
    ['#', 'E-mail', 'Imię i nazwisko', 'Telefon', 'Rola', 'Punkty', 'Punkty statusu', 'Data rejestracji'],
    users.map((user, index) => [String(index + 1), user.email, user.fullName || '—', user.phone || '—', roleLabels[user.role] ?? user.role, String(user.points), String(user.statusPoints), date(user.createdAt)]),
    40,
  )
  return doc
}
