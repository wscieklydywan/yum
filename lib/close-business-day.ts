import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildDaySummary, reportRangeStart } from './day-report'

type CloseResult = { ok: true; closedAt: string } | { ok: false; status: number; error: string }

/** Closes the open day and stores its statistics for the "Raporty" section. Only the request that wins the conditional update closes it. */
export async function closeBusinessDay(admin: SupabaseClient, userId: string): Promise<CloseResult> {
  const { data: row, error } = await admin.from('restaurant_settings').select('day_open, day_opened_at').eq('id', 1).maybeSingle()
  if (error || !row) return { ok: false, status: 503, error: 'Nie udało się wczytać ustawień lokalu.' }
  if (!row.day_open || !row.day_opened_at) return { ok: false, status: 409, error: 'Dzień jest już zamknięty.' }

  const closedAt = new Date().toISOString()
  const from = await reportRangeStart(admin, row.day_opened_at)
  const summary = await buildDaySummary(admin, from, closedAt, closedAt)
  if (!summary) return { ok: false, status: 503, error: 'Nie udało się zamknąć dnia.' }

  const { data: claimed } = await admin
    .from('restaurant_settings')
    .update({ day_open: false, day_closed_at: closedAt, day_auto_closed: false, ordering_override_until: null, updated_at: closedAt })
    .eq('id', 1)
    .eq('day_open', true)
    .eq('day_opened_at', row.day_opened_at)
    .select('id')
  if (!claimed?.length) return { ok: false, status: 409, error: 'Dzień został już zamknięty.' }

  const { error: reportError } = await admin.from('day_reports').insert({ opened_at: row.day_opened_at, closed_at: closedAt, finalized_at: closedAt, closed_by: userId, summary })
  if (reportError) return { ok: false, status: 503, error: 'Nie udało się zamknąć dnia.' }
  return { ok: true, closedAt }
}
