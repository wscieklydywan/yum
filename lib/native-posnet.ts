'use client'

import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { browserReceiptAdapter, defaultReceiptAdapter, type FiscalReceipt, type ReceiptPrinterAdapter, type ReceiptRecoveryStatus } from '@/lib/fiscal-receipt'
import { buildPosnetNonFiscalCommands, DEFAULT_POSNET_NON_FISCAL_FOOTER, parsePosnetFooterCommands, parsePosnetNonFiscalFooterSettings, type PosnetFooterCommand, type PosnetNonFiscalFooterSettings } from '@/lib/posnet-non-fiscal-footer'

type PrinterConfiguration = {
  host: string
  port: number
  configured: boolean
  setupComplete: boolean
  recoverySupport?: boolean
  /** APK 1.5+: exposes getPendingNonFiscalFooterStatus() and retryNonFiscalFooter(). Older APKs omit it. */
  nonFiscalRecoverySupport?: boolean
}

/** Result of the native `getPendingNonFiscalFooterStatus()`; extra fields are read defensively. */
export type PendingNonFiscalFooterStatus = { pending: boolean } & Record<string, unknown>

type ConnectionTest = {
  pcPort: number
  vatRates: Record<string, string>
}

export type CachedPosnetFooterSettings = {
  settings: PosnetNonFiscalFooterSettings | null
  /** Ordered print commands from the database; the APK prints them as-is, substituting `{orderNumber}`. Older APKs omit it. */
  commands?: PosnetFooterCommand[] | null
  updatedAt: string | null
  cachedAt: string | null
}

/** True when the tablet has everything the APK needs to print the non-fiscal part. */
export function hasCachedPosnetFooter(cached: CachedPosnetFooterSettings) {
  return !!cached.settings && !!parsePosnetFooterCommands(cached.commands)
}

/** Parses a /api/workshop/posnet-footer response into the shape cached by the APK. */
export function parsePosnetFooterResponse(data: { settings?: unknown; commands?: unknown; updatedAt?: unknown } | null): CachedPosnetFooterSettings {
  const settings = parsePosnetNonFiscalFooterSettings(data?.settings)
  if (!settings) throw new Error('Otrzymano nieprawidłowe wspólne ustawienia stopki.')
  const commands = parsePosnetFooterCommands(data?.commands)
  if (!commands) throw new Error('Otrzymano nieprawidłowe komendy stopki POSNET.')
  return {
    settings,
    commands,
    updatedAt: typeof data?.updatedAt === 'string' ? data.updatedAt : null,
    cachedAt: new Date().toISOString(),
  }
}

/** Raw result of the native `PosnetPrinter.getPrinterStatus()`; read-only, never stored in the database. */
export type PosnetPrinterStatus = {
  mechanismCode: number
  mechanism: string
  deviceCode: number
  device: string
  queueEmpty: boolean
  paperNearEnd: boolean
  transactionOpen: boolean
  checkedAt: string | number
}

interface PosnetPrinterPlugin {
  getConfiguration(): Promise<PrinterConfiguration>
  getPrinterStatus(): Promise<PosnetPrinterStatus>
  saveConfiguration(options: { host: string; port: number }): Promise<void>
  getNonFiscalFooterSettings(): Promise<CachedPosnetFooterSettings>
  saveNonFiscalFooterSettings(options: CachedPosnetFooterSettings): Promise<void>
  completeSetup(): Promise<void>
  testConnection(options: { host: string; port: number }): Promise<ConnectionTest>
  openCashDrawer(): Promise<void>
  printTestPage(): Promise<void>
  printDailyReport(): Promise<{ recovered: boolean }>
  printMonthlyReport(options: { month: string }): Promise<{ month: string; recovered: boolean }>
  printReceipt(options: { receipt: FiscalReceipt }): Promise<{ alreadyPrinted: boolean }>
  getPendingReceiptStatus(options: { receiptId: string }): Promise<({ pending: false } | ({ pending: true } & ReceiptRecoveryStatus))>
  forceRetryReceipt(options: { receipt: FiscalReceipt; confirmedNotPrinted: boolean }): Promise<{ alreadyPrinted: boolean }>
  canVoidDocument(options: { receiptId: string }): Promise<{ allowed: boolean }>
  getPendingNonFiscalFooterStatus(): Promise<PendingNonFiscalFooterStatus>
  retryNonFiscalFooter(): Promise<unknown>
}

const nativePosnetPrinter = registerPlugin<PosnetPrinterPlugin>('PosnetPrinter')
let startupFooterSync: Promise<CachedPosnetFooterSettings> | null = null

export function isRealNativeAndroid() {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

const ANDROID_PREVIEW_STORAGE_KEY = 'yummy:admin-android-preview'
let androidPreviewEnabled = false
const androidPreviewListeners = new Set<() => void>()

/** Admin-only browser preview of Android-only UI. The dashboard enables it only for the admin role. */
export function isAndroidPreview() {
  return androidPreviewEnabled && !isRealNativeAndroid()
}

export function isNativeAndroid() {
  return isRealNativeAndroid() || isAndroidPreview()
}

export function readStoredAndroidPreview() {
  try { return window.localStorage.getItem(ANDROID_PREVIEW_STORAGE_KEY) === '1' } catch { return false }
}

export function setAndroidPreview(enabled: boolean, persist = false) {
  if (persist) {
    try {
      if (enabled) window.localStorage.setItem(ANDROID_PREVIEW_STORAGE_KEY, '1')
      else window.localStorage.removeItem(ANDROID_PREVIEW_STORAGE_KEY)
    } catch {}
  }
  if (androidPreviewEnabled === enabled) return
  androidPreviewEnabled = enabled
  androidPreviewListeners.forEach((listener) => listener())
}

function subscribeAndroidPreview(listener: () => void) {
  androidPreviewListeners.add(listener)
  return () => { androidPreviewListeners.delete(listener) }
}

export function useNativeAndroid() {
  return useSyncExternalStore(subscribeAndroidPreview, isNativeAndroid, () => false)
}

export function useAndroidPreview() {
  return useSyncExternalStore(subscribeAndroidPreview, isAndroidPreview, () => false)
}

function simulated(action: string) {
  toast.info(`Podgląd Android: ${action}`, { description: 'Symulacja – nic nie zostało wysłane do drukarki.' })
}

const notSimulated = () => Promise.reject(new Error('Podgląd Android: paragony fiskalne nie są symulowane.'))

const previewPosnetPrinter: PosnetPrinterPlugin = {
  getConfiguration: async () => ({ host: '192.168.1.100', port: 6666, configured: true, setupComplete: true, recoverySupport: true, nonFiscalRecoverySupport: true }),
  getPrinterStatus: async () => {
    simulated('odczyt statusu kasy')
    return { mechanismCode: 0, mechanism: 'Podgląd – mechanizm OK', deviceCode: 0, device: 'Podgląd – urządzenie OK', queueEmpty: true, paperNearEnd: false, transactionOpen: false, checkedAt: new Date().toISOString() }
  },
  saveConfiguration: async () => simulated('zapisano ustawienia drukarki'),
  getNonFiscalFooterSettings: async () => ({ settings: DEFAULT_POSNET_NON_FISCAL_FOOTER, commands: buildPosnetNonFiscalCommands(DEFAULT_POSNET_NON_FISCAL_FOOTER), updatedAt: null, cachedAt: null }),
  saveNonFiscalFooterSettings: async () => simulated('zapisano lokalną kopię stopki'),
  completeSetup: async () => undefined,
  testConnection: async (options) => { simulated(`test połączenia z ${options.host}:${options.port}`); return { pcPort: options.port, vatRates: { A: '23%', B: '8%', C: '5%', D: '0%' } } },
  openCashDrawer: async () => simulated('otwarcie kasetki'),
  printTestPage: async () => simulated('wydruk testowy'),
  printDailyReport: async () => { simulated('raport fiskalny dobowy'); return { recovered: false } },
  printMonthlyReport: async (options) => { simulated(`raport miesięczny ${options.month}`); return { month: options.month, recovered: false } },
  printReceipt: notSimulated,
  getPendingReceiptStatus: async () => ({ pending: false }),
  forceRetryReceipt: notSimulated,
  canVoidDocument: async () => ({ allowed: false }),
  getPendingNonFiscalFooterStatus: async () => ({ pending: false }),
  retryNonFiscalFooter: async () => simulated('ponowienie części niefiskalnej'),
}

export const PosnetPrinter = new Proxy(nativePosnetPrinter, {
  get(target, property, receiver) {
    if (isAndroidPreview() && property in previewPosnetPrinter) return previewPosnetPrinter[property as keyof PosnetPrinterPlugin]
    return Reflect.get(target, property, receiver)
  },
})

export async function syncPosnetNonFiscalFooter(): Promise<CachedPosnetFooterSettings> {
  const response = await fetch('/api/workshop/posnet-footer', { cache: 'no-store' })
  const data = (await response.json().catch(() => null)) as { settings?: unknown; commands?: unknown; updatedAt?: unknown; error?: string } | null
  if (!response.ok) throw new Error(data?.error || 'Nie udało się pobrać wspólnych ustawień stopki z bazy.')

  const cached = parsePosnetFooterResponse(data)
  await PosnetPrinter.saveNonFiscalFooterSettings(cached)
  window.dispatchEvent(new Event('posnet-footer-configuration-changed'))
  return cached
}

export function initializePosnetNonFiscalFooter() {
  if (!startupFooterSync) startupFooterSync = syncPosnetNonFiscalFooter()
  return startupFooterSync
}

const posnetReceiptAdapter: ReceiptPrinterAdapter = {
  id: 'posnet-thermal-xl2-online',
  label: 'POSNET THERMAL XL2 ONLINE',
  fiscal: true,
  async print(receipt) {
    await PosnetPrinter.printReceipt({ receipt })
  },
  async canVoidDocument(receiptId) {
    const result = await PosnetPrinter.canVoidDocument({ receiptId })
    return result.allowed
  },
  async getRecoveryStatus(receiptId) {
    const status = await PosnetPrinter.getPendingReceiptStatus({ receiptId })
    return status.pending ? status : null
  },
  async forceRetryReceipt(receipt) {
    await PosnetPrinter.forceRetryReceipt({ receipt, confirmedNotPrinted: true })
  },
}

export async function getReceiptPrinterAdapter() {
  if (!isRealNativeAndroid()) return defaultReceiptAdapter
  const configuration = await PosnetPrinter.getConfiguration()
  if (!configuration.configured) return browserReceiptAdapter
  if (configuration.recoverySupport) return posnetReceiptAdapter
  return {
    id: posnetReceiptAdapter.id,
    label: posnetReceiptAdapter.label,
    fiscal: posnetReceiptAdapter.fiscal,
    print: posnetReceiptAdapter.print,
    canVoidDocument: posnetReceiptAdapter.canVoidDocument,
  }
}
