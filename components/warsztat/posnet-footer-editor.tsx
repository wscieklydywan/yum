'use client'

import type { ReactNode } from 'react'
import { AlignCenter, AlignLeft, ArrowDown, ArrowUp, Bold, Gift, Minus, MoveVertical, Plus, QrCode, Trash2, Type } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  DEFAULT_FREE_ITEMS_STYLE,
  describeFooterLine,
  EDITABLE_LINE_SIZES,
  LINE_SIZE_LABELS,
  hardCharsLimit,
  lineCharactersLeft,
  PARAGON_QR_URL,
  POSNET_CHARS_PER_SIZE,
  QR_DEFAULT_SIZE,
  QR_MAX_SIZE,
  QR_MIN_SIZE,
  UNVERIFIED_LINE_SIZES,
  type FooterLayoutItem,
  type PosnetLineSize,
  type PosnetLineStyle,
} from '@/lib/posnet-non-fiscal-footer'

export type EditorItem = FooterLayoutItem & { id: string }

const MAX_ITEMS = 40
const fieldClass = 'h-9 min-w-0 rounded-lg border border-[#e5ded6] bg-white px-2.5 text-[13px] text-[#201d1a] outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30'
const iconButton = 'grid size-8 shrink-0 place-items-center rounded-md text-[#6f6963] transition-colors hover:bg-[#f3efea] hover:text-[#201d1a] disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
const qrSizes = Array.from({ length: QR_MAX_SIZE - QR_MIN_SIZE + 1 }, (_, index) => QR_MIN_SIZE + index)

let nextId = 0
export function withIds(items: FooterLayoutItem[]): EditorItem[] {
  return items.map((item) => ({ ...item, id: `footer-${nextId++}` }))
}

export function stripIds(items: EditorItem[]): FooterLayoutItem[] {
  return items.map(({ id: _id, ...item }) => item as FooterLayoutItem)
}

const kindMeta: Record<FooterLayoutItem['kind'], { label: string; icon: typeof Type }> = {
  line: { label: 'Linia tekstu', icon: Type },
  separator: { label: 'Separator', icon: Minus },
  free_items: { label: 'Gratisy', icon: Gift },
  feed: { label: 'Odstęp', icon: MoveVertical },
  qr: { label: 'Kod QR', icon: QrCode },
}

type Props = {
  items: EditorItem[]
  onChange: (items: EditorItem[]) => void
  errorIndex?: number
  disabled?: boolean
}

export function PosnetFooterEditor({ items, onChange, errorIndex, disabled }: Props) {
  const hasQr = items.some((item) => item.kind === 'qr')
  const hasFreeItems = items.some((item) => item.kind === 'free_items')
  const full = items.length >= MAX_ITEMS

  function update(id: string, patch: Partial<FooterLayoutItem>) {
    onChange(items.map((item) => (item.id === id ? ({ ...item, ...patch } as EditorItem) : item)))
  }

  function move(index: number, step: -1 | 1) {
    const target = index + step
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  function add(item: FooterLayoutItem) {
    if (full) return
    onChange([...items, ...withIds([item])])
  }

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-2" aria-label="Elementy wydruku niefiskalnego w kolejności drukowania">
        {items.map((item, index) => {
          const { label: kindLabel, icon: Icon } = kindMeta[item.kind]
          const label = item.kind === 'line' ? describeFooterLine(item.text) : kindLabel
          const locked = item.kind === 'free_items'
          return (
            <li key={item.id} className={cn('rounded-xl border bg-white p-2.5', index === errorIndex ? 'border-red-300 ring-2 ring-red-100' : 'border-[#ece5dd]')}>
              <div className="flex items-center gap-1.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-[#f3efea] text-[10px] font-bold tabular-nums text-[#6f6963]">{index + 1}</span>
                <Icon className="size-3.5 shrink-0 text-[#8b827a]" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#48423d]">{label}</span>
                <button type="button" className={iconButton} onClick={() => move(index, -1)} disabled={disabled || index === 0} aria-label={`Przesuń element ${index + 1} w górę`}><ArrowUp className="size-4" aria-hidden="true" /></button>
                <button type="button" className={iconButton} onClick={() => move(index, 1)} disabled={disabled || index === items.length - 1} aria-label={`Przesuń element ${index + 1} w dół`}><ArrowDown className="size-4" aria-hidden="true" /></button>
                <button type="button" className={cn(iconButton, 'hover:bg-red-50 hover:text-red-700')} onClick={() => onChange(items.filter((other) => other.id !== item.id))} disabled={disabled || locked || items.length <= 1} title={locked ? 'Blok gratisów jest wymagany' : undefined} aria-label={`Usuń element ${index + 1}`}><Trash2 className="size-4" aria-hidden="true" /></button>
              </div>
              <ItemFields item={item} disabled={disabled} onPatch={(patch) => update(item.id, patch)} />
            </li>
          )
        })}
      </ol>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dodaj element">
        <AddButton onClick={() => add({ kind: 'line', text: '', align: 'center', size: 'normal', bold: false })} disabled={disabled || full}>Linia</AddButton>
        <AddButton onClick={() => add({ kind: 'separator', char: '-' })} disabled={disabled || full}>Separator</AddButton>
        <AddButton onClick={() => add({ kind: 'feed', lines: 1 })} disabled={disabled || full}>Odstęp</AddButton>
        {!hasQr && <AddButton onClick={() => add({ kind: 'qr', data: PARAGON_QR_URL, size: QR_DEFAULT_SIZE })} disabled={disabled || full}>Kod QR</AddButton>}
        {!hasFreeItems && <AddButton onClick={() => add({ kind: 'free_items', ...DEFAULT_FREE_ITEMS_STYLE })} disabled={disabled || full}>Gratisy</AddButton>}
      </div>
    </div>
  )
}

function AddButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <Plus data-icon="inline-start" aria-hidden="true" />
      {children}
    </Button>
  )
}

function ItemFields({ item, onPatch, disabled }: { item: EditorItem; onPatch: (patch: Partial<FooterLayoutItem>) => void; disabled?: boolean }) {
  if (item.kind === 'line') {
    const left = lineCharactersLeft(item)
    const softOverflow = left < 0 && UNVERIFIED_LINE_SIZES.includes(item.size) && left >= POSNET_CHARS_PER_SIZE[item.size] - hardCharsLimit(item.size)
    const inputId = `${item.id}-text`
    return (
      <div className="mt-2 flex flex-col gap-2">
        <label htmlFor={inputId} className="sr-only">Tekst linii</label>
        <input
          id={inputId}
          value={item.text}
          onChange={(event) => onPatch({ text: event.target.value })}
          disabled={disabled}
          maxLength={60}
          placeholder="Tekst, np. Dziękujemy {orderNumber}"
          className={cn(fieldClass, 'w-full font-mono')}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <StyleControls id={item.id} style={item} disabled={disabled} onPatch={onPatch} />
          <span className={cn('ml-auto text-[11px] font-semibold tabular-nums', softOverflow ? 'text-amber-700' : left < 0 ? 'text-red-700' : 'text-[#9a928a]')} aria-live="polite">
            {left < 0 ? `${-left} zn. ponad szacowany limit` : `zostało ${left}`}
          </span>
        </div>
        {softOverflow && (
          <p role="status" className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-800">
            {`Limit ${POSNET_CHARS_PER_SIZE[item.size]} zn. dla tego rozmiaru jest tylko szacunkiem i nie był sprawdzony na kasie. Zapis jest dozwolony (do ${hardCharsLimit(item.size)} zn.) — wydrukuj próbę i sprawdź, czy tekst się nie ucina ani nie zawija.`}
          </p>
        )}
      </div>
    )
  }

  if (item.kind === 'separator') {
    return (
      <div className="mt-2 flex items-center gap-2">
        <label className="sr-only" htmlFor={`${item.id}-char`}>Znak separatora</label>
        <select id={`${item.id}-char`} value={item.char} disabled={disabled} onChange={(event) => onPatch({ char: event.target.value as '=' | '-' })} className={fieldClass}>
          <option value="=">{'===== podwójny'}</option>
          <option value="-">{'----- pojedynczy'}</option>
        </select>
      </div>
    )
  }

  if (item.kind === 'feed') {
    return (
      <div className="mt-2 flex items-center gap-2">
        <label className="text-[12px] text-[#6f6963]" htmlFor={`${item.id}-lines`}>Puste linie</label>
        <input id={`${item.id}-lines`} type="number" min={1} max={10} value={item.lines} disabled={disabled} onChange={(event) => onPatch({ lines: Number(event.target.value) })} className={cn(fieldClass, 'w-16 tabular-nums')} />
      </div>
    )
  }

  if (item.kind === 'free_items') {
    return (
      <div className="mt-2 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <StyleControls id={item.id} style={item} disabled={disabled} onPatch={onPatch} />
          <span className="ml-auto text-[11px] font-semibold tabular-nums text-[#9a928a]">zawijanie co {POSNET_CHARS_PER_SIZE[item.size]} zn.</span>
        </div>
        <p className="text-[11px] leading-relaxed text-[#8b827a]">Lista gratisów z zamówienia (wymagana — można ją tylko przesuwać). Każda pozycja jest wstawiana przy wydruku i zawijana do limitu wybranego rozmiaru, bez rabatu fiskalnego.</p>
      </div>
    )
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <label className="sr-only" htmlFor={`${item.id}-data`}>Treść kodu QR</label>
      <input
        id={`${item.id}-data`}
        value={item.data}
        onChange={(event) => onPatch({ data: event.target.value })}
        disabled={disabled}
        maxLength={1000}
        placeholder="https://yummyrybnik.pl/zamowienie/{orderNumber}"
        autoCapitalize="none"
        autoCorrect="off"
        className={cn(fieldClass, 'w-full')}
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[12px] text-[#6f6963]" htmlFor={`${item.id}-qr-size`}>Rozmiar</label>
        <select id={`${item.id}-qr-size`} value={item.size} disabled={disabled} onChange={(event) => onPatch({ size: Number(event.target.value) })} className={cn(fieldClass, 'tabular-nums')}>
          {qrSizes.map((size) => <option key={size} value={size}>{size} px{size === QR_DEFAULT_SIZE ? ' (domyślny)' : ''}</option>)}
        </select>
        {item.data !== PARAGON_QR_URL && (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onPatch({ data: PARAGON_QR_URL })}>Użyj QR „paragon”</Button>
        )}
      </div>
    </div>
  )
}

function sizeOptionLabel(size: PosnetLineSize) {
  const pending = UNVERIFIED_LINE_SIZES.includes(size) ? ' · do sprawdzenia na kasie' : ''
  return `${LINE_SIZE_LABELS[size]} · ${POSNET_CHARS_PER_SIZE[size]} zn.${pending}`
}

function StyleControls({ id, style, onPatch, disabled }: { id: string; style: PosnetLineStyle; onPatch: (patch: Partial<PosnetLineStyle>) => void; disabled?: boolean }) {
  return (
    <>
      <div className="inline-flex rounded-lg bg-[#f3efea] p-0.5" role="radiogroup" aria-label="Wyrównanie">
        {([['left', 'Do lewej', AlignLeft], ['center', 'Wyśrodkuj', AlignCenter]] as const).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={style.align === value}
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={() => onPatch({ align: value })}
            className={cn('grid size-8 place-items-center rounded-md transition-colors', style.align === value ? 'bg-white text-[#201d1a] shadow-sm' : 'text-[#7a726b] hover:text-[#201d1a]')}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        ))}
      </div>
      <label className="sr-only" htmlFor={`${id}-size`}>Rozmiar czcionki</label>
      <select id={`${id}-size`} value={style.size} disabled={disabled} onChange={(event) => onPatch({ size: event.target.value as PosnetLineSize })} className={cn(fieldClass, 'max-w-full pr-1')}>
        {EDITABLE_LINE_SIZES.map((size) => (
          <option key={size} value={size}>{sizeOptionLabel(size)}</option>
        ))}
      </select>
      <button
        type="button"
        aria-pressed={style.bold}
        aria-label="Pogrubienie"
        title="Pogrubienie"
        disabled={disabled}
        onClick={() => onPatch({ bold: !style.bold })}
        className={cn('grid size-9 place-items-center rounded-lg border transition-colors', style.bold ? 'border-[#201d1a] bg-[#201d1a] text-white' : 'border-[#e5ded6] bg-white text-[#6f6963] hover:text-[#201d1a]')}
      >
        <Bold className="size-4" aria-hidden="true" />
      </button>
    </>
  )
}
