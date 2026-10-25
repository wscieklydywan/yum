import type { Metadata, Viewport } from 'next'
import { Archivo, Kaushan_Script } from 'next/font/google'
import { Toaster } from 'sonner'
import { Analytics } from '@vercel/analytics/next'
import { CartProvider } from '@/components/cart/cart-context'
import { OG_IMAGE, SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_URL } from '@/lib/seo'
import './globals.css'

const archivo = Archivo({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-archivo',
})

const kaushan = Kaushan_Script({
  subsets: ['latin', 'latin-ext'],
  weight: '400',
  variable: '--font-kaushan',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Yummy Rybnik – najlepsze burgery w Rybniku | Zamów online z dostawą',
    template: '%s | Yummy Rybnik',
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'restaurant',
  alternates: { canonical: '/' },
  formatDetection: { telephone: true, address: true },
  openGraph: {
    type: 'website',
    locale: 'pl_PL',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: 'Yummy Rybnik – najlepsze burgery w Rybniku',
    description: SITE_DESCRIPTION,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Yummy Rybnik – soczyste burgery z dostawą w Rybniku' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Yummy Rybnik – najlepsze burgery w Rybniku',
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ? { 'msvalidate.01': process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } : undefined,
  },
  other: { 'geo.region': 'PL-24', 'geo.placename': 'Rybnik', 'geo.position': '50.0592581;18.4894257', ICBM: '50.0592581, 18.4894257' },
}

export const viewport: Viewport = {
  themeColor: '#e2261c',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pl" className={`${archivo.variable} ${kaushan.variable} bg-background`}>
      <body className="antialiased">
        <CartProvider>{children}</CartProvider>
        <Toaster position="bottom-center" richColors swipeDirections={['left', 'right', 'top', 'bottom']} />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
