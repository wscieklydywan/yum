'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle, ChevronDown, Printer, RotateCcw, Unlock } from 'lucide-react'
import { openReceiptRecovery } from './workshop-receipt-recovery'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { hasCachedPosnetFooter, isRealNativeAndroid, parsePosnetFooterResponse, PosnetPrinter, saveFooterToBridge, syncPosnetNonFiscalFooter, useNativeAndroid, type CachedPosnetFooterSettings } from '@/lib/native-posnet'
import {
  buildPosnetNonFiscalCommands,
  commandsToLayout,
  defaultFooterLayout,
  layoutToCommands,
  PARAGON_QR_URL,
  parsePosnetFooterCommands,
  placeLinkUnderQr,
  QR_DEFAULT_SIZE,
  readPosnetFooterPrintOptions,
  renderPosnetFooterTemplate,
  type PosnetFooterCommand,
  type PosnetFooterPrintOptions,
} from '@/lib/posnet-non-fiscal-footer'
import { runDailyFiscalReport, toastPrinterError } from './workshop-daily-fiscal-report'
import { PosnetPaperPreview } from './posnet-paper-preview'
import { PosnetPrinterDiagnostics } from './posnet-printer-diagnostics'
import { PendingNonFiscalFooterNotice, usePendingNonFiscalFooter } from './posnet-non-fiscal-recovery'
import { PosnetFooterEditor, stripIds, withIds, type EditorItem } from './posnet-footer-editor'

const PREVIEW_ORDER_NUMBER = '#1463'

function cachedLayout(cached: CachedPosnetFooterSettings) {
  const commands = parsePosnetFooterCommands(cached.commands) ?? (cached.settings ? buildPosnetNonFiscalCommands(cached.settings) : null)
  return commands ? withIds(commandsToLayout(commands)) : null
}

function previewCommands(commands: PosnetFooterCommand[]): PosnetFooterCommand[] {
  return placeLinkUnderQr(commands).map((command) => {
    if (command.type === 'line') return { ...command, text: renderPosnetFooterTemplate(command.text, PREVIEW_ORDER_NUMBER) }
    if (command.type === 'qr') return { ...command, data: renderPosnetFooterTemplate(command.data, PREVIEW_ORDER_NUMBER) }
    return command
  })
}

type Configuration = { host: string; port: number; configured: boolean; setupComplete: boolean; nonFiscalRecoverySupport?: boolean }
type ConnectionTest = { pcPort: number; vatRates: Record<string, string> }

const inputClass = 'h-11 rounded-lg border border-[#e5ded6] bg-white px-3 text-sm font-normal text-[#201d1a] outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30'

/** Approximate on-paper scale: the 40-column preview is ~216 px wide for ~576 printer dots. */
function FooterQrPreview({ value, moduleSize }: { value: string; moduleSize: number }) {
  const pixels = Math.round(moduleSize * 24)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    if (!value) {
      ref.current?.replaceChildren()
      return
    }

    void import('qr-code-styling').then(({ default: QRCode }) => {
      if (cancelled || !ref.current) return
      ref.current.replaceChildren()
      const code = new QRCode({
        width: pixels,
        height: pixels,
        data: value,
        qrOptions: { errorCorrectionLevel: 'M' },
        dotsOptions: { color: '#201d1a', type: 'square' },
        backgroundOptions: { color: '#ffffff' },
      })
      code.append(ref.current)
    }).catch((error: unknown) => {
      if (!cancelled) toast.error(error instanceof Error ? error.message : 'Nie udało się przygotować podglądu kodu QR.')
    })
    return () => { cancelled = true }
  }, [value, pixels])

  return <div ref={ref} style={{ width: pixels, height: pixels }} className="grid place-items-center overflow-hidden bg-white" role="img" aria-label={`Podgląd kodu QR, rozmiar ${moduleSize} px`} />
}

function PrintOptionSwitch({ label, description, checked, onChange, disabled }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  const id = useId()
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#ece5dd] bg-white p-3">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <label htmlFor={id} className="text-[13px] font-semibold text-[#48423d]">{label}</label>
        <span id={`${id}-description`} className="text-xs leading-relaxed text-[#9a928a]">{description}</span>
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={`${id}-description`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 motion-reduce:transition-none ${checked ? 'bg-primary' : 'bg-[#ddd5cc]'}`}
      >
        <span className={`inline-block size-5 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} aria-hidden="true" />
      </button>
    </div>
  )
}

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
  const [testError, setTestError] = useState<string | null>(null)
  const [layout, setLayout] = useState<EditorItem[]>(() => withIds(defaultFooterLayout()))
  const [printOptions, setPrintOptions] = useState<PosnetFooterPrintOptions>(() => readPosnetFooterPrintOptions(null))
  const [footerLoaded, setFooterLoaded] = useState(false)
  const [footerCached, setFooterCached] = useState(false)
  const [footerCachedAt, setFooterCachedAt] = useState<string | null>(null)
  const [savingFooter, setSavingFooter] = useState(false)
  const [refreshingFooter, setRefreshingFooter] = useState(false)
  const [unlockingQueue, setUnlockingQueue] = useState(false)
  const [closingForm, setClosingForm] = useState(false)
  const footer = usePendingNonFiscalFooter(native && configuration?.configured === true)

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

  useEffect(() => {
    if (!native) return
    let mounted = true
    const load = () => {
      void PosnetPrinter.getNonFiscalFooterSettings().then((cached) => {
        if (!mounted) return
        const loaded = cachedLayout(cached)
        if (loaded) setLayout(loaded)
        setPrintOptions(readPosnetFooterPrintOptions(cached.settings))
        setFooterCached(hasCachedPosnetFooter(cached))
        setFooterCachedAt(cached.cachedAt)
        setFooterLoaded(true)
      }).catch((error: unknown) => {
        if (mounted) toast.error(error instanceof Error ? error.message : 'Nie udało się odczytać lokalnej kopii stopki.')
      })
    }
    load()
    window.addEventListener('posnet-footer-configuration-changed', load)
    return () => {
      mounted = false
      window.removeEventListener('posnet-footer-configuration-changed', load)
    }
  }, [native])

  const built = layoutToCommands(stripIds(layout))
  const printed = built.ok ? previewCommands(built.commands) : null
  const qrCommand = printed?.find((command) => command.type === 'qr')
  const qrValue = qrCommand?.type === 'qr' ? qrCommand.data : ''
  const qrSize = qrCommand?.type === 'qr' ? qrCommand.size ?? QR_DEFAULT_SIZE : QR_DEFAULT_SIZE

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
    setTestError(null)
    try {
      const result = await PosnetPrinter.testConnection({ host: host.trim(), port: portNumber })
      setTestResult(result)
      toast.success('Połączenie z POSNET działa.')
    } catch (error) {
      setTestError(error instanceof Error && error.message ? error.message : 'Nie udało się połączyć z POSNET.')
      toastPrinterError(error, 'Nie udało się połączyć z POSNET.')
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

  async function unlockPrintQueue() {
    if (unlockingQueue) return
    const confirmed = window.confirm('Awaryjnie odblokować kolejkę wydruków?\n\nUżyj tylko, gdy drukarka stoi zablokowana. Zamknięcie otwartej formatki niefiskalnej może wydrukować jej dotychczasową treść. Jeśli poprzedni wydruk faktycznie wyszedł z kasy, kolejny może wydrukować się drugi raz (możliwy duplikat). Najpierw sprawdź papier w drukarce.')
    if (!confirmed) return
    setUnlockingQueue(true)
    try {
  const result = await PosnetPrinter.resetPendingPrintLock()
  if (result?.formStatusKnown === false) {
    toast.warning('Nie odblokowano: kasa zwróciła nieznany stan formatki. Nic nie zostało wyczyszczone. Spróbuj zwykłego wydruku.')
  } else if (result && result.cleared === false) {
    toast.info('Nie było nic do odblokowania. Kolejka wydruków jest wolna.')
  } else {
    toast.success(result?.formClosed
      ? 'Odblokowano kolejkę wydruków i zamknięto otwartą formatkę. Sprawdź wydruk, zanim ponowisz paragon.'
      : 'Odblokowano kolejkę wydruków. Sprawdź wydruk, zanim ponowisz paragon.')
  }
      const cached = await PosnetPrinter.getNonFiscalFooterSettings()
      const loaded = cachedLayout(cached)
      if (loaded) setLayout(loaded)
      setPrintOptions(readPosnetFooterPrintOptions(cached.settings))
      setFooterCached(hasCachedPosnetFooter(cached))
      setFooterCachedAt(cached.cachedAt)
      setFooterLoaded(true)
      window.dispatchEvent(new Event('posnet-footer-configuration-changed'))
      void footer.refresh()
    } catch (error) {
      toastPrinterError(error, 'Nie udało się odblokować kolejki wydruków. Ta funkcja wymaga aplikacji Android w wersji 1.14 lub nowszej.')
    } finally {
      setUnlockingQueue(false)
    }
  }

  async function closeOpenNonFiscalForm() {
    if (closingForm) return
    const confirmed = window.confirm('Zamknąć otwartą formatkę niefiskalną na kasie?\n\nUżyj przy błędzie 2506. Kasa najpierw sprawdzi, czy formatka jest otwarta, i zamknie ją tylko wtedy. Zamknięcie może wydrukować dotychczasową treść formatki.')
    if (!confirmed) return
    setClosingForm(true)
    try {
      await PosnetPrinter.closeNonFiscalForm()
      toast.success('Formatka niefiskalna na kasie jest zamknięta. Możesz drukować paragony.')
      void footer.refresh()
    } catch (error) {
      toastPrinterError(error, 'Nie udało się zamknąć formatki niefiskalnej.')
    } finally {
      setClosingForm(false)
    }
  }

  async function refreshFooterSettings() {
    if (refreshingFooter || savingFooter) return
    setRefreshingFooter(true)
    try {
      const cached = await syncPosnetNonFiscalFooter()
      const loaded = cachedLayout(cached)
      if (!loaded) throw new Error('Pobrana konfiguracja stopki jest nieprawidłowa.')
      setLayout(loaded)
      setPrintOptions(readPosnetFooterPrintOptions(cached.settings))
      setFooterCached(true)
      setFooterCachedAt(cached.cachedAt)
      setFooterLoaded(true)
      toast.success('Pobrano ustawienia z bazy i zaktualizowano lokalną kopię na tym tablecie.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się odświeżyć ustawień stopki.')
    } finally {
      setRefreshingFooter(false)
    }
  }

  async function saveFooterSettings() {
    if (!built.ok || savingFooter) return
    setSavingFooter(true)
    try {
      const response = await fetch('/api/workshop/posnet-footer', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ commands: built.commands, ...printOptions }),
      })
      const data = (await response.json().catch(() => null)) as { settings?: unknown; commands?: unknown; commandsChanged?: boolean; updatedAt?: unknown; error?: string } | null
      if (!response.ok) throw new Error(data?.error || 'Nie udało się zapisać ustawień stopki.')
      let cached = parsePosnetFooterResponse(data)
      await saveFooterToBridge(cached)
      try {
        cached = await syncPosnetNonFiscalFooter()
      } catch {
        toast.warning('Zapisano, ale nie udało się ponownie pobrać stopki z bazy. Tablet używa komend z odpowiedzi zapisu.')
      }
      const saved = cachedLayout(cached)
      if (saved) setLayout(saved)
      setPrintOptions(readPosnetFooterPrintOptions(cached.settings))
      setFooterCached(true)
      setFooterCachedAt(cached.cachedAt)
      window.dispatchEvent(new Event('posnet-footer-configuration-changed'))
      toast.success(data?.commandsChanged === false
        ? 'Układ bez zmian — komendy drukowania pozostały takie same. Odświeżono cache tego tabletu.'
        : 'Zapisano nowe komendy drukowania w bazie i zaktualizowano cache tego tabletu.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się zapisać ustawień stopki.')
    } finally {
      setSavingFooter(false)
    }
  }

  async function saveConfiguration() {
    if (printingTest) return
    const portNumber = validPort()
    if (portNumber === null) return
    setSaving(true)
    try {
      await PosnetPrinter.saveConfiguration({ host: host.trim(), port: portNumber })
      setConfiguration((previous) => ({ ...previous, host: host.trim(), port: portNumber, configured: true, setupComplete: true }))
      window.dispatchEvent(new Event('posnet-configuration-changed'))
      toast.success('Zapisano ustawienia drukarki na tym tablecie.')
    } catch (error) {
      toastPrinterError(error, 'Nie udało się zapisać ustawień drukarki.')
    } finally {
      setSaving(false)
    }
  }

  if (!native) return null

  const configured = configuration?.configured
  const busy = testing || saving || printingTest || savingFooter || refreshingFooter || unlockingQueue || closingForm || footer.retrying

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
              <input value={host} onChange={(event) => { setHost(event.target.value); setTestResult(null); setTestError(null) }} placeholder="np. 192.168.1.50" autoCapitalize="none" autoCorrect="off" inputMode="url" className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[#48423d]">
              Port TCP/IP
              <input value={port} onChange={(event) => { setPort(event.target.value.replace(/\D/g, '')); setTestResult(null); setTestError(null) }} type="number" min={1024} max={49151} placeholder="np. 9100" inputMode="numeric" className={inputClass} />
            </label>
          </div>
          <p className="-mt-2 text-xs text-[#9a928a]">Port musi zgadzać się z portem PC1 ustawionym na drukarce. Nie wpisuj przykładowej wartości, jeśli nie została sprawdzona w jej menu.</p>
          {testResult && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Połączenie OK · PC1 POSNET/TCP-IP · port {testResult.pcPort} · PTU: {Object.entries(testResult.vatRates).map(([slot, rate]) => `${slot.slice(1)} ${rate}%`).join(', ')}
          </p>}
          {testError && !testing && <div role="alert" className="flex flex-col gap-1 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900">
            <p className="font-semibold">Test połączenia nie powiódł się</p>
            <p className="break-words">{testError}</p>
            <p className="text-xs text-red-800">Sprawdź drukarkę i sieć, a potem ponów test — bez restartu aplikacji.</p>
          </div>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void saveConfiguration()} disabled={busy}>{saving ? 'Zapisywanie…' : 'Zapisz ustawienia'}</Button>
            <Button variant="outline" onClick={() => void testConnection()} disabled={busy}>
              {testing ? 'Testowanie…' : testError ? <><RotateCcw data-icon="inline-start" aria-hidden="true" />Ponów test połączenia</> : 'Testuj połączenie'}
            </Button>
            {configured && (footer.pending
              ? <Button variant="outline" onClick={() => void footer.retry()} disabled={busy} className="border-amber-300 text-amber-950 hover:bg-amber-50">
                  <RotateCcw data-icon="inline-start" aria-hidden="true" />{footer.retrying ? 'Ponawianie…' : 'Ponów tylko część niefiskalną'}
                </Button>
              : <Button variant="outline" onClick={() => void printTestPage()} disabled={busy || !footerCached}>{printingTest ? 'Drukowanie…' : 'Testuj wydruk ramki'}</Button>)}
          </div>
          {configured && footer.status && <PendingNonFiscalFooterNotice status={footer.status} />}
          {configured && <PosnetPrinterDiagnostics disabled={busy} />}
          {configured && <div className="flex flex-col gap-2 border-t border-[#f0ece7] pt-4">
            <p className="text-[13px] leading-relaxed text-[#847c74]">Drukarka zablokowana przez nierozliczony paragon? Odzyskaj jego wynik – kasa potwierdzi go bez drukowania drugi raz.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={openReceiptRecovery} disabled={busy}><RotateCcw data-icon="inline-start" aria-hidden="true" />Odzyskaj paragon</Button>
              <Button variant="outline" onClick={() => void runDailyFiscalReport()} disabled={busy}><RotateCcw data-icon="inline-start" aria-hidden="true" />Odzyskaj raport dobowy</Button>
            </div>
            <div className="mt-1 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="flex items-start gap-2 text-xs leading-relaxed text-amber-950">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
                <span>Kolejka wydruków stoi mimo odzyskania paragonu? Awaryjne odzyskanie zwalnia blokadę na tym tablecie i zamyka otwartą formatkę niefiskalną. Uwaga: zamknięcie otwartej formatki może wydrukować jej dotychczasową treść, a jeśli poprzedni wydruk wyszedł z kasy, następny może wydrukować się drugi raz (możliwy duplikat).</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void closeOpenNonFiscalForm()} disabled={busy} className="border-amber-300 bg-white text-amber-950 hover:bg-amber-100">
                  <RotateCcw data-icon="inline-start" aria-hidden="true" />{closingForm ? 'Zamykanie…' : 'Zamknij formatkę (błąd 2506)'}
                </Button>
                <Button variant="outline" onClick={() => void unlockPrintQueue()} disabled={busy} className="border-amber-300 bg-white text-amber-950 hover:bg-amber-100">
                  <Unlock data-icon="inline-start" aria-hidden="true" />{unlockingQueue ? 'Odblokowywanie…' : 'Awaryjnie odblokuj kolejkę wydruków'}
                </Button>
              </div>
            </div>
          </div>}
          <div className="flex flex-col gap-3 border-t border-[#f0ece7] pt-4">
            <div>
              <h3 className="text-sm font-bold text-[#2b2622]">Stopka niefiskalna</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-[#847c74]">Ramka, gratisy, tekst i QR są wspólne dla tabletów. Aplikacja pobiera konfigurację przy uruchomieniu, a każdy wydruk korzysta z lokalnej kopii — bez odpytywania bazy podczas drukowania. Na innym tablecie użyj „Odśwież z bazy”, żeby pobrać późniejsze zmiany.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-[#48423d]">Układ wydruku (od góry)</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setLayout(withIds(defaultFooterLayout()))} disabled={busy}>
                  <RotateCcw data-icon="inline-start" aria-hidden="true" />Przywróć domyślny
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-[#9a928a]">Kolejność, wyrównanie, rozmiar i pogrubienie każdej linii i bloku gratisów oraz rozmiar QR. Rozmiary „Duży szerszy” i „Duży szerszy i wyższy” (maks. 5 zn.) trzeba jeszcze sprawdzić na kasie. Placeholder {"{orderNumber}"} wstawia numer zamówienia. Wyśrodkowanie działa na każdej wersji APK; rozmiar i pogrubienie sprawdź przyciskiem „Testuj wydruk ramki” po zapisaniu.</p>
            </div>
            <div className="flex flex-col gap-2" role="group" aria-label="Opcje wydruku stopki">
              <PrintOptionSwitch
                label="Cięcie między paragonem fiskalnym a stopką"
                description="Kasa odcina paragon fiskalny, a stopka drukuje się na osobnym kawałku papieru."
                checked={printOptions.cutBeforeFooter}
                onChange={(checked) => setPrintOptions((options) => ({ ...options, cutBeforeFooter: checked }))}
                disabled={busy}
              />
              <PrintOptionSwitch
                label="Drukuj formatkę z logo i danymi firmy"
                description="Na początku stopki kasa drukuje zapisany w niej nagłówek z logo i danymi firmy."
                checked={printOptions.printCompanyHeader}
                onChange={(checked) => setPrintOptions((options) => ({ ...options, printCompanyHeader: checked }))}
                disabled={busy}
              />
            </div>
            <PosnetFooterEditor items={layout} onChange={setLayout} errorIndex={built.ok ? undefined : built.index} disabled={busy} />
            {qrValue === PARAGON_QR_URL && <p className="text-xs font-semibold text-emerald-700">Skany QR liczą się w Marketing → Licznik skanowań (kampania „paragon”).</p>}
            {!built.ok && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">{built.error}</p>}
            <div className="rounded-xl border border-[#f0ece7] bg-[#fcfaf7] p-3">
              <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wide text-[#9a928a]">Podgląd papieru · 40 znaków · numer {PREVIEW_ORDER_NUMBER}</p>
              <div className="overflow-x-auto">
                <div className="mx-auto w-fit rounded-sm px-3 shadow-sm ring-1 ring-[#eee7df]">
                  {printed ? (
                    <PosnetPaperPreview commands={printed} printOptions={printOptions} qr={qrValue ? <FooterQrPreview value={qrValue} moduleSize={qrSize} /> : null} />
                  ) : (
                    <p className="w-[40ch] py-6 text-center font-mono text-[9px] text-[#9a928a]">Popraw układ, żeby zobaczyć podgląd.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void saveFooterSettings()} disabled={!footerLoaded || !built.ok || busy}>
                {savingFooter ? 'Zapisywanie…' : 'Zapisz wspólną stopkę'}
              </Button>
              <Button variant="outline" onClick={() => void refreshFooterSettings()} disabled={busy}>
                {refreshingFooter ? 'Pobieranie…' : 'Odśwież z bazy'}
              </Button>
              {!footerLoaded && <span className="text-xs text-[#9a928a]">Wczytywanie lokalnej kopii…</span>}
              {footerLoaded && footerCached && <span className="text-xs text-[#6f6963]">
                Cache na tym tablecie{footerCachedAt ? ` · pobrano ${new Date(footerCachedAt).toLocaleString('pl-PL')}` : ''}
              </span>}
              {footerLoaded && !footerCached && <span className="text-xs font-semibold text-amber-700">Brak lokalnej kopii — odśwież przed wydrukiem.</span>}
            </div>
          </div>
        </div>}
      </section>
  )
}
