import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import {
  buildPosnetNonFiscalCommands,
  commandsToLayout,
  deriveFooterSettings,
  layoutToCommands,
  parseFooterLayout,
  parsePosnetFooterCommands,
  parsePosnetNonFiscalFooterSettings,
  sameCommands,
  updatePosnetFooterCommands,
  validateFooterCommandsForSave,
  type PosnetFooterCommand,
} from '@/lib/posnet-non-fiscal-footer'

const STAFF_ROLES = ['admin', 'szef', 'kelner']
const NO_STORE = { 'Cache-Control': 'no-store' }

async function authorize() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Zaloguj się ponownie.' }, { status: 401 }) }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!STAFF_ROLES.includes(profile?.role ?? '')) {
    return { error: NextResponse.json({ error: 'Brak uprawnień do ustawień drukarki.' }, { status: 403 }) }
  }
  return { admin: createAdminClient(), userId: user.id }
}

type Authorized = Exclude<Awaited<ReturnType<typeof authorize>>, { error: NextResponse }>

/**
 * Validates a full command list sent by the configurator. Each line is re-parsed into its style fields and rebuilt
 * through the layout pipeline, so the stored `posnet` string always matches `align`/`size`/`bold` exactly.
 */
function buildFromCommands(rawCommands: unknown) {
  const parsed = parsePosnetFooterCommands(rawCommands)
  if (!parsed) return { ok: false as const, error: 'Nieprawidłowe komendy stopki (typy, rozmiary, długość linii lub kody POSNET).' }
  const invalid = validateFooterCommandsForSave(parsed)
  if (invalid) return { ok: false as const, error: invalid }
  return layoutToCommands(commandsToLayout(parsed))
}

/**
 * Full layout editor: order, alignment, size and bold of every line plus the QR size. The server validates or
 * rebuilds the POSNET strings itself and stores them in `commands` (what the APK prints); `settings` is derived
 * for older APKs.
 */
async function saveCommands(auth: Authorized, body: { layout?: unknown; commands?: unknown }) {
  let built: ReturnType<typeof layoutToCommands>
  if ('commands' in body) {
    built = buildFromCommands(body.commands)
  } else {
    const layout = parseFooterLayout(body.layout)
    if (!layout) return NextResponse.json({ error: 'Nieprawidłowy układ stopki.' }, { status: 400 })
    built = layoutToCommands(layout)
  }
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 })

  const settings = deriveFooterSettings(built.commands)
  if (!parsePosnetNonFiscalFooterSettings(settings)) return NextResponse.json({ error: 'Nie udało się przygotować ustawień zgodności.' }, { status: 400 })

  const { data: current, error: readError } = await auth.admin.from('posnet_non_fiscal_settings').select('commands').eq('id', 1).maybeSingle()
  if (readError || !current) return NextResponse.json({ error: 'Nie udało się wczytać obecnych komend stopki POSNET.' }, { status: 503 })
  // Compare with the raw stored list, so normalizing legacy padding or `&H` codes counts as a change.
  const changed = !Array.isArray(current.commands) || !sameCommands(current.commands as PosnetFooterCommand[], built.commands)

  const { data, error } = await auth.admin
    .from('posnet_non_fiscal_settings')
    .update({ settings, commands: built.commands, updated_at: new Date().toISOString(), updated_by: auth.userId })
    .eq('id', 1)
    .select('settings, commands, updated_at')
    .maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Nie udało się zapisać wspólnego układu stopki POSNET.' }, { status: 503 })

  const savedCommands = parsePosnetFooterCommands(data.commands)
  if (!savedCommands || !sameCommands(savedCommands, built.commands)) {
    return NextResponse.json({ error: 'Baza nie potwierdziła zapisu komend stopki POSNET.' }, { status: 503 })
  }
  return NextResponse.json({ settings, commands: savedCommands, commandsChanged: changed, updatedAt: data.updated_at }, { headers: NO_STORE })
}

export async function GET() {
  const auth = await authorize()
  if ('error' in auth) return auth.error

  const { data, error } = await auth.admin.from('posnet_non_fiscal_settings').select('settings, commands, updated_at').eq('id', 1).maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Nie udało się wczytać wspólnych ustawień stopki POSNET.' }, { status: 503 })
  const settings = parsePosnetNonFiscalFooterSettings(data.settings)
  if (!settings) return NextResponse.json({ error: 'Ustawienia stopki POSNET w bazie są nieprawidłowe.' }, { status: 503 })

  const commands = data.commands == null ? buildPosnetNonFiscalCommands(settings) : parsePosnetFooterCommands(data.commands)
  if (!commands) return NextResponse.json({ error: 'Komendy stopki POSNET w bazie są nieprawidłowe.' }, { status: 503 })

  return NextResponse.json({ settings, commands, updatedAt: data.updated_at }, { headers: NO_STORE })
}

export async function PUT(request: Request) {
  const auth = await authorize()
  if ('error' in auth) return auth.error

  const body = (await request.json().catch(() => null)) as { settings?: unknown; layout?: unknown; commands?: unknown } | null
  if (body && ('commands' in body || 'layout' in body)) return saveCommands(auth, body)

  const settings = parsePosnetNonFiscalFooterSettings(body?.settings)
  if (!settings) {
    return NextResponse.json({ error: 'Ustawienia muszą zawierać maksymalnie 8 linii po 40 znaków oraz poprawny tekst QR.' }, { status: 400 })
  }

  const { data: current, error: readError } = await auth.admin.from('posnet_non_fiscal_settings').select('settings, commands').eq('id', 1).maybeSingle()
  if (readError || !current) return NextResponse.json({ error: 'Nie udało się wczytać obecnych komend stopki POSNET.' }, { status: 503 })

  // `commands` is what the APK prints, so every layout change must land there; unchanged layouts keep the stored list as-is.
  const update = updatePosnetFooterCommands(
    parsePosnetFooterCommands(current.commands),
    parsePosnetNonFiscalFooterSettings(current.settings),
    settings,
  )
  if (!update.ok) {
    return NextResponse.json({ error: `Nie zapisano: ${update.error} Komendy w bazie pozostały bez zmian.` }, { status: 409 })
  }

  const { data, error } = await auth.admin
    .from('posnet_non_fiscal_settings')
    .update({ settings, commands: update.commands, updated_at: new Date().toISOString(), updated_by: auth.userId })
    .eq('id', 1)
    .select('settings, commands, updated_at')
    .maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Nie udało się zapisać wspólnych ustawień stopki POSNET.' }, { status: 503 })

  const savedCommands = parsePosnetFooterCommands(data.commands)
  if (!savedCommands || JSON.stringify(savedCommands) !== JSON.stringify(parsePosnetFooterCommands(update.commands))) {
    return NextResponse.json({ error: 'Baza nie potwierdziła zapisu komend stopki POSNET.' }, { status: 503 })
  }

  return NextResponse.json({ settings, commands: savedCommands, commandsChanged: update.changed, updatedAt: data.updated_at }, { headers: NO_STORE })
}
