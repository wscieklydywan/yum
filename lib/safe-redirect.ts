/** Resolves `next` against the request and only accepts it when it stays on the same origin (blocks `/\evil.com` etc.). */
export function safeRedirectUrl(next: string | null, requestUrl: string, fallback: string): URL {
  const base = new URL(requestUrl)
  if (next?.startsWith('/')) {
    try {
      const target = new URL(next, base)
      if (target.origin === base.origin) return target
    } catch {}
  }
  return new URL(fallback, base)
}
