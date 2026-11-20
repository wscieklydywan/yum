import type { MetadataRoute } from 'next'

// Linked only from /yummy-club, and scoped to it, so the installed app opens straight into Yummy Club
// and links outside the club (e.g. the main site) open in the regular browser.
const manifest: MetadataRoute.Manifest = {
  id: '/yummy-club',
  name: 'Yummy Club',
  short_name: 'Yummy Club',
  description: 'Yummy Club – zbieraj Stars, odbieraj nagrody i zamawiaj burgery Yummy Rybnik.',
  start_url: '/yummy-club',
  scope: '/yummy-club',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#f4f3f1',
  theme_color: '#f4f3f1',
  lang: 'pl',
  icons: [
    { src: '/club-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/club-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/club-icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}

export function GET() {
  return Response.json(manifest, { headers: { 'Content-Type': 'application/manifest+json' } })
}
