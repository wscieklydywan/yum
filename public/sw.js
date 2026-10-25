// Yummy Warsztat service worker: makes the panel installable and shows "new order" push notifications.
// It deliberately does not cache orders – the panel must always show live data.
//
// Push messages are data-only (web-push sends an encrypted payload without an FCM `notification` block),
// so the browser never displays anything on its own – this worker is the single place that decides
// whether a system notification appears. That is what prevents duplicates.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// Chrome requires a fetch handler for installability; network-only keeps data fresh.
self.addEventListener('fetch', () => {})

const isPanelUrl = (url) => new URL(url).pathname.startsWith('/warsztat')

/**
 * Push is only a fallback: whenever a panel window is visible on screen, the panel itself alerts (sound + toast),
 * so no system notification is shown. `focused` is intentionally ignored – on tablets/split screen a visible
 * panel can report focused=false after a tap elsewhere. Another tab/app in front, minimized window, locked
 * screen or closed panel all make it hidden (or absent), so the system notification appears.
 */
async function isPanelActiveOnScreen() {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  return windows.some((client) => isPanelUrl(client.url) && client.visibilityState === 'visible')
}

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: 'Yummy Warsztat', body: event.data?.text() } }
  event.waitUntil((async () => {
    if (await isPanelActiveOnScreen()) return

    // The page may already have shown its local fallback with the same tag – don't alert twice for one order.
    if (data.tag) {
      const existing = await self.registration.getNotifications({ tag: data.tag })
      if (existing.length) return
    }

    await self.registration.showNotification(data.title || 'Nowe zamówienie', {
      body: data.body || '',
      tag: data.tag,
      renotify: Boolean(data.tag),
      requireInteraction: true,
      vibrate: [300, 150, 300, 150, 300],
      icon: '/warsztat-icon-192.png',
      badge: '/warsztat-icon-192.png',
      data: { url: data.url || '/warsztat' },
    })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/warsztat'
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find((client) => isPanelUrl(client.url))
    if (existing) return existing.focus()
    return self.clients.openWindow(url)
  })())
})
