'use client'

import { useEffect, useState } from 'react'
import { LoaderCircle, Printer, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PosnetPrinter, useNativeAndroid } from '@/lib/native-posnet'

export type FiscalReportMode = 'daily' | 'monthly'

/** null = still checking, false = not connected / not Android, true = POSNET configured on this device. */
export function usePosnetConfigured() {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const native = useNativeAndroid()

  useEffect(() => {
    if (!native) {
      setConfigured(false)
      return
    }
    let mounted = true
    const refreshConfiguration = () => {
      void PosnetPrinter.getConfiguration().then((configuration) => {
        if (mounted) setConfigured(configuration.configured)
      }).catch((error: unknown) => {
        if (!mounted) return
        setConfigured(false)
        toast.error(error instanceof Error ? error.message : 'Nie udało się odczytać konfiguracji POSNET.')
      })
    }
    refreshConfiguration()
    window.addEventListener('posnet-configuration-changed', refreshConfiguration)
    return () => {
      mounted = false
      window.removeEventListener('posnet-configuration-changed', refreshConfiguration)
    }
  }, [native])

  return configured
}

export async function runDailyFiscalReport() {
  try {
    const result = await PosnetPrinter.printDailyReport()
    toast.success(result.recovered ? 'Odzyskano potwierdzenie raportu dobowego' : 'POSNET potwierdził raport fiskalny dobowy')
    return true
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Nie udało się wykonać raportu fiskalnego dobowego.')
    return false
  }
}

/** The native plugin blocks printing while a dailyrep result is unconfirmed; re-running dailyrep reads that result back instead of closing the day twice. */
export function toastPrinterError(error: unknown, fallback: string, description?: string) {
  const message = error instanceof Error ? error.message : fallback
  if (/raport dobowy/i.test(message) && /odzyskaj/i.test(message)) {
    toast.error(message, {
      description: 'Jeśli raport już się wydrukował, odzyskaj jego wynik – drukarka potwierdzi go bez zamykania doby drugi raz.',
      duration: 20000,
      action: { label: 'Odzyskaj raport', onClick: () => { void runDailyFiscalReport() } },
    })
    return
  }
  toast.error(message, description ? { description } : undefined)
}

export function WorkshopFiscalReportDialogs({ mode, onModeChange }: { mode: FiscalReportMode | null; onModeChange: (mode: FiscalReportMode | null) => void }) {
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [printing, setPrinting] = useState(false)

  async function printDailyReport() {
    if (printing) return
    setPrinting(true)
    try {
      if (await runDailyFiscalReport()) onModeChange(null)
    } finally {
      setPrinting(false)
    }
  }

  async function printMonthlyReport() {
    if (printing || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      if (!printing) toast.error('Wybierz miesiąc raportu.')
      return
    }
    setPrinting(true)
    try {
      const result = await PosnetPrinter.printMonthlyReport({ month })
      const label = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(new Date(`${result.month}-01T12:00:00`))
      toast.success(result.recovered ? `Odzyskano potwierdzenie raportu za ${label}` : `POSNET potwierdził raport fiskalny za ${label}`)
      onModeChange(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się wykonać miesięcznego raportu fiskalnego.')
    } finally {
      setPrinting(false)
    }
  }

  return <>
    <Dialog open={mode === 'daily'} onOpenChange={(nextOpen) => { if (!printing && !nextOpen) onModeChange(null) }}>
      <DialogContent data-keep-size showCloseButton={!printing}>
        <DialogHeader>
          <DialogTitle>Wykonać raport fiskalny dobowy?</DialogTitle>
          <DialogDescription>
            POSNET wydrukuje oficjalny raport fiskalny poleceniem dailyrep. To nie jest raport kasowy zmiany. Raport dobowy zamyka bieżące totalizery fiskalne i nie można go cofnąć.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>Drukuj dopiero po zakończeniu sprzedaży za dzień. Drukarka może poprosić o potwierdzenie daty; odrzuca też dwa zerowe raporty dobowe z rzędu.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={printing} onClick={() => onModeChange(null)}>Wróć</Button>
          <Button variant="destructive" disabled={printing} onClick={() => void printDailyReport()}>
            {printing ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Printer aria-hidden="true" />}
            {printing ? 'Wysyłanie…' : 'Wykonaj raport fiskalny'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={mode === 'monthly'} onOpenChange={(nextOpen) => { if (!printing && !nextOpen) onModeChange(null) }}>
      <DialogContent data-keep-size showCloseButton={!printing}>
        <DialogHeader>
          <DialogTitle>Wykonać miesięczny raport fiskalny?</DialogTitle>
          <DialogDescription>
            POSNET wydrukuje raport za wybrany miesiąc poleceniem monthlyrep. Jest to raport fiskalny z drukarki, a nie raport kasowy zmiany z aplikacji. Wydruk nie zamyka bieżących totalizerów.
          </DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Miesiąc raportu
          <input
            type="month"
            value={month}
            max={new Date().toISOString().slice(0, 7)}
            onChange={(event) => setMonth(event.target.value)}
            disabled={printing}
            className="h-11 rounded-lg border border-input bg-background px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <DialogFooter>
          <Button variant="outline" disabled={printing} onClick={() => onModeChange(null)}>Wróć</Button>
          <Button disabled={printing || !month} onClick={() => void printMonthlyReport()}>
            {printing ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Printer aria-hidden="true" />}
            {printing ? 'Wysyłanie…' : 'Wykonaj raport miesięczny'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
