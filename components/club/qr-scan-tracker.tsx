'use client'

import { useEffect } from 'react'

function detectPlatform() {
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  if (/Windows|Macintosh|Linux/.test(ua)) return 'desktop'
  return 'other'
}

/** Logs one scan per browser session when the install page is opened from a printed QR code (utm_source=qr). */
export function QrScanTracker() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('utm_source') !== 'qr') return
    const campaign = (params.get('utm_campaign') ?? 'instalacja').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40) || 'instalacja'
    const key = `yummy-qr-scan:${campaign}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {}
    const body = JSON.stringify({ campaign, platform: detectPlatform() })
    if (!navigator.sendBeacon?.('/api/qr/scan', new Blob([body], { type: 'application/json' }))) {
      void fetch('/api/qr/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true })
    }
  }, [])
  return null
}
