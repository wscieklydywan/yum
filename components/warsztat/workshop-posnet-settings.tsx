'use client'

import { useEffect, useId, useState } from 'react'
import { ChevronDown, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PosnetPrinter, useNativeAndroid } from '@/lib/native-posnet'
import { toastPrinterError } from './workshop-daily-fiscal-report'

type Configuration = { host: string; port: number; configured: boolean; setupComplete: boolean }
type ConnectionTest = { pcPort: number; vatRates: Record<string, string> }

const inputClass = 'h-11 rounded-lg border border-[#e5ded6] bg-white px-3 text-sm font-normal text-[#201d1a] outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30'

export function WorkshopPosnetSettings({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const native = useNativeAndroid()
  const panelId = useId()
  const [open, setOpen] = useState(defaultOpen)
  const [configuration, setConfiguration] = useState<Configuration | null>(null)
  const [host, setHost] = useState('')
  const [port, setPort] = useState('')
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [printingTest, setPrintingTest] = useState(false)
  const [testResult, setTestResult] = useState<ConnectionTest | null>(null)

  useEffect(() => {
    if (!native) return
    let mounted = true
    void PosnetPrinter.getConfiguration().then((saved) => {
      if (!mounted) return
      setConfiguration(saved)
      setHost(saved.host)
      setPort(saved.port ? String(saved.port) : '')
    }).catch((error: unknown) => {
      if (mounted) toast.error(error instanceof Error ? error.message : 'Nie udało się odczytać ustawień drukarki.')
    })
    return () => { mounted = false }
  }, [native])

  function validPort() {
    const portNumber = Number(port)
    if (!host.trim() || !Number.isInteger(portNumber) || portNumber < 1024 || portNumber > 49151) {
      toast.error('Wpisz adres drukarki i poprawny port (1024–49151).')
      return null
    }
    return portNumber
  }

  async function testConnection() {
    if (printingTest) return
    const portNumber = validPort()
    if (portNumber === null) return
    setTesting(true)
    setTestResult(null)
    try {
      const result = await PosnetPrinter.testConnection({ host: host.trim(), port: portNumber })
      setTestResult(result)
      toast.success('Połączenie z POSNET działa.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się połączyć z POSNET.')
    } finally {
      setTesting(false)
    }
  }

  async function printTestPage() {
    if (printingTest || testing || saving) return
    setPrintingTest(true)
    try {
      await PosnetPrinter.printTestPage()
      toast.success('Wydruk testowy POSNET został potwierdzony.')
    } catch (error) {
      toastPrinterError(error, 'Nie udało się wykonać testowego wydruku.')
    } finally {
      setPrintingTest(false)
    }
  }

  async function saveConfiguration() {
    if (printingTest) return
    const portNumber = validPort()
    if (portNumber === null) return
    setSaving(true)
    try {
      await PosnetPrinter.saveConfiguration({ host: host.trim(), port: portNumber })
      setConfiguration({ host: host.trim(), port: portNumber, configured: true, setupComplete: true })
      window.dispatchEvent(new Event('posnet-configuration-changed'))
      toast.success('Zapisano ustawienia drukarki na tym tablecie.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się zapisać ustawień drukarki.')
    } finally {
      setSaving(false)
    }
  }

  if (!native) return null

  const configured = configuration?.configured
  const busy = testing || saving || printingTest

  return (
      <section className="overflow-hidden bg-white">
        <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-[#fcfaf7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f3efea] text-[#5f5852]"><Printer className="size-[18px]" aria-hidden="true" /></span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-bold text-[#2b2622]">Drukarka fiskalna POSNET</span>
            <span className="truncate text-[13px] text-[#847c74]">{configured ? `${configuration.host}:${configuration.port}` : 'Nie skonfigurowano'}</span>
          </span>
          <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold sm:inline-block ${configured ? 'bg-emerald-50 text-emerald-700' : 'bg-[#f3efea] text-[#716a63]'}`}>{configured ? 'Połączona' : 'Brak'}</span>
          <ChevronDown className={`size-5 shrink-0 text-[#8b827a] transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {open && <div id={panelId} className="flex flex-col gap-4 border-t border-[#f0ece7] p-4 sm:p-5">
          <p className="text-[13px] leading-relaxed text-[#847c74]">Ustawienia są zapisywane lokalnie na tym tablecie. Drukarka musi być w tej samej sieci lokalnej.</p>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[#48423d]">
              Adres IP drukarki
              <input value={host} onChange={(event) => { setHost(event.target.value); setTestResult(null) }} placeholder="np. 192.168.1.50" autoCapitalize="none" autoCorrect="off" inputMode="url" className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[#48423d]">
              Port TCP/IP
              <input value={port} onChange={(event) => { setPort(event.target.value.replace(/\D/g, '')); setTestResult(null) }} type="number" min={1024} max={49151} placeholder="np. 9100" inputMode="numeric" className={inputClass} />
            </label>
          </div>
          <p className="-mt-2 text-xs text-[#9a928a]">Port musi zgadzać się z portem PC1 ustawionym na drukarce. Nie wpisuj przykładowej wartości, jeśli nie została sprawdzona w jej menu.</p>
          {testResult && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Połączenie OK · PC1 POSNET/TCP-IP · port {testResult.pcPort} · PTU: {Object.entries(testResult.vatRates).map(([slot, rate]) => `${slot.slice(1)} ${rate}%`).join(', ')}
          </p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void saveConfiguration()} disabled={busy}>{saving ? 'Zapisywanie…' : 'Zapisz ustawienia'}</Button>
            <Button variant="outline" onClick={() => void testConnection()} disabled={busy}>{testing ? 'Testowanie…' : 'Testuj połączenie'}</Button>
            {configured && <Button variant="outline" onClick={() => void printTestPage()} disabled={busy}>{printingTest ? 'Drukowanie…' : 'Testuj wydruk niefiskalny'}</Button>}
          </div>
        </div>}
      </section>
  )
}
