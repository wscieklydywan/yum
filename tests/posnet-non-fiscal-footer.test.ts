import { describe, expect, it } from 'vitest'
import { buildPosnetNonFiscalCommands, parsePosnetFooterCommands, parsePosnetNonFiscalFooterSettings, toPosnetFormatted, updatePosnetFooterCommands } from '../lib/posnet-non-fiscal-footer'
import databaseRow from './fixtures-posnet-footer.json'

describe('POSNET non-fiscal footer commands', () => {
  it('builds lines aligned through the align field, never with padding spaces', () => {
    const settings = parsePosnetNonFiscalFooterSettings(databaseRow.settings)
    expect(settings).not.toBeNull()
    const commands = buildPosnetNonFiscalCommands(settings!)
    expect(commands.map((command) => command.type)).toEqual(databaseRow.commands.map((command) => command.type))
    for (const command of commands) {
      if (command.type === 'line') expect(command.text).toBe(command.text.trim())
    }
  })

  it('accepts the stored commands and keeps their order', () => {
    const commands = parsePosnetFooterCommands(databaseRow.commands)
    expect(commands).toHaveLength(15)
    expect(commands?.map((command) => command.type)).toEqual(databaseRow.commands.map((command) => command.type))
  })

  it('keeps the full {orderNumber} placeholder on the order number line', () => {
    const settings = parsePosnetNonFiscalFooterSettings(databaseRow.settings)!
    const numberLine = buildPosnetNonFiscalCommands(settings)[3]
    expect(numberLine).toMatchObject({ type: 'line', align: 'center', text: '{orderNumber}' })
    expect(databaseRow.commands[3]).toEqual({ type: 'line', text: '{orderNumber}', posnet: '&c&H&s{orderNumber}&s&H&c', align: 'center', size: 'large', bold: true })
  })

  it('keeps posnet in sync with align, size and bold of every stored line', () => {
    for (const command of parsePosnetFooterCommands(databaseRow.commands)!) {
      if (command.type === 'line') {
        expect(command.posnet).toBe(toPosnetFormatted(command.text.replace(/&/g, '&&'), command))
      }
    }
  })

  it('honours left alignment for a large line', () => {
    expect(toPosnetFormatted('{orderNumber}', { align: 'left', size: 'large', bold: false })).toBe('&H{orderNumber}')
  })

  it('closes every formatting toggle in reverse order', () => {
    expect(toPosnetFormatted('YUMMY CLUB', { align: 'center', size: 'wide', bold: true })).toBe('&c&b&sYUMMY CLUB&s&b&c')
    expect(toPosnetFormatted('tekst', { align: 'left', size: 'normal', bold: false })).toBe('tekst')
  })

  it('escapes & in free text', () => {
    const settings = parsePosnetNonFiscalFooterSettings({ lines: ['Frytki & sos'], qrTemplate: '' })!
    const line = buildPosnetNonFiscalCommands(settings).find((command) => command.type === 'line' && command.text.trim() === 'Frytki & sos')
    expect(line).toMatchObject({ text: 'Frytki & sos', align: 'center', posnet: '&cFrytki && sos&c' })
    expect(parsePosnetFooterCommands([line])).not.toBeNull()
  })

  describe('saving from the configurator', () => {
    const stored = parsePosnetFooterCommands(databaseRow.commands)!
    const previous = parsePosnetNonFiscalFooterSettings(databaseRow.settings)!

    it('keeps the 15 stored commands and their order when the layout is unchanged', () => {
      const result = updatePosnetFooterCommands(stored, previous, { ...previous })
      expect(result).toEqual({ ok: true, commands: stored, changed: false })
    })

    it('writes edited footer lines into commands, keeping everything else in place', () => {
      const result = updatePosnetFooterCommands(stored, previous, { ...previous, lines: ['Smacznego!', 'Zamówienie {orderNumber}'] })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.changed).toBe(true)
      expect(result.commands).toHaveLength(16)
      expect(result.commands[5]).toMatchObject({ type: 'line', text: 'Smacznego!', align: 'center', posnet: '&cSmacznego!&c' })
      expect(result.commands[6]).toMatchObject({ type: 'line', text: 'Zamówienie {orderNumber}', align: 'center' })
      expect(result.commands.slice(0, 5)).toEqual(stored.slice(0, 5))
      expect(result.commands.slice(7)).toEqual(stored.slice(6))
    })

    it('updates the QR command data', () => {
      const result = updatePosnetFooterCommands(stored, previous, { ...previous, qrTemplate: 'https://example.com/{orderNumber}' })
      expect(result.ok && result.commands.find((command) => command.type === 'qr')).toMatchObject({ data: 'https://example.com/{orderNumber}' })
    })

    it('patches a custom layout in place instead of regenerating it', () => {
      const custom = [...stored.slice(0, 12), { type: 'feed' as const, lines: 2 }, ...stored.slice(12)]
      const result = updatePosnetFooterCommands(custom, previous, { ...previous, lines: ['Do zobaczenia!'] })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.commands[5]).toMatchObject({ text: 'Do zobaczenia!', align: 'center' })
      expect(result.commands[12]).toEqual({ type: 'feed', lines: 2 })
      expect(result.commands).toHaveLength(custom.length)
    })

    it('prints www.yummyrybnik.pl right after the QR code', () => {
      const qrIndex = stored.findIndex((command) => command.type === 'qr')
      expect(stored[qrIndex + 1]).toMatchObject({ type: 'line', text: 'www.yummyrybnik.pl', align: 'center', posnet: '&cwww.yummyrybnik.pl&c' })
      expect(stored[qrIndex + 2]).toEqual({ type: 'feed', lines: 1 })
    })

    it('edits one line of a restyled footer by position, keeping its formatting and every other command', () => {
      const restyled = { type: 'line' as const, text: 'Dziękujemy za zamówienie!', align: 'left' as const, size: 'tall' as const, bold: true, posnet: '&h&sDziękujemy za zamówienie!&s&h' }
      const twoLines = { lines: ['Dziękujemy za zamówienie!', 'Smacznego!'], qrTemplate: previous.qrTemplate }
      const custom = [...stored.slice(0, 5), restyled, { type: 'line' as const, text: 'Smacznego!', align: 'center' as const, size: 'normal' as const, bold: false, posnet: '&cSmacznego!&c' }, { type: 'feed' as const, lines: 2 }, ...stored.slice(6)]
      const result = updatePosnetFooterCommands(custom, twoLines, { ...twoLines, lines: ['Dziękujemy!', 'Smacznego!'], qrTemplate: 'https://example.com/{orderNumber}' })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.commands).toHaveLength(custom.length)
      expect(result.commands[5]).toEqual({ ...restyled, text: 'Dziękujemy!', posnet: '&h&sDziękujemy!&s&h' })
      const qrIndex = custom.findIndex((command) => command.type === 'qr')
      result.commands.forEach((command, index) => {
        if (index === 5) return
        if (index === qrIndex) expect(command).toEqual({ ...custom[qrIndex], data: 'https://example.com/{orderNumber}' })
        else expect(command).toBe(custom[index])
      })
    })

    it('rejects an edit that no longer fits the line formatting instead of truncating it', () => {
      const wide = { type: 'line' as const, text: 'Dziękujemy!', align: 'center' as const, size: 'wide' as const, bold: false, posnet: '&c&bDziękujemy!&b&c' }
      const custom = [...stored.slice(0, 5), wide, { type: 'feed' as const, lines: 2 }, ...stored.slice(6)]
      const result = updatePosnetFooterCommands(custom, { ...previous, lines: ['Dziękujemy!'] }, { ...previous, lines: ['Dziękujemy za zamówienie, smacznego!'] })
      expect(result).toMatchObject({ ok: false })
    })

    it('refuses to toggle QR on a custom layout rather than dropping commands', () => {
      const custom = [...stored, { type: 'feed' as const, lines: 2 }]
      expect(updatePosnetFooterCommands(custom, previous, { ...previous, qrTemplate: '' })).toMatchObject({ ok: false })
    })
  })

  it('regenerates posnet from fields, normalizes legacy padding and rejects unknown tokens/types, unknown tokens and unknown types', () => {
    const base = { type: 'line', text: 'Test', align: 'center', size: 'normal', bold: true }
    expect(parsePosnetFooterCommands([{ ...base, posnet: '&c&sTest&s' }])).toEqual([{ ...base, posnet: '&c&sTest&s&c' }])
    expect(parsePosnetFooterCommands([{ type: 'line', text: '   Stary', posnet: '   Stary' }])).toEqual([{ type: 'line', text: 'Stary', align: 'center', size: 'normal', bold: false, posnet: '&cStary&c' }])
    expect(parsePosnetFooterCommands([{ ...base, size: 'large', text: '{orderNumber}', posnet: '&c&H&s{orderNumber}&s&H&c' }])).toEqual([{ ...base, size: 'large', text: '{orderNumber}', posnet: '&c&H&s{orderNumber}&s&c' }])
    expect(parsePosnetFooterCommands([{ ...base, text: '{orderNo}', posnet: '&c&s{orderNo}&s&c' }])).toBeNull()
    expect(parsePosnetFooterCommands([{ type: 'beep' }])).toBeNull()
    expect(parsePosnetFooterCommands([])).toBeNull()
    expect(parsePosnetFooterCommands([{ type: 'feed', lines: 0 }])).toBeNull()
  })
})
