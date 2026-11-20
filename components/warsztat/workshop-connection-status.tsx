'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { AlertTriangle, Info, RefreshCw, RotateCw, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { OrdersSyncState, ServerIssue, StreamIssue } from './use-orders-sync'

function subscribe(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

type Connection = 'live' | 'polling' | 'offline' | 'server'

/**
 * navigator.onLine only proves a network adapter is up, not that there is internet behind it,
 * so "online" is decided by whether the orders query actually reaches the database.
 */
function useConnection(sync: OrdersSyncState): Connection {
  const browserOnline = useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
  if (!browserOnline) return 'offline'
  if (sync.server === 'unreachable') return 'server'
  return sync.realtime === 'down' ? 'polling' : 'live'
}


const dotStyles: Record<Connection, { label: string; box: string; dot: string }> = {
  live: { label: 'Na żywo', box: 'border-emerald-200 bg-emerald-50 text-emerald-800', dot: 'bg-emerald-500' },
  polling: { label: 'Problem', box: 'border-amber-300 bg-amber-50 text-amber-900', dot: 'bg-amber-500' },
  offline: { label: 'Offline', box: 'border-red-200 bg-red-50 text-red-700', dot: 'bg-red-500' },
  server: { label: 'Brak serwera', box: 'border-red-200 bg-red-50 text-red-700', dot: 'bg-red-500' },
}

const streamIssueText: Record<StreamIssue, string> = {
  connecting: 'Połączenie na żywo nie zostało jeszcze nawiązane – serwer nie potwierdził subskrypcji zamówień.',
  heartbeat: 'Strumień zamówień przestał odpowiadać na sygnał kontrolny (heartbeat). Zwykle oznacza to chwilowe zerwanie internetu lub przeciążoną sieć Wi-Fi.',
  stale: 'Połączenie wygląda na otwarte, ale od ponad minuty nie przyszedł z niego żaden sygnał. Możliwe, że przeglądarka uśpiła kartę albo router zerwał połączenie.',
  'channel-error': 'Serwer odrzucił kanał zamówień. Najczęściej to wygasła sesja logowania lub chwilowa awaria usługi Realtime.',
  'timed-out': 'Serwer nie odpowiedział na czas przy zakładaniu połączenia na żywo. Sieć może być bardzo wolna.',
  closed: 'Połączenie na żywo zostało zamknięte (np. przez router, zmianę sieci Wi-Fi lub restart usługi).',
  wake: 'Urządzenie zostało wybudzone z uśpienia lub karta była w tle – połączenie na żywo jest odtwarzane.',
}

const serverIssueText: Record<ServerIssue, string> = {
  offline: 'Urządzenie nie jest podłączone do żadnej sieci (Wi-Fi wyłączone, tryb samolotowy albo odłączony kabel).',
  timeout: 'Urządzenie jest w sieci, ale serwer nie odpowiedział w ciągu 8 sekund. Najczęściej router ma Wi-Fi, ale nie ma internetu.',
  error: 'Urządzenie jest w sieci, ale serwer zwrócił błąd lub odrzucił połączenie. Możliwa awaria serwera lub wygasła sesja.',
}

export function ConnectionDot({ sync }: { sync: OrdersSyncState }) {
  const connection = useConnection(sync)
  const style = dotStyles[connection]
  return (
    <div role="status" aria-label={`Połączenie: ${style.label}`} title={style.label} className={cn('flex h-9 items-center gap-2 rounded-xl border px-2.5 text-xs font-bold', style.box)}>
      <span aria-hidden="true" className="relative flex size-2.5">
        {connection === 'live' && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:hidden" />}
        <span className={cn('relative inline-flex size-2.5 rounded-full', style.dot)} />
      </span>
      <span className="hidden md:inline">{style.label}</span>
    </div>
  )
}

function BannerButton({ onClick, disabled, children, tone }: { onClick: () => void; disabled?: boolean; children: React.ReactNode; tone: 'red' | 'amber' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-semibold transition-colors disabled:opacity-60 lg:text-sm',
        tone === 'red' ? 'border-white/40 bg-white/15 text-white hover:bg-white/25' : 'border-amber-300 bg-white/80 text-amber-950 hover:bg-white',
      )}
    >
      {children}
    </button>
  )
}

const AUTO_RELOAD_SECONDS = 6
const AUTO_RELOAD_KEY = 'workshop-stream-auto-reload-at'
/** If the live channel is still down this soon after our own auto-reload, the reload did not help. */
const AUTO_RELOAD_WINDOW_MS = 5 * 60_000

function readRecentAutoReload() {
  try {
    const at = Number(window.sessionStorage.getItem(AUTO_RELOAD_KEY) ?? 0)
    return at > 0 && Date.now() - at < AUTO_RELOAD_WINDOW_MS
  } catch {
    return false
  }
}

function reloadPanel(auto = false) {
  if (auto) {
    try { window.sessionStorage.setItem(AUTO_RELOAD_KEY, String(Date.now())) } catch {}
  }
  window.location.reload()
}

function ReloadCountdown() {
  const [seconds, setSeconds] = useState(AUTO_RELOAD_SECONDS)
  useEffect(() => {
    if (seconds <= 0) {
      // Never throw away a half-filled order form; start counting again once it is closed.
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) setSeconds(AUTO_RELOAD_SECONDS)
      else reloadPanel(true)
      return
    }
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [seconds])
  return (
    <span
      aria-live="polite"
      aria-label={`Automatyczne odświeżenie za ${seconds} s`}
      className="inline-flex h-8 min-w-12 items-center justify-center rounded-lg bg-amber-600 px-2 text-sm font-bold tabular-nums text-white lg:text-base"
    >
      {Math.max(seconds, 0)}s
    </span>
  )
}

/** The live stream is not confirmed, so the board may lag behind the database. */
export function StreamDelayBanner({ sync }: { sync: OrdersSyncState }) {
  const connection = useConnection(sync)
  const [detailsOpen, setDetailsOpen] = useState(false)

  useEffect(() => {
    if (sync.streamConfirmed && sync.realtime === 'live') {
      try { window.sessionStorage.removeItem(AUTO_RELOAD_KEY) } catch {}
    }
  }, [sync.streamConfirmed, sync.realtime])

  if (connection !== 'polling') return null
  const reason = streamIssueText[sync.streamIssue ?? 'connecting']
  const reloadDidNotHelp = readRecentAutoReload()
  return (
    <>
      <div role="status" className="flex flex-col gap-2 border-b border-amber-300 bg-amber-100 px-3 py-2.5 text-amber-950 sm:flex-row sm:items-center sm:justify-between lg:px-5">
        <div className="flex min-w-0 items-start gap-2.5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
          <div className="min-w-0">
            {reloadDidNotHelp ? (
              <>
                <p className="text-sm font-bold lg:text-base">Kanał na żywo nie działa</p>
                <p className="text-[12px] leading-snug text-amber-900 lg:text-sm text-pretty">
                  Odświeżenie nie przywróciło połączenia na żywo. Zamówienia nadal przychodzą, ale z opóźnieniem do 15 s.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold lg:text-base">Problem z połączeniem</p>
                <p className="text-[12px] leading-snug text-amber-900 lg:text-sm text-pretty">
                  Nie możemy potwierdzić, że zamówienia aktualizują się prawidłowo. Panel odświeży się automatycznie.
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 pl-7 sm:pl-0">
          {!reloadDidNotHelp && <ReloadCountdown />}
          <BannerButton tone="amber" onClick={() => reloadPanel()}>
            <RotateCw className="size-3.5 lg:size-4" aria-hidden="true" />{reloadDidNotHelp ? 'Odśwież panel' : 'Odśwież teraz'}
          </BannerButton>
          <BannerButton tone="amber" onClick={() => setDetailsOpen(true)}>
            <Info className="size-3.5 lg:size-4" aria-hidden="true" />Szczegóły
          </BannerButton>
        </div>
      </div>
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Problem z połączeniem</DialogTitle>
            <DialogDescription>Serwer odpowiada, ale połączenie na żywo nie jest potwierdzone. Aplikacja sama próbuje je przywrócić i w międzyczasie pobiera zamówienia z bazy co 15 sekund.</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <p className="font-bold">Prawdopodobna przyczyna</p>
            <p className="mt-1 leading-relaxed">{reason}</p>
          </div>
          <ul className="list-disc space-y-2 pl-5 text-sm text-[#36312d]">
            <li>Nowe zamówienia i zmiany z innych stanowisk mogą pojawiać się z opóźnieniem do ok. 15 s.</li>
            <li>Twoje własne kliknięcia zapisują się od razu.</li>
            <li>Jeśli problem trwa dłużej niż minutę, odśwież panel. Po 10 minutach bezczynności aplikacja zrobi to sama.</li>
          </ul>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => window.location.reload()}>Odśwież panel</Button>
            <Button type="button" onClick={() => setDetailsOpen(false)}>Rozumiem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Orders are NOT arriving at all: no network, or Wi-Fi without internet / server not answering. */
export function OfflineBanner({ sync, onCheck }: { sync: OrdersSyncState; onCheck: () => void }) {
  const connection = useConnection(sync)
  const [detailsOpen, setDetailsOpen] = useState(false)
  if (connection === 'live' || connection === 'polling') return null
  const issue: ServerIssue = connection === 'offline' ? 'offline' : sync.serverIssue ?? 'timeout'
  return (
    <>
      <div role="alert" className="flex flex-col gap-2 bg-red-600 px-3 py-2.5 text-white sm:flex-row sm:items-center sm:justify-between lg:px-5">
        <div className="flex min-w-0 items-start gap-2.5">
          <WifiOff className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-bold lg:text-base">Brak dostępu do internetu</p>
            <p className="text-[12px] leading-snug text-red-100 lg:text-sm">Nie można połączyć się z serwerem</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 pl-7 sm:pl-0">
          <BannerButton tone="red" onClick={onCheck} disabled={sync.checking}>
            <RefreshCw className={cn('size-3.5 lg:size-4', sync.checking && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />
            {sync.checking ? 'Sprawdzam…' : 'Sprawdź teraz'}
          </BannerButton>
          <BannerButton tone="red" onClick={() => setDetailsOpen(true)}>
            <Info className="size-3.5 lg:size-4" aria-hidden="true" />Szczegóły
          </BannerButton>
        </div>
      </div>
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Brak dostępu do internetu</DialogTitle>
            <DialogDescription>Nowe zamówienia nie docierają do panelu. Aplikacja ponawia połączenie automatycznie i pobierze zaległe zamówienia, gdy tylko wróci internet.</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <p className="font-bold">Prawdopodobna przyczyna</p>
            <p className="mt-1 leading-relaxed">{serverIssueText[issue]}</p>
          </div>
          <ul className="list-disc space-y-2 pl-5 text-sm text-[#36312d]">
            <li>Sprawdź, czy Wi-Fi jest włączone i czy inne strony działają na tym urządzeniu.</li>
            <li>Jeśli Wi-Fi jest, ale internetu nie ma – zrestartuj router.</li>
            <li>Zmiany wprowadzone teraz mogą się nie zapisać. Zamówienia przyjmuj telefonicznie do czasu przywrócenia połączenia.</li>
          </ul>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onCheck} disabled={sync.checking}>{sync.checking ? 'Sprawdzam…' : 'Sprawdź teraz'}</Button>
            <Button type="button" onClick={() => setDetailsOpen(false)}>Rozumiem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
