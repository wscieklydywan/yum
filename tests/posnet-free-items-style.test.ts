import { describe, expect, it } from 'vitest'
import {
  commandsToLayout,
  deriveFooterSettings,
  layoutToCommands,
  parseFooterLayout,
  parsePosnetFooterCommands,
  POSNET_CHARS_PER_SIZE,
  renderFreeItemLines,
  toPosnetFormatted,
  wrapPosnetText,
  type FooterLayoutItem,
  type PosnetFooterCommand,
} from '../lib/posnet-non-fiscal-footer'
import databaseRow from './fixtures-posnet-footer.json'

const stored = parsePosnetFooterCommands(databaseRow.commands)!
const withLine = (line: FooterLayoutItem) => [...commandsToLayout(stored), line]
const lastCommand = (result: ReturnType<typeof layoutToCommands>) => (result.ok ? result.commands.at(-1) : result)

describe('free_items style', () => {
  it('saves align/size/bold directly in the free_items object', () => {
    const layout = commandsToLayout(stored).map((item): FooterLayoutItem => (item.kind === 'free_items' ? { ...item, align: 'center', size: 'wide', bold: true } : item))
    const result = layoutToCommands(layout)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const freeItems = result.commands.find((command) => command.type === 'free_items')
    expect(freeItems).toEqual({ type: 'free_items', align: 'center', size: 'wide', bold: true })
    expect(freeItems).not.toHaveProperty('posnet')
    expect(freeItems).not.toHaveProperty('text')
  })

  it('reads the style back from stored JSON and round-trips it', () => {
    const json = JSON.parse(JSON.stringify(stored.map((command) => (command.type === 'free_items' ? { type: 'free_items', align: 'center', size: 'large_wide_tall', bold: true } : command))))
    const commands = parsePosnetFooterCommands(json)!
    expect(commands).toEqual(json)
    expect(commands.find((command) => command.type === 'free_items')).toEqual({ type: 'free_items', align: 'center', size: 'large_wide_tall', bold: true })
    expect(layoutToCommands(commandsToLayout(commands))).toEqual({ ok: true, commands })
    expect(parseFooterLayout([{ kind: 'free_items', align: 'center', size: 'large_wide', bold: true }])).toEqual([{ kind: 'free_items', align: 'center', size: 'large_wide', bold: true }])
  })

  it('rejects invalid free_items style values', () => {
    expect(parsePosnetFooterCommands([{ type: 'free_items', size: 'huge' }])).toBeNull()
    expect(parsePosnetFooterCommands([{ type: 'free_items', align: 'right' }])).toBeNull()
    expect(parsePosnetFooterCommands([{ type: 'free_items', bold: 'yes' }])).toBeNull()
    expect(parseFooterLayout([{ kind: 'free_items', size: 'huge' }])).toBeNull()
  })

  it('keeps free items dynamic and wraps them to the size limit with the same markers', () => {
    const command = { type: 'free_items', align: 'center', size: 'wide', bold: true } as const
    const lines = renderFreeItemLines(command, [{ name: 'Frytki belgijskie & sos', quantity: 2 }])
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) {
      expect(Array.from(line.text).length).toBeLessThanOrEqual(20)
      expect(line.posnet).toBe(toPosnetFormatted(line.text, command))
      expect(line.posnet.startsWith('&c&b&s')).toBe(true)
      expect(line.posnet.endsWith('&s&b&c')).toBe(true)
    }
    expect(lines.map((line) => line.text).join(' ')).toBe('GRATIS: Frytki belgijskie & sos 2 x 0,00 zł')
    expect(lines.some((line) => line.posnet.includes('&&'))).toBe(true)
  })

  it('keeps the free_items command when deriving settings', () => {
    const commands: PosnetFooterCommand[] = [{ type: 'free_items', align: 'center', size: 'tall', bold: false }, { type: 'line', text: 'Hej', posnet: '&cHej&c', align: 'center', size: 'normal', bold: false }]
    expect(deriveFooterSettings(commands).lines).toEqual(['Hej'])
  })
})

describe('new sizes large_wide and large_wide_tall', () => {
  it('allows at most 5 characters', () => {
    expect(POSNET_CHARS_PER_SIZE.large_wide).toBe(5)
    expect(POSNET_CHARS_PER_SIZE.large_wide_tall).toBe(5)
    for (const size of ['large_wide', 'large_wide_tall'] as const) {
      const layout = withLine({ kind: 'line', text: 'HURRA', align: 'center', size, bold: false })
      expect(layoutToCommands(layout).ok).toBe(true)
      expect(layoutToCommands(withLine({ kind: 'line', text: 'HURRA!', align: 'center', size, bold: false }))).toMatchObject({ ok: false, index: layout.length - 1 })
    }
  })

  it('counts an escaped & as one character toward the limit', () => {
    expect(lastCommand(layoutToCommands(withLine({ kind: 'line', text: 'A & B', align: 'left', size: 'large_wide', bold: false })))).toMatchObject({ posnet: '&H&bA && B&b' })
  })

  it('wraps free items at 5 characters, hard-splitting long words', () => {
    expect(wrapPosnetText('Frytki XL', 5)).toEqual(['Frytk', 'i XL'])
    const lines = renderFreeItemLines({ type: 'free_items', align: 'left', size: 'large_wide_tall', bold: false }, [{ name: 'Cola', quantity: 1 }])
    for (const line of lines) expect(Array.from(line.text).length).toBeLessThanOrEqual(5)
  })
})

describe('POSNET marker format', () => {
  it('places &H once after &c and closes paired markers in reverse order', () => {
    expect(toPosnetFormatted('TEKST', { align: 'center', size: 'large_wide_tall', bold: true })).toBe('&c&H&b&h&sTEKST&s&h&b&c')
    expect(toPosnetFormatted('TEKST', { align: 'center', size: 'large_wide', bold: true })).toBe('&c&H&b&sTEKST&s&b&c')
    expect(toPosnetFormatted('TEKST', { align: 'left', size: 'large_wide_tall', bold: false })).toBe('&H&b&hTEKST&h&b')
    expect(toPosnetFormatted('TEKST', { align: 'center', size: 'large', bold: true })).toBe('&c&H&sTEKST&s&c')
    expect(toPosnetFormatted('TEKST', { align: 'center', size: 'tall', bold: false })).toBe('&c&hTEKST&h&c')
  })

  it('never closes &H and never pads with spaces', () => {
    const posnet = toPosnetFormatted('TEKST', { align: 'center', size: 'large_wide_tall', bold: true })
    expect(posnet.match(/&H/g)).toHaveLength(1)
    expect(posnet).not.toMatch(/^ | $/)
  })

  it('escapes & in text as &&', () => {
    expect(toPosnetFormatted('A&B', { align: 'center', size: 'normal', bold: false })).toBe('&cA&&B&c')
  })

  it('regenerates posnet for new sizes when parsing stored commands', () => {
    const parsed = parsePosnetFooterCommands([{ type: 'line', text: 'HEJ', posnet: 'HEJ', align: 'center', size: 'large_wide_tall', bold: true }])
    expect(parsed?.[0]).toMatchObject({ posnet: '&c&H&b&h&sHEJ&s&h&b&c' })
  })
})
