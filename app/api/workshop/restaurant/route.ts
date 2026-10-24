import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { MANAGER_ROLES, authorizeRoles } from '@/lib/workshop-auth'
import { SETTINGS_COLUMNS, toSettings, type SettingsRow } from '@/lib/restaurant-state'
import { MAX_CLOSE_BEFORE_MINUTES, computeStatus, isWithinHours, nextOpeningAt, parseOpeningHours } from '@/lib/restaurant-status'
import { closeBusinessDay } from '@/lib/close-business-day'
import { cashReportPending } from '@/lib/cash-report'
import { ensureBusinessDay } from '@/lib/business-day-server'
import { MAX_MIN_ORDER, parseDeliveryZones, parseFreeDeliveryFrom, parseMinOrder, parsePackagingPrices } from '@/lib/order-settings'
import { PUBLIC_SETTINGS_TAG, invalidatesPublic } from '@/lib/public-cache'
import { parseVat } from '@/lib/vat'

const KITCHEN_ROLES = [...MANAGER_ROLES, 'kuchnia']
const BAR_ROLES = [...MANAGER_ROLES, 'kelner']

type Body = { kitchenOpen?: unknown; barOpen?: unknown; autoHours?: unknown; closeBeforeMinutes?: unknown; openingHours?: unknown; minOrderOnline?: unknown; deliveryZones?: unknown; freeDeliveryFrom?: unknown; packagingPrices?: unknown; packagingVat?: unknown; deliveryVat?: unknown; day?: unknown; skipCashReport?: unknown; orderingOverride?: unknown }

async function handlePATCH(request: Request) {
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
  for (const [field, column] of [['packagingVat', 'packaging_vat'], ['deliveryVat', 'delivery_vat']] as const) {
    if (body[field] === undefined) continue
    const vat = parseVat(body[field])
    if (!vat) return NextResponse.json({ error: 'Nieprawidłowa stawka VAT.' }, { status: 400 })
    update[column] = vat
    require(MANAGER_ROLES)
  }
  const day = body.day
  if (day !== undefined && day !== 'close' && day !== 'open') return NextResponse.json({ error: 'Nieprawidłowa akcja.' }, { status: 400 })
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
  if (!(await ensureBusinessDay(admin))) return NextResponse.json({ error: 'Nie udało się rozpocząć nowego dnia.' }, { status: 503 })
  const { data: current, error: loadError } = await admin.from('restaurant_settings').select(SETTINGS_COLUMNS).eq('id', 1).single()
  if (loadError || !current) return NextResponse.json({ error: 'Nie udało się wczytać ustawień lokalu.' }, { status: 503 })
  const row = current as SettingsRow

  if (day === 'open') {
    if (row.day_open) return NextResponse.json({ error: 'Dzień jest już otwarty.' }, { status: 409 })
    const pending = await cashReportPending(admin)
    if (pending === null) return NextResponse.json({ error: 'Nie udało się sprawdzić raportu kasowego.' }, { status: 503 })
    // A day closed automatically at midnight may be opened without the cash report ("kontynuuj mimo to").
    if (pending && !(row.day_auto_closed && body.skipCashReport === true)) {
      return NextResponse.json({ error: 'Najpierw zapisz raport kasowy poprzedniego dnia.', code: 'CASH_REPORT_PENDING' }, { status: 409 })
    }
    Object.assign(update, { day_open: true, day_opened_at: new Date().toISOString(), day_opened_by: auth.user.id, day_closed_at: null, day_auto_closed: false, kitchen_open: true, bar_open: true, ordering_override_until: null })
  }
  if (day === 'close') {
    const closed = await closeBusinessDay(admin, auth.user.id)
    if (!closed.ok) return NextResponse.json({ error: closed.error }, { status: closed.status })
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
  return NextResponse.json({ status: computeStatus(toSettings(data as SettingsRow)) })
}

export const PATCH = invalidatesPublic([PUBLIC_SETTINGS_TAG], handlePATCH)
