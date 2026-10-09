import type { Metadata, Viewport } from 'next'
import { Archivo, Kaushan_Script } from 'next/font/google'
import { Toaster } from 'sonner'
import { CartProvider } from '@/components/cart/cart-context'
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
  title: 'Yummy – Burgery, które robią dzień',
  description:
    'Soczysta wołowina, świeże dodatki i autorskie sosy. Zamów burgery Yummy z dostawą lub odbiorem osobistym i zbieraj punkty w Yummy Club.',
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
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  )
}
