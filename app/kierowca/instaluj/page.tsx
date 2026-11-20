import type { Metadata, Viewport } from 'next'
import Image from 'next/image'
import { Bike } from 'lucide-react'
import { DriverInstallButton } from '@/components/kierowca/driver-app-controls'

export const metadata: Metadata = {
  title: 'Zainstaluj aplikację kierowcy – Yummy',
  description: 'Instalacja aplikacji Yummy Kierowca na telefonie.',
  robots: { index: false, follow: false, nocache: true },
  manifest: '/kierowca/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Kierowca', statusBarStyle: 'default' },
}

export const viewport: Viewport = { themeColor: '#f6f3ef', width: 'device-width', initialScale: 1 }

/** Direct link for drivers: always loaded fresh, so the browser offers only the driver app. */
export default function DriverInstallPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#f6f3ef] px-5 py-10 text-[#211e1b]">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border border-[#e9e3dc] bg-white p-6 text-center shadow-sm">
        <Image src="/warsztat-icon-192.png" alt="" width={72} height={72} className="rounded-2xl" />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-black tracking-tight">Yummy Kierowca</h1>
          <p className="text-sm leading-relaxed text-[#706961]">Aplikacja dla kierowców: zamówienia gotowe do wyjazdu i w trasie. Zainstaluj ją na telefonie, żeby otwierać ją z ikony „Kierowca”.</p>
        </div>
        <DriverInstallButton label="Zainstaluj aplikację kierowcy" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#211e1b] px-4 text-sm font-bold text-white hover:bg-[#3a3531] disabled:opacity-60" />
        <div className="w-full rounded-xl bg-[#f6f3ef] p-3 text-left text-xs leading-relaxed text-[#4a443f]">
          <p className="font-bold text-[#211e1b]">Nie widzisz przycisku?</p>
          <p><strong>Android (Chrome):</strong> menu (trzy kropki) → „Zainstaluj aplikację” / „Dodaj do ekranu głównego”.</p>
          <p><strong>iPhone (Safari):</strong> „Udostępnij” → „Do ekranu początkowego”.</p>
        </div>
        <a href="/kierowca" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#706961] hover:text-[#211e1b]"><Bike className="size-4" aria-hidden="true" />Otwórz panel kierowcy</a>
      </div>
    </main>
  )
}
