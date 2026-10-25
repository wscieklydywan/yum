import type { MetadataRoute } from 'next'

// Linked only from /warsztat (not site-wide via app/manifest.ts) so customer pages are never offered an install.
const manifest: MetadataRoute.Manifest = {
  id: '/warsztat',
  name: 'Yummy Warsztat',
  short_name: 'Warsztat',
  description: 'Panel zamówień Yummy dla kasy, kuchni i kierowców.',
  start_url: '/warsztat',
  scope: '/',
  display: 'standalone',
  orientation: 'any',
  background_color: '#f7f3ef',
  theme_color: '#e2261c',
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
