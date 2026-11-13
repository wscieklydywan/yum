'use client'

import { useEffect } from 'react'
import { RotateCw } from 'lucide-react'

const AUTO_RELOAD_KEY = 'yummy-panel-auto-reload-at'
const AUTO_RELOAD_GUARD_MS = 60_000

/**
 * Shown instead of a broken page when the panel crashes, typically after the phone resumed a frozen app
 * or a new deployment replaced the code it had loaded. One automatic reload is tried, then a big button.
 */
export function PanelErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    const staleCode = error.name === 'ChunkLoadError' || /Loading (CSS )?chunk|Failed to fetch dynamically imported module|Server Action/i.test(error.message)
    if (!staleCode) return
    try {
      const last = Number(sessionStorage.getItem(AUTO_RELOAD_KEY) ?? 0)
      if (Date.now() - last < AUTO_RELOAD_GUARD_MS) return
      sessionStorage.setItem(AUTO_RELOAD_KEY, String(Date.now()))
    } catch {
      return
    }
    window.location.reload()
  }, [error])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[#f6f3ef] px-6 text-center text-[#211e1b]">
      <h1 className="text-xl font-black">Coś się zacięło</h1>
      <p className="max-w-xs text-sm text-[#706961]">Zamówienia są bezpieczne w systemie. Odśwież aplikację, żeby wczytać je ponownie.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex h-14 items-center gap-2 rounded-2xl bg-[#211e1b] px-8 text-base font-bold text-white active:scale-[0.98]"
      >
        <RotateCw className="size-5" aria-hidden="true" />
        Odśwież
      </button>
      <button type="button" onClick={reset} className="text-sm font-semibold text-[#706961] underline underline-offset-4">
        Spróbuj bez przeładowania
      </button>
    </main>
  )
}
