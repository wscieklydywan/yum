import type { MetadataRoute } from 'next'

// Separate id/scope from /warsztat so the driver app installs as its own icon that always opens on /kierowca.
const manifest: MetadataRoute.Manifest = {
  id: '/kierowca',
  name: 'Yummy Kierowca',
  short_name: 'Kierowca',
  description: 'Dowozy Yummy: zamówienia gotowe do wyjazdu i w trasie.',
  start_url: '/kierowca',
  scope: '/kierowca',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#f6f3ef',
  theme_color: '#f6f3ef',
  lang: 'pl',
  icons: [
    { src: '/warsztat-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/warsztat-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/warsztat-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}

export function GET() {
  return Response.json(manifest, { headers: { 'Content-Type': 'application/manifest+json' } })
}
