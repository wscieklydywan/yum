'use client'

import { useEffect } from 'react'

const DEVICE_KEY = 'yummy-install-device'
const PING_KEY = 'yummy-install-ping'

function platform() {
  const ua = navigator.userAgent
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/android/i.test(ua)) return 'android'
  if (/windows|macintosh|linux|cros/i.test(ua)) return 'desktop'
  return 'other'
}

function deviceId() {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

function report(source: 'appinstalled' | 'standalone') {
  const app = window.location.pathname.startsWith('/club') ? 'club' : 'site'
  return fetch('/api/pwa/install', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: deviceId(), app, platform: platform(), source }),
    keepalive: true,
  })
}

/** Counts installs of the customer app: Android/desktop fire `appinstalled`, iOS is only visible once the app runs standalone. */
export function PwaInstallTracker() {
  useEffect(() => {
    if (window.location.pathname.startsWith('/warsztat')) return
    const onInstalled = () => void report('appinstalled').catch(() => {})
    window.addEventListener('appinstalled', onInstalled)

    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
    const today = new Date().toISOString().slice(0, 10)
    if (standalone && localStorage.getItem(PING_KEY) !== today) {
      report('standalone').then((res) => { if (res.ok) localStorage.setItem(PING_KEY, today) }).catch(() => {})
    }
    return () => window.removeEventListener('appinstalled', onInstalled)
  }, [])
  return null
}
