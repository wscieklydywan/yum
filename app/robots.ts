import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

const PRIVATE_PATHS = ['/api/', '/warsztat', '/kiosk', '/auth/', '/yummy-club/aktywowano', '/yummy-club/nowe-haslo']

/** Search and AI assistants we explicitly welcome, so Yummy shows up in Google, Bing, ChatGPT, Gemini, Perplexity, Claude, etc. */
const WELCOME_BOTS = [
  'Googlebot',
  'Google-Extended',
  'Bingbot',
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'PerplexityBot',
  'Perplexity-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'Applebot',
  'Applebot-Extended',
  'meta-externalagent',
  'DuckDuckBot',
  'YandexBot',
  'CCBot',
  'Amazonbot',
  'MistralAI-User',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE_PATHS },
      { userAgent: WELCOME_BOTS, allow: ['/', '/llms.txt'], disallow: PRIVATE_PATHS },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
