export type PosnetFreeItem = {
  itemId?: string
  name: string
  quantity: number
}

export type PosnetNonFiscalFooterSettings = {
  lines: string[]
  qrTemplate: string
}

export const DEFAULT_POSNET_NON_FISCAL_FOOTER: PosnetNonFiscalFooterSettings = {
  lines: ['Dziękujemy za zamówienie!'],
  qrTemplate: '',
}

const ORDER_NUMBER_TOKEN = '{orderNumber}'
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlySupportedTokens(value: string) {
  return !/[{}]/.test(value.replaceAll(ORDER_NUMBER_TOKEN, ''))
}

export function parsePosnetNonFiscalFooterSettings(value: unknown): PosnetNonFiscalFooterSettings | null {
  if (!isRecord(value) || !Array.isArray(value.lines) || typeof value.qrTemplate !== 'string') return null
  if (value.lines.length > 8 || value.lines.some((line) => typeof line !== 'string')) return null

  const lines = (value.lines as string[]).map((line) => line.trim()).filter(Boolean)
  if (lines.some((line) => Array.from(line).length > 40 || CONTROL_CHARACTERS.test(line) || !hasOnlySupportedTokens(line))) return null

  const qrTemplate = value.qrTemplate
  if (CONTROL_CHARACTERS.test(qrTemplate) || !hasOnlySupportedTokens(qrTemplate) || new TextEncoder().encode(qrTemplate).length > 2000) return null

  return { lines, qrTemplate }
}

export const POSNET_PAPER_WIDTH = 40
export const PARAGON_QR_URL = 'https://www.yummyrybnik.pl/yummy-club/instaluj?utm_source=qr&utm_campaign=paragon'
export const PARAGON_WEBSITE_TEXT = 'www.yummyrybnik.pl'

/**
 * Font sizes per POSNET spec (hdrset/ftrinfoset formatting):
 * normal = 40 chars, wide (&b) = 20 chars, tall (&h) = 40 chars double height, large (&H) = 10 chars,
 * large_wide (&H + &b) = 5 chars, large_wide_tall (&H + &b + &h) = 5 chars.
 * The two `large_wide*` combinations still need to be checked on the physical printer.
 */
export type PosnetLineSize = 'normal' | 'wide' | 'tall' | 'large' | 'large_wide' | 'large_wide_tall'

export type PosnetLineStyle = {
  align: 'left' | 'center'
  size: PosnetLineSize
  bold: boolean
}

/** Ordered non-fiscal print commands. The same list is stored in the database, so every tablet prints identically. */
export type PosnetFooterCommand =
  | ({ type: 'line'; text: string; posnet: string } & PosnetLineStyle)
  | { type: 'separator'; char: '=' | '-'; posnet: string }
  | ({ type: 'free_items' } & PosnetLineStyle)
  | { type: 'feed'; lines: number }
  | { type: 'qr'; data: string; errorCorrection: 'M'; size?: number }

export const DEFAULT_FREE_ITEMS_STYLE: PosnetLineStyle = { align: 'left', size: 'normal', bold: false }

/** QR module size in printer pixels. Missing `size` means the default, so older stored commands stay valid. */
export const QR_DEFAULT_SIZE = 3
export const QR_MIN_SIZE = 2
export const QR_MAX_SIZE = 8

export const POSNET_CHARS_PER_SIZE: Record<PosnetLineSize, number> = { normal: 40, wide: 20, tall: 40, large: 10, large_wide: 5, large_wide_tall: 5 }

const SIZE_MARKERS: Record<PosnetLineSize, { large: boolean; wide: boolean; tall: boolean }> = {
  normal: { large: false, wide: false, tall: false },
  wide: { large: false, wide: true, tall: false },
  tall: { large: false, wide: false, tall: true },
  large: { large: true, wide: false, tall: false },
  large_wide: { large: true, wide: true, tall: false },
  large_wide_tall: { large: true, wide: true, tall: true },
}

export const YUMMY_CLUB_PROMO_LINES: Array<{ text: string } & PosnetLineStyle> = [
  { text: 'YUMMY CLUB', align: 'center', size: 'wide', bold: true },
  { text: 'Zbieraj punkty za każde zamówienie', align: 'center', size: 'normal', bold: false },
  { text: 'i wymieniaj je na nagrody!', align: 'center', size: 'normal', bold: false },
  { text: 'Zeskanuj kod QR', align: 'center', size: 'normal', bold: true },
  { text: 'i zainstaluj aplikację Yummy', align: 'center', size: 'normal', bold: true },
]

function escapePosnet(text: string) {
  return text.replaceAll('&', '&&')
}

/**
 * Builds the POSNET formatted text (formformattedline / ftrinfoset syntax) for a line.
 * `&c`, `&b`, `&h` and `&s` are paired toggles closed in reverse order; `&H` (large font for the whole line) is a
 * single marker placed right after `&c` and never closed, e.g. `&c&H&b&h&sTEKST&s&h&b&c`. `&` in text becomes `&&`.
 */
export function toPosnetFormatted(text: string, style: PosnetLineStyle) {
  const markers = SIZE_MARKERS[style.size]
  const center = style.align === 'center' ? '&c' : ''
  const large = markers.large ? '&H' : ''
  const paired = [markers.wide ? '&b' : '', markers.tall ? '&h' : '', style.bold ? '&s' : ''].filter(Boolean)
  const closing = [...paired].reverse().join('') + center
  return `${center}${large}${paired.join('')}${escapePosnet(text)}${closing}`
}

/** Splits text into lines of at most `limit` characters, breaking on spaces and hard-splitting longer words. */
export function wrapPosnetText(text: string, limit: number): string[] {
  const lines: string[] = []
  let current = ''
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    let rest = Array.from(word)
    if (current && Array.from(current).length + 1 + rest.length <= limit) {
      current = `${current} ${word}`
      continue
    }
    if (current) lines.push(current)
    current = ''
    while (rest.length > limit) {
      lines.push(rest.slice(0, limit).join(''))
      rest = rest.slice(limit)
    }
    current = rest.join('')
  }
  if (current) lines.push(current)
  return lines
}

export function freeItemText(item: PosnetFreeItem) {
  return `GRATIS: ${item.name.trim()} ${item.quantity} x 0,00 zł`
}

export type PosnetPrintedLine = { text: string; posnet: string } & PosnetLineStyle

/**
 * Expands the `free_items` command for a concrete order: every free item is wrapped to the limit of the chosen size
 * and each printed line carries the same align/size/bold markers.
 */
export function renderFreeItemLines(command: Extract<PosnetFooterCommand, { type: 'free_items' }>, items: PosnetFreeItem[]): PosnetPrintedLine[] {
  const style: PosnetLineStyle = { align: command.align, size: command.size, bold: command.bold }
  const limit = POSNET_CHARS_PER_SIZE[style.size]
  return items.flatMap((item) => wrapPosnetText(freeItemText(item), limit)).map((text) => ({ text, posnet: toPosnetFormatted(text, style), ...style }))
}

/** Safe example order number used to check that `{orderNumber}` still fits the line after substitution. */
export const ORDER_NUMBER_SAMPLE = '#99999'

function printedLength(text: string) {
  return Array.from(text.replaceAll(ORDER_NUMBER_TOKEN, ORDER_NUMBER_SAMPLE)).length
}

/**
 * Hard save limit per size. The `large_wide*` limits (5 chars) are only estimated from the spec and not confirmed on
 * the printer, so they are a warning: such lines may be saved up to the confirmed `large` limit to test on paper.
 */
export function hardCharsLimit(size: PosnetLineSize) {
  return UNVERIFIED_LINE_SIZES.includes(size) ? POSNET_CHARS_PER_SIZE.large : POSNET_CHARS_PER_SIZE[size]
}

function line(text: string, style: PosnetLineStyle): PosnetFooterCommand {
  const limit = POSNET_CHARS_PER_SIZE[style.size]
  const fitted = text.includes(ORDER_NUMBER_TOKEN) ? text : Array.from(text).slice(0, limit).join('')
  return { type: 'line', text: fitted, posnet: toPosnetFormatted(fitted, style), ...style }
}

function separator(char: '=' | '-'): PosnetFooterCommand {
  const text = char.repeat(POSNET_PAPER_WIDTH)
  return { type: 'separator', char, posnet: text }
}

const CENTER: PosnetLineStyle = { align: 'center', size: 'normal', bold: false }

/** Alignment, size and bold live in the line fields (and the matching `&` codes in `posnet`), never in padding spaces. */
export function buildPosnetNonFiscalCommands(settings: PosnetNonFiscalFooterSettings, orderNumber = ORDER_NUMBER_TOKEN): PosnetFooterCommand[] {
  const commands: PosnetFooterCommand[] = [
    { type: 'free_items', ...DEFAULT_FREE_ITEMS_STYLE },
    separator('='),
    line(ORDER_LABEL_TEXT, CENTER),
    line(orderNumber, { align: 'center', size: 'large', bold: true }),
    separator('='),
    ...settings.lines.map((text) => line(renderPosnetFooterTemplate(text, orderNumber), CENTER)),
  ]
  if (settings.qrTemplate) {
    commands.push(
      separator('-'),
      ...YUMMY_CLUB_PROMO_LINES.map(({ text, ...style }) => line(text, style)),
      { type: 'qr', data: renderPosnetFooterTemplate(settings.qrTemplate, orderNumber), errorCorrection: 'M' },
      line(PARAGON_WEBSITE_TEXT, CENTER),
      { type: 'feed', lines: 1 },
    )
  }
  return commands
}

export const ORDER_LABEL_TEXT = 'NUMER ZAMÓWIENIA'

/**
 * Stricter checks for what the configurator is allowed to write: no alignment by spaces, the free-items block and
 * the order number must stay on the printout.
 */
export function validateFooterCommandsForSave(commands: PosnetFooterCommand[]): string | null {
  for (const [index, command] of commands.entries()) {
    if (command.type === 'line' && command.text !== command.text.trim()) {
      return `Linia ${index + 1} zaczyna się lub kończy spacją — użyj wyrównania zamiast spacji.`
    }
  }
  if (!commands.some((command) => command.type === 'free_items')) return 'Układ musi zawierać blok gratisów.'
  if (!commands.some((command) => command.type === 'line' && command.text.includes(ORDER_NUMBER_TOKEN))) {
    return 'Układ musi zawierać linię z numerem zamówienia ({orderNumber}).'
  }
  return null
}

export function renderPosnetFooterTemplate(template: string, orderNumber: string) {
  return template.replaceAll(ORDER_NUMBER_TOKEN, orderNumber)
}

const MAX_FOOTER_COMMANDS = 40
const LINE_SIZES: PosnetLineSize[] = ['normal', 'wide', 'tall', 'large', 'large_wide', 'large_wide_tall']

function isLineSize(value: unknown): value is PosnetLineSize {
  return typeof value === 'string' && LINE_SIZES.includes(value as PosnetLineSize)
}

/** Optional align/size/bold of a stored object; missing fields fall back to `fallback` (older stored commands). */
function parseStyle(value: Record<string, unknown>, fallback: PosnetLineStyle): PosnetLineStyle | null {
  const { align, size, bold } = value
  if (align !== undefined && align !== 'left' && align !== 'center') return null
  if (size !== undefined && !isLineSize(size)) return null
  if (bold !== undefined && typeof bold !== 'boolean') return null
  return { align: align ?? fallback.align, size: size ?? fallback.size, bold: bold ?? fallback.bold }
}

function parseCommand(value: unknown): PosnetFooterCommand | null {
  if (!isRecord(value)) return null
  switch (value.type) {
    case 'free_items': {
      const style = parseStyle(value, DEFAULT_FREE_ITEMS_STYLE)
      return style ? { type: 'free_items', ...style } : null
    }
    case 'feed': {
      const lines = value.lines
      return typeof lines === 'number' && Number.isInteger(lines) && lines >= 1 && lines <= 10 ? { type: 'feed', lines } : null
    }
    case 'separator': {
      if (value.char !== '=' && value.char !== '-') return null
      const posnet = value.char.repeat(POSNET_PAPER_WIDTH)
      return value.posnet === posnet ? { type: 'separator', char: value.char, posnet } : null
    }
    case 'qr': {
      const data = value.data
      if (typeof data !== 'string' || !data || CONTROL_CHARACTERS.test(data) || !hasOnlySupportedTokens(data)) return null
      if (new TextEncoder().encode(data).length > 2000 || value.errorCorrection !== 'M') return null
      if (value.size === undefined) return { type: 'qr', data, errorCorrection: 'M' }
      if (!isQrSize(value.size)) return null
      return { type: 'qr', data, errorCorrection: 'M', size: value.size }
    }
    case 'line': {
      const { text: rawText, align, size } = value
      if (typeof rawText !== 'string' || !rawText.trim()) return null
      if (align !== undefined && align !== 'left' && align !== 'center') return null
      if (size !== undefined && !isLineSize(size)) return null
      if (value.bold !== undefined && typeof value.bold !== 'boolean') return null
      // Legacy commands centered the text with leading spaces: read them as `align: 'center'` and drop the padding.
      const paddedCenter = rawText !== rawText.trimStart()
      const text = rawText.trim()
      if (CONTROL_CHARACTERS.test(text) || !hasOnlySupportedTokens(text)) return null
      const style: PosnetLineStyle = {
        align: align === 'center' || paddedCenter ? 'center' : 'left',
        size: (size as PosnetLineSize | undefined) ?? 'normal',
        bold: value.bold === true,
      }
      if (printedLength(text) > hardCharsLimit(style.size)) return null
      // `posnet` is always regenerated from the fields, so older strings (e.g. a closed `&H`) are normalized.
      return { type: 'line', text, posnet: toPosnetFormatted(text, style), ...style }
    }
    default:
      return null
  }
}

function sameFooterSettings(a: PosnetNonFiscalFooterSettings, b: PosnetNonFiscalFooterSettings) {
  return a.qrTemplate === b.qrTemplate && a.lines.length === b.lines.length && a.lines.every((text, index) => text === b.lines[index])
}

type PosnetLineCommand = Extract<PosnetFooterCommand, { type: 'line' }>

export function sameCommands(a: PosnetFooterCommand[], b: PosnetFooterCommand[]) {
  return JSON.stringify(a.map(sortKeys)) === JSON.stringify(b.map(sortKeys))
}

function sortKeys(command: PosnetFooterCommand) {
  return Object.fromEntries(Object.entries(command).sort(([a], [b]) => a.localeCompare(b)))
}

function lineStyle(command: PosnetLineCommand): PosnetLineStyle {
  return { align: command.align, size: command.size, bold: Boolean(command.bold) }
}

/** Re-renders a stored line with new text while keeping its own alignment, size, bold and inversion. */
function withText(command: PosnetLineCommand, text: string): PosnetLineCommand | null {
  const style = lineStyle(command)
  if (printedLength(text) > hardCharsLimit(style.size)) return null
  if (command.text !== command.text.trimStart()) style.align = 'center'
  return { type: 'line', text, posnet: toPosnetFormatted(text, style), ...style }
}

/**
 * Finds the one contiguous run of line commands whose texts are exactly the previous footer lines, in order.
 * Formatting is not compared, so a restyled footer is still found. Returns null when missing or ambiguous.
 */
function findLinesRun(commands: PosnetFooterCommand[], lines: string[]) {
  if (lines.length === 0) return null
  const starts: number[] = []
  for (let start = 0; start + lines.length <= commands.length; start++) {
    const matches = lines.every((text, offset) => {
      const command = commands[start + offset]
      return command.type === 'line' && command.text.trim() === text
    })
    if (matches) starts.push(start)
  }
  return starts.length === 1 ? starts[0] : null
}

/**
 * Patches footer lines by position inside the run: unchanged lines stay byte-for-byte, edited lines keep their
 * own formatting, new lines copy the style of the last existing footer line, removed lines are dropped.
 */
function patchFooterLines(commands: PosnetFooterCommand[], previous: string[], next: string[]): PosnetFooterCommand[] | string {
  const start = findLinesRun(commands, previous)
  if (start === null) return 'Nie znaleziono jednoznacznie linii stopki w komendach.'
  const run = commands.slice(start, start + previous.length) as PosnetLineCommand[]
  const patched: PosnetFooterCommand[] = []
  for (const [index, text] of next.entries()) {
    const original = run[Math.min(index, run.length - 1)]
    if (index < run.length && original.text.trim() === text) {
      patched.push(original)
      continue
    }
    const updated = withText(original, text)
    if (!updated) return `Linia „${text}” nie mieści się w formatowaniu tej linii na paragonie.`
    patched.push(updated)
  }
  return [...commands.slice(0, start), ...patched, ...commands.slice(start + previous.length)]
}

export type FooterCommandsUpdate =
  | { ok: true; commands: PosnetFooterCommand[]; changed: boolean }
  | { ok: false; error: string }

/**
 * Works out what to store in the `commands` column (the list the APK actually prints) after the configurator saves.
 * Stored commands and their order are kept untouched unless the layout really changed; a custom layout is only
 * patched in place (footer lines, QR content) and never silently replaced.
 */
export function updatePosnetFooterCommands(
  stored: PosnetFooterCommand[] | null,
  previous: PosnetNonFiscalFooterSettings | null,
  next: PosnetNonFiscalFooterSettings,
): FooterCommandsUpdate {
  if (!stored || !previous) return { ok: true, commands: buildPosnetNonFiscalCommands(next), changed: true }
  if (sameFooterSettings(previous, next)) return { ok: true, commands: stored, changed: false }
  if (sameCommands(stored, buildPosnetNonFiscalCommands(previous))) {
    return { ok: true, commands: buildPosnetNonFiscalCommands(next), changed: true }
  }

  let commands = stored
  if (previous.lines.join('\n') !== next.lines.join('\n')) {
    if (next.lines.length === 0) return { ok: false, error: 'Usunięcie wszystkich linii zmienia niestandardowy układ komend.' }
    const patched = patchFooterLines(commands, previous.lines, next.lines)
    if (typeof patched === 'string') return { ok: false, error: patched }
    commands = patched
  }
  if (previous.qrTemplate !== next.qrTemplate) {
    if (!previous.qrTemplate || !next.qrTemplate) return { ok: false, error: 'Włączenie lub wyłączenie QR zmienia niestandardowy układ komend.' }
    const qrIndex = commands.findIndex((command) => command.type === 'qr')
    if (qrIndex < 0) return { ok: false, error: 'Nie znaleziono komendy QR do aktualizacji.' }
    commands = commands.map((command, index) => (index === qrIndex && command.type === 'qr' ? { ...command, data: next.qrTemplate } : command))
  }
  return { ok: true, commands, changed: true }
}

function isQrSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= QR_MIN_SIZE && value <= QR_MAX_SIZE
}

/**
 * Editable form of the command list used by the configurator. Alignment, size and bold are stored in the `align`,
 * `size` and `bold` fields of each line (plus the matching POSNET codes in `posnet`). Legacy lines centered with
 * leading spaces are read as `align: 'center'` and saved without the spaces.
 */
export type FooterLayoutItem =
  | { kind: 'line'; text: string; align: 'left' | 'center'; size: PosnetLineSize; bold: boolean }
  | { kind: 'separator'; char: '=' | '-' }
  | ({ kind: 'free_items' } & PosnetLineStyle)
  | { kind: 'feed'; lines: number }
  | { kind: 'qr'; data: string; size: number }

export const LINE_SIZE_LABELS: Record<PosnetLineSize, string> = {
  normal: 'Normalny',
  wide: 'Szeroki',
  tall: 'Wysoki',
  large: 'Duży',
  large_wide: 'Duży szerszy',
  large_wide_tall: 'Duży szerszy i wyższy',
}

/** Sizes whose look on paper has not been confirmed on the printer yet. */
export const UNVERIFIED_LINE_SIZES: PosnetLineSize[] = ['large_wide', 'large_wide_tall']

export function commandsToLayout(commands: PosnetFooterCommand[]): FooterLayoutItem[] {
  return commands.map((command): FooterLayoutItem => {
    switch (command.type) {
      case 'line':
        return {
          kind: 'line',
          text: command.text.trim(),
          align: command.align === 'center' || command.text !== command.text.trimStart() ? 'center' : 'left',
          size: command.size,
          bold: Boolean(command.bold),
        }
      case 'separator':
        return { kind: 'separator', char: command.char }
      case 'free_items':
        return { kind: 'free_items', align: command.align, size: command.size, bold: command.bold }
      case 'feed':
        return { kind: 'feed', lines: command.lines }
      case 'qr':
        return { kind: 'qr', data: command.data, size: command.size ?? QR_DEFAULT_SIZE }
    }
  })
}

/** Characters still free on a line, counting `{orderNumber}` as the longest expected number. */
export function lineCharactersLeft(item: Extract<FooterLayoutItem, { kind: 'line' }>) {
  return POSNET_CHARS_PER_SIZE[item.size] - printedLength(item.text.trim())
}

export type LayoutBuildResult = { ok: true; commands: PosnetFooterCommand[] } | { ok: false; error: string; index?: number }

export function layoutToCommands(items: FooterLayoutItem[]): LayoutBuildResult {
  if (items.length === 0) return { ok: false, error: 'Układ nie może być pusty.' }
  if (items.length > MAX_FOOTER_COMMANDS) return { ok: false, error: `Maksymalnie ${MAX_FOOTER_COMMANDS} elementów.` }
  const commands: PosnetFooterCommand[] = []
  for (const [index, item] of items.entries()) {
    if (item.kind === 'line') {
      const text = item.text.trim()
      if (!text) return { ok: false, error: `Linia ${index + 1} jest pusta.`, index }
      if (CONTROL_CHARACTERS.test(text) || !hasOnlySupportedTokens(text)) return { ok: false, error: `Linia ${index + 1}: dozwolony placeholder to {orderNumber}.`, index }
      const limit = hardCharsLimit(item.size)
      const length = printedLength(text)
      if (length > limit) return { ok: false, error: `Linia ${index + 1} ma za dużo znaków dla rozmiaru „${LINE_SIZE_LABELS[item.size]}” (maks. ${limit}).`, index }
      const style: PosnetLineStyle = { align: item.align, size: item.size, bold: item.bold }
      commands.push({ type: 'line', text, posnet: toPosnetFormatted(text, style), ...style })
    } else if (item.kind === 'separator') {
      commands.push(separator(item.char))
    } else if (item.kind === 'free_items') {
      commands.push({ type: 'free_items', align: item.align, size: item.size, bold: item.bold })
    } else if (item.kind === 'feed') {
      if (!Number.isInteger(item.lines) || item.lines < 1 || item.lines > 10) return { ok: false, error: `Odstęp ${index + 1}: od 1 do 10 linii.`, index }
      commands.push({ type: 'feed', lines: item.lines })
    } else {
      const data = item.data.trim()
      if (!data) return { ok: false, error: 'Kod QR nie może być pusty — usuń go z układu, jeśli ma się nie drukować.', index }
      if (!isQrSize(item.size)) return { ok: false, error: `Rozmiar QR musi być od ${QR_MIN_SIZE} do ${QR_MAX_SIZE}.`, index }
      commands.push(item.size === QR_DEFAULT_SIZE ? { type: 'qr', data, errorCorrection: 'M' } : { type: 'qr', data, errorCorrection: 'M', size: item.size })
    }
  }
  const parsed = parsePosnetFooterCommands(commands)
  if (!parsed) return { ok: false, error: 'Układ zawiera niepoprawne elementy (np. więcej niż jeden QR lub blok gratisów, albo QR powyżej 2000 bajtów).' }
  const invalid = validateFooterCommandsForSave(parsed)
  if (invalid) return { ok: false, error: invalid }
  return { ok: true, commands: parsed }
}

/** Validates an untrusted layout sent by the configurator. */
export function parseFooterLayout(value: unknown): FooterLayoutItem[] | null {
  if (!Array.isArray(value) || value.length > MAX_FOOTER_COMMANDS) return null
  const items: FooterLayoutItem[] = []
  for (const raw of value) {
    if (!isRecord(raw)) return null
    switch (raw.kind) {
      case 'line': {
        if (typeof raw.text !== 'string' || raw.text.length > 200) return null
        if (raw.align !== 'left' && raw.align !== 'center') return null
        if (!isLineSize(raw.size)) return null
        if (typeof raw.bold !== 'boolean') return null
        items.push({ kind: 'line', text: raw.text, align: raw.align, size: raw.size, bold: raw.bold })
        break
      }
      case 'separator':
        if (raw.char !== '=' && raw.char !== '-') return null
        items.push({ kind: 'separator', char: raw.char })
        break
      case 'free_items': {
        const style = parseStyle(raw, DEFAULT_FREE_ITEMS_STYLE)
        if (!style) return null
        items.push({ kind: 'free_items', ...style })
        break
      }
      case 'feed':
        if (typeof raw.lines !== 'number') return null
        items.push({ kind: 'feed', lines: raw.lines })
        break
      case 'qr':
        if (typeof raw.data !== 'string' || typeof raw.size !== 'number') return null
        items.push({ kind: 'qr', data: raw.data, size: raw.size })
        break
      default:
        return null
    }
  }
  return items
}

/** Sizes offered in the configurator — every size supported by the APK. */
export const EDITABLE_LINE_SIZES: PosnetLineSize[] = [...LINE_SIZES]

/** Human label for a line based on its content, so the built-in texts are easy to find in the editor. */
export function describeFooterLine(text: string) {
  const trimmed = text.trim()
  if (trimmed.includes(ORDER_NUMBER_TOKEN)) return 'Numer zamówienia'
  if (trimmed === ORDER_LABEL_TEXT) return 'Etykieta numeru zamówienia'
  if (YUMMY_CLUB_PROMO_LINES.some((promo) => promo.text === trimmed)) return 'Yummy Club'
  if (trimmed === PARAGON_WEBSITE_TEXT) return 'Adres strony'
  return 'Linia tekstu'
}

const BUILT_IN_TEXTS = new Set([ORDER_LABEL_TEXT, ORDER_NUMBER_TOKEN, PARAGON_WEBSITE_TEXT, ...YUMMY_CLUB_PROMO_LINES.map(({ text }) => text)])

/**
 * Settings kept next to the commands for older APKs and the settings-based fallback: custom texts (without the
 * built-in order number, promo and website lines) and the QR content.
 */
export function deriveFooterSettings(commands: PosnetFooterCommand[]): PosnetNonFiscalFooterSettings {
  const lines = commands
    .flatMap((command) => (command.type === 'line' ? [command.text.trim()] : []))
    .filter((text) => !BUILT_IN_TEXTS.has(text) && Array.from(text).length <= POSNET_PAPER_WIDTH)
    .slice(0, 8)
  const qr = commands.find((command) => command.type === 'qr')
  return { lines, qrTemplate: qr?.type === 'qr' ? qr.data : '' }
}

/** Default layout from the migration: order number frame, thank-you line, Yummy Club promo above the QR. */
export function defaultFooterLayout() {
  return commandsToLayout(buildPosnetNonFiscalCommands({ lines: DEFAULT_POSNET_NON_FISCAL_FOOTER.lines, qrTemplate: PARAGON_QR_URL }))
}

/** Validates the ordered command list stored in the database before it is cached on a tablet. */
export function parsePosnetFooterCommands(value: unknown): PosnetFooterCommand[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_FOOTER_COMMANDS) return null
  const commands: PosnetFooterCommand[] = []
  for (const item of value) {
    const command = parseCommand(item)
    if (!command) return null
    commands.push(command)
  }
  if (commands.filter((command) => command.type === 'free_items').length > 1) return null
  if (commands.filter((command) => command.type === 'qr').length > 1) return null
  return commands
}
