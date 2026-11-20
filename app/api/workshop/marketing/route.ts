import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { PUBLIC_WHEEL_CONFIG_TAG } from '@/lib/public-cache'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'
import { monthStartIso, type MarketingCostRow, type MarketingEvent, type MarketingOverview, type MarketingSettings } from '@/lib/marketing'

const SETTINGS_COLUMNS = 'wheel_enabled, extra_spin_enabled, extra_spin_cost, wheel_monthly_budget'

type SettingsRow = { wheel_enabled: boolean; extra_spin_enabled: boolean; extra_spin_cost: number; wheel_monthly_budget: number | string | null }

function toSettings(row: SettingsRow): MarketingSettings {
  return {
    enabled: row.wheel_enabled,
    extraSpinEnabled: row.extra_spin_enabled,
    extraSpinCost: row.extra_spin_cost,
    monthlyBudget: row.wheel_monthly_budget === null ? null : Number(row.wheel_monthly_budget),
  }
}

async function loadOverview(): Promise<MarketingOverview | null> {
  const admin = createAdminClient()
  const monthStart = monthStartIso()
  const [settings, summary, events] = await Promise.all([
    admin.from('restaurant_settings').select(SETTINGS_COLUMNS).eq('id', 1).single<SettingsRow>(),
    admin.rpc('marketing_cost_summary', { p_from: monthStart }),
    admin.from('marketing_events').select('id, source, label, amount, created_at').order('created_at', { ascending: false }).limit(15),
  ])
  if (settings.error || summary.error || events.error) return null

  const rows: MarketingCostRow[] = (summary.data ?? []).map((row: Record<string, unknown>) => ({
    source: row.source as MarketingCostRow['source'],
    refId: String(row.ref_id ?? ''),
    label: String(row.label ?? ''),
    uses: Number(row.uses),
    total: Number(row.total),
    periodUses: Number(row.period_uses),
    periodTotal: Number(row.period_total),
  }))
  const sum = (source: MarketingCostRow['source']) =>
    rows.filter((row) => row.source === source).reduce((acc, row) => ({ monthTotal: acc.monthTotal + row.periodTotal, monthUses: acc.monthUses + row.periodUses }), { monthTotal: 0, monthUses: 0 })

  return {
    settings: toSettings(settings.data),
    monthStart,
    wheel: sum('wheel'),
    promo: sum('promo'),
    rows: rows.sort((a, b) => b.periodTotal - a.periodTotal || b.total - a.total),
    events: (events.data ?? []).map((event) => ({ ...event, amount: Number(event.amount) })) as MarketingEvent[],
  }
}

export async function GET() {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const overview = await loadOverview()
  if (!overview) return NextResponse.json({ error: 'Nie udało się wczytać danych marketingu.' }, { status: 503 })
  return NextResponse.json(overview)
}

export async function PATCH(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = (await request.json().catch(() => null)) as Partial<MarketingSettings> | null
  if (!body) return NextResponse.json({ error: 'Nieprawidłowe dane.' }, { status: 400 })

  const cost = Math.round(Number(body.extraSpinCost))
  if (!(cost >= 1 && cost <= 100000)) return NextResponse.json({ error: 'Koszt zakręcenia: 1–100 000 pkt.' }, { status: 400 })
  const budget = body.monthlyBudget === null || body.monthlyBudget === undefined ? null : Math.round(Number(body.monthlyBudget) * 100) / 100
  if (budget !== null && !(budget >= 0 && budget <= 1_000_000)) return NextResponse.json({ error: 'Budżet: 0–1 000 000 zł lub bez limitu.' }, { status: 400 })

  const { error } = await createAdminClient()
    .from('restaurant_settings')
    .update({
      wheel_enabled: body.enabled !== false,
      extra_spin_enabled: body.extraSpinEnabled !== false,
      extra_spin_cost: cost,
      wheel_monthly_budget: budget,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
  if (error) return NextResponse.json({ error: 'Nie udało się zapisać ustawień.' }, { status: 503 })
  // Invalidate right after the write, also when the overview reload below fails – the settings are saved either way.
  revalidateTag(PUBLIC_WHEEL_CONFIG_TAG, { expire: 0 })

  const overview = await loadOverview()
  if (!overview) return NextResponse.json({ error: 'Zapisano, ale nie udało się odświeżyć danych.' }, { status: 503 })
  return NextResponse.json(overview)
}
