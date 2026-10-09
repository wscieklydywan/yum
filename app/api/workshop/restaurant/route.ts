import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { MANAGER_ROLES, authorizeRoles } from '@/lib/workshop-auth'
import { SETTINGS_COLUMNS, toSettings, type SettingsRow } from '@/lib/restaurant-state'
import { MAX_CLOSE_BEFORE_MINUTES, computeStatus, isWithinHours, nextOpeningAt, parseOpeningHours } from '@/lib/restaurant-status'
import { buildDaySummary, finalizePendingReport } from '@/lib/day-report'
import { MAX_MIN_ORDER, parseDeliveryZones, parseFreeDeliveryFrom, parseMinOrder, parsePackagingPrices } from '@/lib/order-settings'

const KITCHEN_ROLES = [...MANAGER_ROLES, 'kuchnia']
const BAR_ROLES = [...MANAGER_ROLES, 'kelner']

type Body = { kitchenOpen?: unknown; barOpen?: unknown; autoHours?: unknown; closeBeforeMinutes?: unknown; openingHours?: unknown; minOrderOnline?: unknown; deliveryZones?: unknown; freeDeliveryFrom?: unknown; packagingPrices?: unknown; day?: unknown; orderingOverride?: unknown }

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Nieprawidłowe dane.' }, { status: 400 })

  const update: Record<string, unknown> = {}
  let roles: readonly string[] | null = null
  const require = (allowed: readonly string[]) => {
    roles = roles ? roles.filter((role) => allowed.includes(role)) : allowed
  }

  if (body.kitchenOpen !== undefined) {
    if (typeof body.kitchenOpen !== 'boolean') return NextResponse.json({ error: 'Nieprawidłowa wartość.' }, { status: 400 })
    update.kitchen_open = body.kitchenOpen
    require(KITCHEN_ROLES)
  }
  if (body.barOpen !== undefined) {
    if (typeof body.barOpen !== 'boolean') return NextResponse.json({ error: 'Nieprawidłowa wartość.' }, { status: 400 })
    update.bar_open = body.barOpen
    require(BAR_ROLES)
  }
  if (body.autoHours !== undefined) {
    if (typeof body.autoHours !== 'boolean') return NextResponse.json({ error: 'Nieprawidłowa wartość.' }, { status: 400 })
    update.auto_hours = body.autoHours
    require(MANAGER_ROLES)
  }
  if (body.closeBeforeMinutes !== undefined) {
    const value = body.closeBeforeMinutes
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > MAX_CLOSE_BEFORE_MINUTES) {
      return NextResponse.json({ error: `Podaj od 0 do ${MAX_CLOSE_BEFORE_MINUTES} minut.` }, { status: 400 })
    }
    update.close_before_minutes = value
    require(MANAGER_ROLES)
  }
  if (body.openingHours !== undefined) {
    const hours = parseOpeningHours(body.openingHours)
    if (!hours) return NextResponse.json({ error: 'Sprawdź godziny otwarcia (format GG:MM).' }, { status: 400 })
    update.opening_hours = hours
    require(MANAGER_ROLES)
  }
  if (body.minOrderOnline !== undefined) {
    const value = parseMinOrder(body.minOrderOnline)
    if (value === null) return NextResponse.json({ error: `Minimalne zamówienie: od 0 do ${MAX_MIN_ORDER} zł.` }, { status: 400 })
    update.min_order_online = value
    require(MANAGER_ROLES)
  }
  if (body.deliveryZones !== undefined) {
    const zones = parseDeliveryZones(body.deliveryZones)
    if (!zones) return NextResponse.json({ error: 'Sprawdź strefy dostawy – odległości muszą rosnąć, a ceny być poprawne.' }, { status: 400 })
    update.delivery_zones = zones
    require(MANAGER_ROLES)
  }
  if (body.freeDeliveryFrom !== undefined) {
    const value = parseFreeDeliveryFrom(body.freeDeliveryFrom)
    if (value === undefined) return NextResponse.json({ error: 'Próg darmowej dostawy: od 0 do 1000 zł.' }, { status: 400 })
    update.free_delivery_from = value
    require(MANAGER_ROLES)
  }
  if (body.packagingPrices !== undefined) {
    const prices = parsePackagingPrices(body.packagingPrices)
    if (!prices) return NextResponse.json({ error: 'Sprawdź ceny opakowań.' }, { status: 400 })
    update.packaging_prices = prices
    require(MANAGER_ROLES)
  }
  const day = body.day
  if (day !== undefined && day !== 'open' && day !== 'close') return NextResponse.json({ error: 'Nieprawidłowa akcja.' }, { status: 400 })
  if (day) require(BAR_ROLES)
  const override = body.orderingOverride
  if (override !== undefined) {
    if (typeof override !== 'boolean') return NextResponse.json({ error: 'Nieprawidłowa wartość.' }, { status: 400 })
    require(BAR_ROLES)
  }
  if (!roles) return NextResponse.json({ error: 'Brak zmian do zapisania.' }, { status: 400 })

  const auth = await authorizeRoles(roles)
  if ('response' in auth) return auth.response

  const admin = createAdminClient()
  const { data: current, error: loadError } = await admin.from('restaurant_settings').select(SETTINGS_COLUMNS).eq('id', 1).single()
  if (loadError || !current) return NextResponse.json({ error: 'Nie udało się wczytać ustawień lokalu.' }, { status: 503 })
  const row = current as SettingsRow

  let report: { id: string } | null = null
  if (day === 'open') {
    if (row.day_open) return NextResponse.json({ error: 'Dzień jest już otwarty.' }, { status: 409 })
    const openedAt = new Date().toISOString()
    if (!(await finalizePendingReport(admin, openedAt))) return NextResponse.json({ error: 'Nie udało się domknąć raportu poprzedniego dnia.' }, { status: 503 })
    Object.assign(update, { day_open: true, day_opened_at: openedAt, day_opened_by: auth.user.id, kitchen_open: true, bar_open: true })
  } else if (day === 'close') {
    if (!row.day_open || !row.day_opened_at) return NextResponse.json({ error: 'Dzień nie jest otwarty.' }, { status: 409 })
    const closedAt = new Date().toISOString()
    const summary = await buildDaySummary(admin, row.day_opened_at, closedAt, closedAt)
    if (!summary) return NextResponse.json({ error: 'Nie udało się przygotować raportu dnia.' }, { status: 503 })
    const { data: inserted, error: reportError } = await admin.from('day_reports').insert({ opened_at: row.day_opened_at, closed_at: closedAt, closed_by: auth.user.id, summary }).select('id').single()
    if (reportError || !inserted) return NextResponse.json({ error: 'Nie udało się zapisać raportu dnia.' }, { status: 503 })
    report = inserted
    Object.assign(update, { day_open: false, day_opened_at: null, day_opened_by: null, ordering_override_until: null })
  }

  if (override === false) update.ordering_override_until = null
  else if (override === true) {
    const settings = toSettings(row)
    if (!settings.dayOpen) return NextResponse.json({ error: 'Najpierw otwórz dzień.' }, { status: 409 })
    if (!settings.autoHours || isWithinHours(settings.openingHours, new Date(), settings.closeBeforeMinutes)) {
      return NextResponse.json({ error: 'Zamówienia są już przyjmowane w godzinach otwarcia.' }, { status: 409 })
    }
    update.ordering_override_until = nextOpeningAt(settings.openingHours, settings.closeBeforeMinutes).toISOString()
  }

  const { data, error } = await admin.from('restaurant_settings').update({ ...update, updated_at: new Date().toISOString() }).eq('id', 1).select(SETTINGS_COLUMNS).single()
  if (error || !data) return NextResponse.json({ error: 'Nie udało się zapisać zmian.' }, { status: 503 })
  return NextResponse.json({ status: computeStatus(toSettings(data as SettingsRow)), reportId: report?.id ?? null })
}
