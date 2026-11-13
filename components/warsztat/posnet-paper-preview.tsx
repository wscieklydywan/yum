import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { POSNET_CHARS_PER_SIZE, POSNET_PAPER_WIDTH, renderFreeItemLines, type PosnetFooterCommand, type PosnetFreeItem, type PosnetLineSize, type PosnetPrintedLine } from '@/lib/posnet-non-fiscal-footer'

const sampleFreeItems: PosnetFreeItem[] = [{ name: 'Frytki', quantity: 1 }, { name: 'Sos czosnkowy & ketchup', quantity: 2 }]

const heightPerSize: Record<PosnetLineSize, number> = { normal: 1, wide: 1, tall: 2, large: 2, large_wide: 2, large_wide_tall: 3 }

/**
 * Character-grid preview of the non-fiscal printout: 40 columns at 9px. Each size scales the glyphs so a full line
 * fills the paper (wide ×2, large ×4 in width), and the scaled box keeps its real width, so `align` is honored for
 * every size — a large line is centered only when its own `align` is `center`.
 */
export function PosnetPaperPreview({ commands, qr }: { commands: PosnetFooterCommand[]; qr: ReactNode }) {
  return (
    <div className="mx-auto w-[40ch] bg-white px-0 py-3 font-mono text-[9px] leading-4 text-[#201d1a]" aria-label="Podgląd wydruku niefiskalnego">
      {commands.map((command, index) => {
        if (command.type === 'free_items') return <div key={index}>{renderFreeItemLines(command, sampleFreeItems).map((line, lineIndex) => <PreviewLine key={lineIndex} command={line} />)}</div>
        if (command.type === 'separator') return <div key={index} className="overflow-hidden whitespace-pre">{command.posnet}</div>
        if (command.type === 'feed') return <div key={index} style={{ height: `${command.lines}rem` }} aria-hidden />
        if (command.type === 'qr') return <div key={index} className="flex justify-center py-1">{qr}</div>
        return <PreviewLine key={index} command={command} />
      })}
    </div>
  )
}

function PreviewLine({ command }: { command: PosnetPrintedLine }) {
  const scaleX = POSNET_PAPER_WIDTH / POSNET_CHARS_PER_SIZE[command.size]
  const scaleY = heightPerSize[command.size]
  const length = Array.from(command.text).length

  return (
    <div
      className={cn('flex overflow-hidden', command.align === 'center' ? 'justify-center' : 'justify-start')}
      style={{ height: `${scaleY}rem` }}
      data-align={command.align}
      data-size={command.size}
    >
      <span className={'relative block shrink-0'} style={{ width: `${length * scaleX}ch`, height: `${scaleY}rem` }}>
        <span
          className={cn('absolute left-0 top-0 block origin-top-left whitespace-pre', command.bold && 'font-bold')}
          style={{ width: `${length}ch`, transform: `scale(${scaleX}, ${scaleY})` }}
        >
          {command.text}
        </span>
      </span>
    </div>
  )
}
