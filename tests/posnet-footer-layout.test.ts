import { describe, expect, it } from 'vitest'
import {
  commandsToLayout,
  defaultFooterLayout,
  deriveFooterSettings,
  layoutToCommands,
  parseFooterLayout,
  parsePosnetFooterCommands,
  parsePosnetNonFiscalFooterSettings,
  QR_DEFAULT_SIZE,
  type FooterLayoutItem,
} from '../lib/posnet-non-fiscal-footer'
import databaseRow from './fixtures-posnet-footer.json'

const stored = parsePosnetFooterCommands(databaseRow.commands)!

describe('POSNET footer layout editor', () => {
  it('round-trips the stored commands byte for byte', () => {
    const result = layoutToCommands(commandsToLayout(stored))
    expect(result).toEqual({ ok: true, commands: stored })
  })

  it('keeps the default layout: texts above the QR, free items first', () => {
    const kinds = defaultFooterLayout().map((item) => item.kind)
    expect(kinds[0]).toBe('free_items')
    expect(kinds.indexOf('qr')).toBeGreaterThan(kinds.lastIndexOf('separator'))
  })

  it('writes reordering, alignment, size and bold into the commands', () => {
    const layout = commandsToLayout(stored)
    const club = layout.findIndex((item) => item.kind === 'line' && item.text === 'YUMMY CLUB')
    layout[club] = { ...(layout[club] as Extract<FooterLayoutItem, { kind: 'line' }>), size: 'wide', bold: true }
    const [moved] = layout.splice(club, 1)
    layout.splice(1, 0, moved)
    const result = layoutToCommands(layout)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.commands[1]).toEqual({ type: 'line', text: 'YUMMY CLUB', posnet: '&c&b&sYUMMY CLUB&s&b&c', align: 'center', size: 'wide', bold: true })
    expect(parsePosnetFooterCommands(result.commands)).toEqual(result.commands)
  })

  it('converts legacy space-padded lines into explicit center alignment', () => {
    const legacy = parsePosnetFooterCommands([{ type: 'free_items' }, { type: 'line', text: '                 {orderNumber}', posnet: '                 {orderNumber}', align: 'left', size: 'normal' }])!
    const result = layoutToCommands(commandsToLayout(legacy))
    expect(result.ok && result.commands[1]).toMatchObject({ text: '{orderNumber}', align: 'center', posnet: '&c{orderNumber}&c' })
  })

  it('keeps the order number left-aligned when chosen, even in the large font', () => {
    const layout = commandsToLayout(stored).map((item) => (item.kind === 'line' && item.text === '{orderNumber}' ? { ...item, align: 'left' as const } : item))
    const result = layoutToCommands(layout)
    expect(result.ok && result.commands[3]).toMatchObject({ align: 'left', size: 'large', posnet: '&H&s{orderNumber}&s' })
  })

  it('stores the QR size only when it differs from the default', () => {
    const layout = commandsToLayout(stored).map((item) => (item.kind === 'qr' ? { ...item, size: 5 } : item))
    const result = layoutToCommands(layout)
    expect(result.ok && result.commands.find((command) => command.type === 'qr')).toMatchObject({ size: 5 })
    const defaultSized = layoutToCommands(commandsToLayout(stored).map((item) => (item.kind === 'qr' ? { ...item, size: QR_DEFAULT_SIZE } : item)))
    expect(defaultSized.ok && defaultSized.commands.find((command) => command.type === 'qr')).not.toHaveProperty('size')
  })

  it('rejects lines too long for their font size and out-of-range QR sizes', () => {
    expect(layoutToCommands([{ kind: 'line', text: 'Za długi tekst na duży font', align: 'left', size: 'large', bold: false }])).toMatchObject({ ok: false, index: 0 })
    expect(layoutToCommands([{ kind: 'qr', data: 'x', size: 12 }])).toMatchObject({ ok: false })
    expect(parsePosnetFooterCommands([{ type: 'qr', data: 'x', errorCorrection: 'M', size: 12 }])).toBeNull()
  })

  it('defaults legacy free items without style to left/normal/regular', () => {
    expect(parseFooterLayout([{ kind: 'free_items' }])).toEqual([{ kind: 'free_items', align: 'left', size: 'normal', bold: false }])
    expect(parsePosnetFooterCommands([{ type: 'free_items' }])).toEqual([{ type: 'free_items', align: 'left', size: 'normal', bold: false }])
  })

  it('derives valid compatibility settings without built-in lines', () => {
    const settings = deriveFooterSettings(stored)
    expect(settings).toEqual(databaseRow.settings)
    expect(parsePosnetNonFiscalFooterSettings(settings)).not.toBeNull()
  })
})
