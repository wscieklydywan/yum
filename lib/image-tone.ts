'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

export type Tone = 'light' | 'dark'

const cache = new Map<string, Promise<Tone | null>>()

/**
 * Samples the bottom-right corner of an image (where the slider progress bars sit)
 * and returns 'dark' when it is bright enough to need dark bars, otherwise 'light'.
 * Null when the image can't be read (e.g. a host without CORS).
 */
export function detectCornerTone(src: string): Promise<Tone | null> {
  const cached = cache.get(src)
  if (cached) return cached
  const result = new Promise<Tone | null>((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => {
      try {
        const size = 32
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return resolve(null)
        const w = img.naturalWidth
        const h = img.naturalHeight
        ctx.drawImage(img, w * 0.6, h * 0.8, w * 0.4, h * 0.2, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)
        let total = 0
        for (let i = 0; i < data.length; i += 4) total += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
        resolve(total / (data.length / 4) > 150 ? 'dark' : 'light')
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
  cache.set(src, result)
  return result
}

/** Detected corner tone for each image url; urls still loading or unreadable are absent. */
export function useImageTones(urls: string[]) {
  const [tones, setTones] = useState<Record<string, Tone>>({})
  const key = urls.join('|')
  useEffect(() => {
    let cancelled = false
    for (const url of urls) {
      detectCornerTone(url).then((tone) => {
        if (!cancelled && tone) setTones((prev) => (prev[url] === tone ? prev : { ...prev, [url]: tone }))
      })
    }
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key captures the urls
  }, [key])
  return tones
}

const SM_QUERY = '(min-width: 640px)'
const subscribeSm = (onChange: () => void) => {
  const mql = window.matchMedia(SM_QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

/** True on tablet/desktop widths (Tailwind `sm`), false on phones and during SSR. */
export function useIsDesktop() {
  return useSyncExternalStore(subscribeSm, () => window.matchMedia(SM_QUERY).matches, () => false)
}
