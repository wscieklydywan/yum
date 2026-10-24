export type PushStation = 'kitchen' | 'cashier'

export type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return Promise.resolve(null)
  registrationPromise ??= navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => null)
  return registrationPromise
}

let deferredInstallPrompt: InstallPromptEvent | null = null
let installGuardAttached = false
const installPromptListeners = new Set<() => void>()
const emitInstallPromptChange = () => installPromptListeners.forEach((listener) => listener())

/**
 * Stops the browser from showing its own install banner on page entry. The event is kept so the install
 * can still happen when a staff member deliberately clicks "Zainstaluj".
 */
function attachInstallGuard() {
  if (installGuardAttached || typeof window === 'undefined') return
  installGuardAttached = true
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredInstallPrompt = event as InstallPromptEvent
    emitInstallPromptChange()
  })
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null
    emitInstallPromptChange()
  })
}

export function subscribeToInstallPrompt(listener: () => void) {
  attachInstallGuard()
  installPromptListeners.add(listener)
  return () => {
    installPromptListeners.delete(listener)
  }
}

export const getInstallPrompt = () => deferredInstallPrompt
export const getServerInstallPrompt = () => null

export async function promptInstall() {
  const prompt = deferredInstallPrompt
  if (!prompt) return false
  deferredInstallPrompt = null
  emitInstallPromptChange()
  await prompt.prompt()
  const { outcome } = await prompt.userChoice
  return outcome === 'accepted'
}

function base64UrlToBytes(value: string) {
  const padded = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index)
  return bytes
}

/** Per-device opt-out: a disabled device gets neither server push nor the local fallback notification. */
const PUSH_DISABLED_KEY = 'yummy-push-disabled'
const pushPreferenceListeners = new Set<() => void>()
const emitPushPreferenceChange = () => pushPreferenceListeners.forEach((listener) => listener())

function setPushDisabled(disabled: boolean) {
  try {
    if (disabled) localStorage.setItem(PUSH_DISABLED_KEY, '1')
    else localStorage.removeItem(PUSH_DISABLED_KEY)
  } catch {}
  emitPushPreferenceChange()
}

export function isPushDisabled() {
  try {
    return localStorage.getItem(PUSH_DISABLED_KEY) === '1'
  } catch {
    return false
  }
}

export function subscribeToPushPreference(listener: () => void) {
  pushPreferenceListeners.add(listener)
  const onStorage = (event: StorageEvent) => { if (event.key === PUSH_DISABLED_KEY) listener() }
  window.addEventListener('storage', onStorage)
  return () => {
    pushPreferenceListeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** Removes this device's subscription on the server and in the browser, so no push can reach it. */
export async function unsubscribeFromPush() {
  setPushDisabled(true)
  try {
    const registration = await registerServiceWorker()
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) return true
    await fetch('/api/workshop/push', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    })
    await subscription.unsubscribe()
    return true
  } catch {
    return false
  }
}

/** Subscribes this device to server-sent Web Push for the given station (works while minimized or locked). */
export async function subscribeToPush(station: PushStation) {
  const ok = await saveSubscription(station)
  if (ok) setPushDisabled(false)
  return ok
}

async function saveSubscription(station: PushStation) {
  try {
    await registerServiceWorker()
    const registration = await navigator.serviceWorker.ready
    const response = await fetch('/api/workshop/push')
    if (!response.ok) return false
    const { publicKey } = (await response.json()) as { publicKey: string }
    const applicationServerKey = base64UrlToBytes(publicKey)

    let subscription = await registration.pushManager.getSubscription()
    const currentKey = subscription?.options.applicationServerKey
    if (subscription && currentKey && new Uint8Array(currentKey).toString() !== applicationServerKey.toString()) {
      await subscription.unsubscribe()
      subscription = null
    }
    subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })

    const saved = await fetch('/api/workshop/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...subscription.toJSON(), station }),
    })
    return saved.ok
  } catch {
    return false
  }
}

/** Same rule as the service worker: the panel is "active" only when it is visible and focused. */
const isPanelActiveOnScreen = () => document.visibilityState === 'visible' && document.hasFocus()

/**
 * Local fallback notification for when the page is alive but not in front of the user and push is not set up.
 * Same tag as the push; the service worker skips a push whose tag is already shown, so they never double up.
 */
export async function showSystemNotification(title: string, body: string, tag?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted' || isPushDisabled() || isPanelActiveOnScreen()) return
  const options: NotificationOptions = { body, tag, icon: '/warsztat-icon-192.png', badge: '/warsztat-icon-192.png', requireInteraction: true, data: { url: '/warsztat' } }
  const registration = await registerServiceWorker()
  if (registration) await registration.showNotification(title, options)
  else new Notification(title, options)
}
