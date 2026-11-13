import type { Metadata } from 'next'
import { ClubInstallLanding } from '@/components/club/club-install-landing'
import { QrScanTracker } from '@/components/club/qr-scan-tracker'

export const metadata: Metadata = {
  title: 'Zainstaluj aplikację Yummy Club',
  description: 'Zainstaluj Yummy Club na telefonie – zbieraj Stars, odbieraj nagrody i zamawiaj burgery Yummy Rybnik.',
  alternates: { canonical: '/yummy-club/instaluj' },
  manifest: '/yummy-club/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Yummy Club', statusBarStyle: 'default' },
  icons: { apple: '/club-apple-icon.png' },
  robots: { index: false },
}

export default function ClubInstallPage() {
  return (
    <>
      <QrScanTracker />
      <ClubInstallLanding />
    </>
  )
}
