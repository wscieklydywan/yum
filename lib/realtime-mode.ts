import type { SupabaseClient } from '@supabase/supabase-js'

// The workshop uses only private Broadcast topics fed by DB triggers (supabase/migrations/20261031_workshop_broadcast.sql).
// Postgres Changes is disabled: no table is in the supabase_realtime publication (20261101_drop_postgres_changes.sql).

const SHARED_TOKEN_MS = 5000
const sharedTokens = new WeakMap<SupabaseClient, { at: number; promise: Promise<string | null> }>()

/**
 * Access token for private topics. getUser() refreshes a token that expired while the tablet slept and detects a
 * revoked session. The orders, menu and status channels all reconnect at the same moment (wake, network back), so
 * concurrent callers share one in-flight check; only a successful result is reused, and only for a few seconds.
 */
export function freshAccessToken(supabase: SupabaseClient): Promise<string | null> {
  const shared = sharedTokens.get(supabase)
  if (shared && Date.now() - shared.at < SHARED_TOKEN_MS) return shared.promise
  const promise = (async () => {
    await supabase.auth.getUser().catch(() => null)
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  })()
  const entry = { at: Date.now(), promise }
  sharedTokens.set(supabase, entry)
  void promise.then(
    (token) => { if (!token && sharedTokens.get(supabase) === entry) sharedTokens.delete(supabase) },
    () => { if (sharedTokens.get(supabase) === entry) sharedTokens.delete(supabase) },
  )
  return promise
}

export async function authorizeRealtime(supabase: SupabaseClient) {
  const token = await freshAccessToken(supabase).catch(() => null)
  if (token) await supabase.realtime.setAuth(token)
}

/** Fixed topic names are reused, so a leftover channel with the same topic must be closed before joining again. */
export async function removeChannelsForTopic(supabase: SupabaseClient, topic: string) {
  const stale = supabase.getChannels().filter((channel) => channel.topic === `realtime:${topic}`)
  await Promise.all(stale.map((channel) => supabase.removeChannel(channel)))
}
