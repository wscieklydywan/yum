'use client'

import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { browserReceiptAdapter, defaultReceiptAdapter, type FiscalReceipt, type ReceiptPrinterAdapter, type ReceiptRecoveryStatus } from '@/lib/fiscal-receipt'

type PrinterConfiguration = {
  host: string
  port: number
  configured: boolean
  setupComplete: boolean
  recoverySupport?: boolean
}

type ConnectionTest = {
  pcPort: number
  vatRates: Record<string, string>
}

interface PosnetPrinterPlugin {
  getConfiguration(): Promise<PrinterConfiguration>
  saveConfiguration(options: { host: string; port: number }): Promise<void>
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
}

const nativePosnetPrinter = registerPlugin<PosnetPrinterPlugin>('PosnetPrinter')

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
  getConfiguration: async () => ({ host: '192.168.1.100', port: 6666, configured: true, setupComplete: true, recoverySupport: true }),
  saveConfiguration: async () => simulated('zapisano ustawienia drukarki'),
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
}

export const PosnetPrinter = new Proxy(nativePosnetPrinter, {
  get(target, property, receiver) {
    if (isAndroidPreview() && property in previewPosnetPrinter) return previewPosnetPrinter[property as keyof PosnetPrinterPlugin]
    return Reflect.get(target, property, receiver)
  },
})

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
