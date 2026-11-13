import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isOpenPastMidnight, midnightAfter } from './business-day'
import { buildDaySummary, reportRangeStart } from './day-report'

/**
 * Closes a day nobody closed: at midnight (Warsaw) its report is saved automatically and the
 * day is flagged, so the bar sees an orange reminder to finish the reports before opening again.
 * Only the request that wins the conditional update writes the report.
 */
export async function ensureBusinessDay(admin: SupabaseClient) {
  const { data: row, error } = await admin.from('restaurant_settings').select('day_open, day_opened_at').eq('id', 1).maybeSingle()
  if (error || !row) return false
  if (!isOpenPastMidnight(row.day_open, row.day_opened_at)) return true

  const closedAt = midnightAfter(new Date(row.day_opened_at)).toISOString()
  const { data: claimed, error: claimError } = await admin
    .from('restaurant_settings')
    .update({ day_open: false, day_closed_at: closedAt, day_auto_closed: true, ordering_override_until: null, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .eq('day_open', true)
    .eq('day_opened_at', row.day_opened_at)
    .select('id')
  if (claimError) return false
  if (!claimed?.length) return true

  const from = await reportRangeStart(admin, row.day_opened_at)
  const summary = await buildDaySummary(admin, from, closedAt, closedAt)
  if (summary) await admin.from('day_reports').insert({ opened_at: row.day_opened_at, closed_at: closedAt, finalized_at: closedAt, summary })
  return true
}

/** Whether staff can accept orders right now (the day is open and not left over from yesterday). */
export async function isDayOpen(admin: SupabaseClient) {
  const { data } = await admin.from('restaurant_settings').select('day_open, day_opened_at').eq('id', 1).maybeSingle()
  return !!data?.day_open && !isOpenPastMidnight(data.day_open, data.day_opened_at)
}
