import type { MetadataRoute } from 'next'
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} – burgery z dostawą`,
    short_name: 'Yummy',
    description: SITE_DESCRIPTION,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    lang: 'pl',
    background_color: '#fbf6ee',
    theme_color: '#e2261c',
    icons: [
      { src: '/icon.png', sizes: 'any', type: 'image/png' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
