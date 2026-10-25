import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: 'daily', priority: 1, images: [`${SITE_URL}/og-image.png`, `${SITE_URL}/images/hero-burger.webp`] },
    { url: `${SITE_URL}/yummy-club`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/regulaminy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
