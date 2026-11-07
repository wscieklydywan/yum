'use client'

import { useEffect } from 'react'
import { Smartphone, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isRealNativeAndroid, readStoredAndroidPreview, setAndroidPreview, useAndroidPreview } from '@/lib/native-posnet'

export function useAdminAndroidPreview(isAdmin: boolean) {
  useEffect(() => {
    setAndroidPreview(isAdmin && readStoredAndroidPreview())
    return () => setAndroidPreview(false)
  }, [isAdmin])
}

export function WorkshopAndroidPreviewToggle({ isAdmin }: { isAdmin: boolean }) {
  const active = useAndroidPreview()
  if (!isAdmin || isRealNativeAndroid()) return null

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => setAndroidPreview(!active, true)}
      title={active ? 'Wyłącz podgląd Android' : 'Włącz podgląd funkcji Android (tylko admin)'}
      aria-label={active ? 'Wyłącz podgląd Android' : 'Włącz podgląd Android'}
      className={cn(
        'grid size-9 place-items-center rounded-xl border transition-colors active:scale-95',
        active ? 'border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200' : 'border-[#e8e3dd] bg-white text-[#36312d] hover:bg-[#f7f3ef]',
      )}
    >
      <Smartphone className="size-[17px]" aria-hidden="true" />
    </button>
  )
}

export function WorkshopAndroidPreviewBanner() {
  const active = useAndroidPreview()
  if (!active) return null

  return (
    <div role="status" className="flex items-center justify-between gap-3 border-t border-amber-200 bg-amber-50 px-3 py-1.5 text-[12px] text-amber-900 sm:px-5 xl:px-6">
      <p className="flex min-w-0 items-center gap-2">
        <Smartphone className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate"><strong className="font-semibold">Podgląd Android</strong> – przyciski POSNET są symulowane, nic nie trafia do drukarki.</span>
      </p>
      <button type="button" onClick={() => setAndroidPreview(false, true)} className="flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 font-semibold hover:bg-amber-100">
        <X className="size-3.5" aria-hidden="true" />Wyłącz
      </button>
    </div>
  )
}
