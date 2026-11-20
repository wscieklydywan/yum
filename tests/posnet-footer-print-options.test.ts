import { describe, expect, it } from 'vitest'
import {
  parsePosnetFooterCommands,
  parsePosnetFooterPrintOptions,
  parsePosnetNonFiscalFooterSettings,
  placeLinkUnderQr,
  readPosnetFooterPrintOptions,
  type PosnetFooterCommand,
} from '../lib/posnet-non-fiscal-footer'
import databaseRow from './fixtures-posnet-footer.json'

describe('POSNET footer print options', () => {
  it('defaults both switches to off for older settings without the fields', () => {
    expect(readPosnetFooterPrintOptions(databaseRow.settings)).toEqual({ cutBeforeFooter: false, printCompanyHeader: false })
    expect(readPosnetFooterPrintOptions(null)).toEqual({ cutBeforeFooter: false, printCompanyHeader: false })
    expect(parsePosnetNonFiscalFooterSettings(databaseRow.settings)).not.toHaveProperty('cutBeforeFooter')
  })

  it('keeps stored switches in the settings and rejects non-boolean values', () => {
    const settings = parsePosnetNonFiscalFooterSettings({ ...databaseRow.settings, cutBeforeFooter: true, printCompanyHeader: false })
    expect(settings).toMatchObject({ cutBeforeFooter: true, printCompanyHeader: false })
    expect(readPosnetFooterPrintOptions(settings)).toEqual({ cutBeforeFooter: true, printCompanyHeader: false })
    expect(parsePosnetNonFiscalFooterSettings({ ...databaseRow.settings, cutBeforeFooter: 'yes' })).toBeNull()
  })

  it('validates switches sent by the configurator', () => {
    expect(parsePosnetFooterPrintOptions({ cutBeforeFooter: true })).toEqual({ cutBeforeFooter: true })
    expect(parsePosnetFooterPrintOptions({ cutBeforeFooter: undefined, printCompanyHeader: undefined })).toEqual({})
    expect(parsePosnetFooterPrintOptions({ printCompanyHeader: 1 })).toBeNull()
  })
})

describe('preview link under QR', () => {
  const stored = parsePosnetFooterCommands(databaseRow.commands)!

  it('keeps the order when the link already follows the QR', () => {
    const qrIndex = stored.findIndex((command) => command.type === 'qr')
    const next = stored[qrIndex + 1]
    if (next?.type === 'line' && /^(https?:\/\/|www\.)/i.test(next.text)) expect(placeLinkUnderQr(stored)).toEqual(stored)
  })

  it('moves the first http://, https:// or www. line directly under the QR', () => {
    for (const link of ['www.yummyrybnik.pl', 'https://yummyrybnik.pl', 'http://yummyrybnik.pl']) {
      const commands = parsePosnetFooterCommands([
        { type: 'line', text: link, posnet: link, align: 'center', size: 'normal', bold: false },
        { type: 'line', text: 'Hej', posnet: 'Hej', align: 'center', size: 'normal', bold: false },
        { type: 'qr', data: 'https://example.com', errorCorrection: 'M' },
        { type: 'feed', lines: 1 },
      ])!
      const ordered = placeLinkUnderQr(commands)
      expect(ordered.map((command: PosnetFooterCommand) => command.type)).toEqual(['line', 'qr', 'line', 'feed'])
      expect(ordered[2]).toMatchObject({ text: link })
      expect(commands[0]).toMatchObject({ text: link })
    }
  })

  it('ignores lines that only mention a domain', () => {
    const commands = parsePosnetFooterCommands([
      { type: 'qr', data: 'https://example.com', errorCorrection: 'M' },
      { type: 'line', text: 'Odwiedź yummyrybnik.pl', posnet: 'Odwiedź yummyrybnik.pl', align: 'center', size: 'normal', bold: false },
    ])!
    expect(placeLinkUnderQr(commands)).toEqual(commands)
  })
})
