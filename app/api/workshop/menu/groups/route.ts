import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'
import { ID_PATTERN, inList, integer, money, shortId, slugify, text } from '@/lib/workshop-menu'

type Station = 'kitchen' | 'cashier'
type OptionInput = { id?: string; name: string; price_delta: number; active: boolean; stations: Station[] | null }

function parseStations(value: unknown): Station[] | null | undefined {
  if (value === undefined || value === null) return null
  if (!Array.isArray(value) || value.length === 0 || value.length > 8) return undefined
  return value.every((station) => station === 'kitchen' || station === 'cashier') ? value as Station[] : undefined
}

function parseGroup(body: Record<string, unknown> | null) {
  if (!body) return null
  const name = text(body.name, 60)
  const mode = body.selection_mode === 'single' ? 'single' : body.selection_mode === 'multiple' ? 'multiple' : null
  const min = integer(body.min_selections, 0, 20) ?? 0
  const rawMax = integer(body.max_selections, 1, 50)
  if (!name || !mode || min === undefined || rawMax === undefined) return null
  const max = mode === 'single' ? 1 : rawMax
  const minSelections = mode === 'single' ? Math.min(min, 1) : min
  if (max !== null && max < minSelections) return null
  if (!Array.isArray(body.options) || body.options.length === 0 || body.options.length > 60) return null
  const options: OptionInput[] = []
  for (const raw of body.options) {
    const optionName = text(raw?.name, 80)
    const price = money(raw?.price_delta, 1000)
    const stations = parseStations(raw?.stations)
    if (!optionName || price === null || stations === undefined) return null
    options.push({ id: typeof raw?.id === 'string' && ID_PATTERN.test(raw.id) ? raw.id : undefined, name: optionName, price_delta: price, active: raw?.active !== false, stations })
  }
  const station = body.station === 'kitchen' ? 'kitchen' : body.station === 'cashier' ? 'cashier' : null
  if (!station) return null
  return { group: { name, selection_mode: mode, min_selections: minSelections, max_selections: max, station, active: body.active !== false }, options }
}

async function save(body: Record<string, unknown> | null, existingId?: string) {
  const parsed = parseGroup(body)
  if (!parsed) return NextResponse.json({ error: 'Podaj nazwę grupy, co najmniej jedną opcję i poprawne limity.' }, { status: 400 })
  const admin = createAdminClient()
  let id = existingId
  if (!id) {
    const { data: last } = await admin.from('menu_modifier_groups').select('sort').order('sort', { ascending: false }).limit(1).maybeSingle()
    id = `${slugify(parsed.group.name, 'grupa').replace(/-/g, '_')}_${shortId()}`
    const { error } = await admin.from('menu_modifier_groups').insert({ ...parsed.group, id, sort: (last?.sort ?? 0) + 1 })
    if (error) return NextResponse.json({ error: 'Nie udało się dodać grupy.' }, { status: 503 })
  } else {
    const { error } = await admin.from('menu_modifier_groups').update(parsed.group).eq('id', id)
    if (error) return NextResponse.json({ error: 'Nie udało się zapisać grupy.' }, { status: 503 })
  }

  const { data: existing } = await admin.from('menu_modifier_options').select('id').eq('group_id', id)
  const ownIds = new Set((existing ?? []).map((row) => row.id as string))
  const rows = parsed.options.map((option, index) => ({
    id: option.id && ownIds.has(option.id) ? option.id : `${id}_${slugify(option.name, 'opcja').replace(/-/g, '_')}_${shortId()}`,
    group_id: id,
    name: option.name,
    price_delta: option.price_delta,
    active: option.active,
    stations: option.stations,
    sort: index + 1,
  }))
  const removed = await admin.from('menu_modifier_options').delete().eq('group_id', id).not('id', 'in', inList(rows.map((row) => row.id)))
  const upserted = removed.error ? removed : await admin.from('menu_modifier_options').upsert(rows)
  if (upserted.error) return NextResponse.json({ error: 'Nie udało się zapisać opcji grupy.' }, { status: 503 })
  return NextResponse.json({ id }, { status: existingId ? 200 : 201 })
}

export async function POST(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  return save(await request.json().catch(() => null))
}

export async function PATCH(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!ID_PATTERN.test(id)) return NextResponse.json({ error: 'Brak grupy.' }, { status: 400 })
  return save(body, id)
}

export async function DELETE(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!ID_PATTERN.test(id)) return NextResponse.json({ error: 'Brak grupy.' }, { status: 400 })
  const { error } = await createAdminClient().from('menu_modifier_groups').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Nie udało się usunąć grupy.' }, { status: 503 })
  return NextResponse.json({ success: true })
}
