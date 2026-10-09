'use client'

import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Bike, CalendarClock, Check, Zap, ChevronLeft, ChevronRight, Gift, LoaderCircle, Minus, Plus, RotateCcw, Settings2, ShoppingBag, Store, Ticket, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { codeDiscount, describeCodeBenefit } from '@/lib/checkout-codes'
import { hasConfigurator, resolveSelection } from '@/lib/menu-config'
import type { Product } from '@/lib/menu'
import { cn } from '@/lib/utils'
import { WorkshopLineConfigurator, type LineSelection } from './workshop-line-configurator'
import { WorkshopPackagingPicker } from './workshop-packaging-picker'
import { packagingCount, packagingTotal, PACKAGING_KINDS, type PackagingCounts, type PackagingKind } from '@/lib/packaging'
import { orderSources, orderTypeMeta, type KitchenOrder, type OrderItem, type OrderSource, type OrderType } from './order-data'
import { useGroupedMenu } from './use-grouped-menu'
import { CategoryIcon } from './category-icon'
import { fetchWorkshopCode, normalizeCodeInput, type WorkshopCodePreview } from './workshop-code'

type ManualSource = Exclude<OrderSource, 'yummy'>
type Line = { key: number; productId: string; quantity: number; note: string } & Partial<LineSelection>

const sourceOptions: ManualSource[] = ['own', 'glovo', 'pyszne']
const typeOptions: OrderType[] = ['Stacjonarnie', 'Odbiór osobisty', 'Dostawa']
const typeIcons = { Stacjonarnie: Store, 'Odbiór osobisty': ShoppingBag, Dostawa: Bike } satisfies Record<OrderType, unknown>
const MAX_QUANTITY = 20
const fieldClass = 'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none transition focus-visible:ring-2 focus-visible:ring-ring'
const money = (value: number) => `${value.toFixed(2).replace('.', ',')} zł`
const pickerHours = Array.from({ length: 24 }, (_, index) => index + 1)
const pickerMinutes = Array.from({ length: 12 }, (_, index) => index * 5)
const toTimeValue = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
const isDesktopLayout = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches

function roundedFromNow(minutes: number) {
  const date = new Date(Date.now() + minutes * 60_000)
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0)
  return toTimeValue(date)
}

/** Today at the chosen time, or tomorrow if that time has already passed. */
function scheduledIso(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  if (date.getTime() < Date.now() - 5 * 60_000) date.setDate(date.getDate() + 1)
  return date.toISOString()
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialCode?: WorkshopCodePreview | null
  /** Called after the order is saved, so the parent can start a fresh draft. */
  onSubmitted?: () => void
  /** When set, the dialog edits this order: existing items can be changed and new ones added. */
  editOrder?: KitchenOrder | null
  /** Opens the off-menu item form for the edited order. */
  onCustomItem?: () => void
}

type ExistingLine = { index: number; item: OrderItem; quantity: number; options: string; cancelled: boolean }

const initialExisting = (order: KitchenOrder | null | undefined): ExistingLine[] =>
  (order?.items ?? []).flatMap((item, index) => item.cancelled ? [] : [{ index, item, quantity: item.quantity, options: item.options ?? '', cancelled: false }])

export function WorkshopNewOrderDialog({ open, onOpenChange, initialCode = null, onSubmitted, editOrder = null, onCustomItem }: Props) {
  const editing = Boolean(editOrder)
  const [existing, setExisting] = useState<ExistingLine[]>(() => initialExisting(editOrder))
  const { products, groups, isLoading } = useGroupedMenu({ includeUnavailable: true })
  const [mobileStep, setMobileStep] = useState<'menu' | 'summary'>('menu')
  const [source, setSource] = useState<ManualSource>('own')
  const [type, setType] = useState<KitchenOrder['type']>(initialCode ? 'Stacjonarnie' : 'Odbiór osobisty')
  const [customer, setCustomer] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [externalNumber, setExternalNumber] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [code, setCode] = useState<WorkshopCodePreview | null>(initialCode)
  const [codeInput, setCodeInput] = useState('')
  const [checkingCode, setCheckingCode] = useState(false)
  const [codeError, setCodeError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [when, setWhen] = useState<'asap' | 'scheduled'>('asap')
  const [time, setTime] = useState('')
  const [timePickerOpen, setTimePickerOpen] = useState(true)
  const [activeKey, setActiveKey] = useState<number | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [packagingAdjust, setPackagingAdjust] = useState<PackagingCounts>({})
  const canSchedule = type !== 'Stacjonarnie'
  const scheduledFor = canSchedule && when === 'scheduled' ? scheduledIso(time) : null

  const productById = new Map(products.map((product) => [product.id, product]))
  const resolveLine = (line: Line, product: Product | undefined) => product && hasConfigurator(product) ? resolveSelection(product, { variantId: line.variantId, modifiers: line.modifiers ?? {} }) : null
  const unitPriceOf = (line: Line) => {
    const product = productById.get(line.productId)
    const resolved = resolveLine(line, product)
    return resolved?.ok ? resolved.unitPrice : product?.price ?? 0
  }
  const existingSubtotal = existing.reduce((sum, line) => line.cancelled ? sum : sum + (line.item.unitPrice ?? 0) * (line.quantity - (line.item.refunded ?? 0)), 0)
  const existingChanges = existing.filter((line) => line.cancelled || line.quantity !== line.item.quantity || line.options.trim() !== (line.item.options ?? ''))
  const foodSubtotal = lines.reduce((sum, line) => sum + unitPriceOf(line) * line.quantity, 0) + existingSubtotal
  // Packaging is always added by hand at the bar – nothing is counted automatically.
  const packagingAuto: PackagingCounts = {}
  const packaging: PackagingCounts = Object.fromEntries(PACKAGING_KINDS.map((kind) => [kind, Math.max(0, (packagingAuto[kind] ?? 0) + (packagingAdjust[kind] ?? 0))]))
  const packagingSum = packagingTotal(packaging)
  const subtotal = foodSubtotal + packagingSum
  const invalidLine = lines.find((line) => resolveLine(line, productById.get(line.productId))?.ok === false)
  const activeLine = lines.find((line) => line.key === activeKey)
  const activeProduct = activeLine && productById.get(activeLine.productId)
  const discount = editing ? Math.min(editOrder?.discount ?? 0, subtotal) : codeDiscount(foodSubtotal, code)
  const total = subtotal - discount + (editing ? editOrder?.deliveryFee ?? 0 : 0)
  const liveExisting = existing.filter((line) => !line.cancelled).length
  const hasItems = lines.length > 0 || Boolean(code?.items.length) || liveExisting > 0
  const canSubmit = editing ? (lines.length > 0 || existingChanges.length > 0 || packagingCount(packaging) > 0) && hasItems : hasItems
  const category = groups.find((group) => group.id === categoryId) ?? null
  const quantityOf = (productId: string) => lines.reduce((sum, line) => line.productId === productId ? sum + line.quantity : sum, 0)
  const typeMeta = orderTypeMeta[type]
  const TypeIcon = typeIcons[type]

  function chooseSource(next: ManualSource) {
    setSource(next)
    if (next !== 'own') {
      if (type === 'Stacjonarnie') setType('Dostawa')
      setCode(null)
    }
  }

  function addProduct(productId: string) {
    if (quantityOf(productId) >= MAX_QUANTITY) return
    const product = productById.get(productId)
    if (product && hasConfigurator(product)) {
      const key = Date.now()
      setLines((current) => [...current, { key, productId, quantity: 1, note: '', variantId: product.variants?.[0]?.id, modifiers: {} }])
      // Mobile opens the configurator right away; desktop/tablet keeps it collapsed until "Opcje" is tapped.
      if (!isDesktopLayout()) setActiveKey(key)
      return
    }
    setLines((current) => {
      const plain = current.find((line) => line.productId === productId && !line.note.trim())
      if (plain) return current.map((line) => line.key === plain.key ? { ...line, quantity: line.quantity + 1 } : line)
      return [...current, { key: Date.now(), productId, quantity: 1, note: '' }]
    })
  }

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line))
  }

  function serializeLines() {
    return lines.map(({ productId, quantity, note: lineNote, variantId, modifiers }) => ({ productId, quantity, note: lineNote.trim(), ...(variantId || modifiers ? { selection: { variantId, modifiers: modifiers ?? {} } } : {}) }))
  }

  function adjustPackaging(kind: PackagingKind, delta: number) {
    setPackagingAdjust((current) => {
      const auto = packagingAuto[kind] ?? 0
      const effective = Math.max(0, auto + (current[kind] ?? 0))
      return { ...current, [kind]: Math.max(0, effective + delta) - auto }
    })
  }

  function updateExisting(index: number, patch: Partial<ExistingLine>) {
    setExisting((current) => current.map((line) => line.index === index ? { ...line, ...patch } : line))
  }

  function clearAll() {
    setExisting(initialExisting(editOrder))
    setLines([])
    setActiveKey(null)
    setPackagingAdjust({})
    setCode(null)
    setCodeInput('')
    setCodeError('')
    setCustomer('')
    setPhone('')
    setAddress('')
    setExternalNumber('')
    setNote('')
    setWhen('asap')
    setTime('')
    setCategoryId(null)
    setMobileStep('menu')
    setConfirmClear(false)
  }

  async function applyCode() {
    if (codeInput.length < 3 || checkingCode) return
    setCheckingCode(true)
    setCodeError('')
    try {
      setCode(await fetchWorkshopCode(codeInput))
      setCodeInput('')
    } catch (error) {
      setCodeError(error instanceof Error ? error.message : 'Nie udało się sprawdzić kodu.')
    } finally {
      setCheckingCode(false)
    }
  }

  function codeKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.keyCode === 229) return
    event.preventDefault()
    void applyCode()
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (editOrder) {
      if (!canSubmit || invalidLine) return
      setSubmitting(true)
      const response = await fetch(`/api/workshop/orders/${encodeURIComponent(editOrder.databaseId ?? editOrder.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: existingChanges.map((line) => line.cancelled ? { index: line.index, cancelled: true } : { index: line.index, quantity: line.quantity, options: line.options.trim() }),
          lines: serializeLines(),
          packaging,
        }),
      }).catch(() => null)
      setSubmitting(false)
      const result = (await response?.json().catch(() => null)) as { error?: string } | null
      if (!response?.ok) {
        toast.error(result?.error ?? 'Nie udało się zapisać zmian.')
        return
      }
      toast.success(`Zapisano zmiany w zamówieniu ${editOrder.id}`)
      onOpenChange(false)
      onSubmitted?.()
      return
    }
    if (!hasItems || invalidLine || (canSchedule && when === 'scheduled' && !scheduledFor)) return
    setSubmitting(true)
    const response = await fetch('/api/workshop/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, type, customer, phone, address, externalNumber, note, code: code?.code, scheduledFor, lines: serializeLines(), packaging }),
    }).catch(() => null)
    setSubmitting(false)
    const result = (await response?.json().catch(() => null)) as { orderNumber?: number; error?: string } | null
    if (!response?.ok) {
      toast.error(result?.error ?? 'Nie udało się dodać zamówienia.')
      return
    }
    toast.success(`Dodano zamówienie #${result?.orderNumber}`, { description: code ? `Kod ${code.code} wykorzystany · ${describeCodeBenefit(code)}` : orderSources[source].label })
    onOpenChange(false)
    onSubmitted?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-keep-size className="workshop-dashboard flex max-h-[94dvh] flex-col gap-4 overflow-hidden rounded-2xl p-4 max-sm:inset-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:pt-[max(1rem,env(safe-area-inset-top))] max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:ring-0 max-sm:data-open:zoom-in-100 sm:max-w-2xl sm:p-6 md:h-[95dvh] md:max-w-[min(100rem,97vw)] md:p-6 xl:p-7">
        <DialogHeader>
          <DialogTitle className="text-lg font-extrabold md:text-xl">{editOrder ? `Edytuj zamówienie ${editOrder.id}` : 'Nowe zamówienie'}</DialogTitle>
          <DialogDescription>{editOrder ? 'Zmień ilości, opis lub usuń pozycje po prawej. Nowe dania dodasz z menu po lewej.' : initialCode ? 'Kupon jest już nabity. Coś jeszcze? Dodaj kolejne pozycje dla klienta.' : 'Dodaj zamówienie własne albo przepisz je z Glovo lub Pyszne.pl. Trafi na koniec kolejki „Nowe”.'}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="-mx-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 sm:-mx-6 sm:px-6 md:mx-0 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-6 md:overflow-hidden md:px-0">
          <div className={cn('flex-col gap-4 md:flex md:min-h-0 md:overflow-y-auto md:pr-1', mobileStep === 'menu' ? 'flex' : 'hidden')}>
            {!editing && <>
            <fieldset className="flex flex-col">
              <legend className="mb-1.5 text-xs font-semibold">Źródło zamówienia</legend>
              <div className="grid grid-cols-3 gap-2">
                {sourceOptions.map((option) => {
                  const meta = orderSources[option]
                  return <label key={option} className={cn('flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 p-2 text-[11px] font-bold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring', source === option ? `source-option-${option}` : 'border-border hover:border-muted-foreground/40')}>
                    <input type="radio" name="source" value={option} checked={source === option} onChange={() => chooseSource(option)} className="sr-only" />
                    {meta.logo ? <img src={meta.logo} alt="" width={28} height={28} className="size-7 shrink-0" /> : <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-primary text-primary-foreground"><Store className="size-3.5" aria-hidden="true" /></span>}
                    <span className="truncate">{meta.label}</span>
                  </label>
                })}
              </div>
            </fieldset>

            <fieldset className="flex flex-col">
              <legend className="mb-1.5 text-xs font-semibold">Typ zamówienia</legend>
              <div className="grid grid-cols-3 gap-2">
                {typeOptions.map((option) => {
                  const meta = orderTypeMeta[option]
                  const Icon = typeIcons[option]
                  const disabled = option === 'Stacjonarnie' && source !== 'own'
                  return <label key={option} className={cn(`type-${meta.tone}`, 'flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2.5 text-xs font-bold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring', type === option ? 'type-badge border-transparent' : 'border-border hover:border-muted-foreground/40', disabled && 'cursor-not-allowed opacity-40')}>
                    <input type="radio" name="type" value={option} checked={type === option} disabled={disabled} onChange={() => setType(option)} className="sr-only" />
                    <Icon className="size-4 shrink-0" aria-hidden="true" />{meta.short}
                  </label>
                })}
              </div>
            </fieldset>

            {canSchedule && <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-xs font-semibold">Na kiedy</legend>
              <div className="grid grid-cols-2 gap-2">
                <label className={cn('flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2.5 text-xs font-bold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring', when === 'asap' ? 'border-foreground bg-foreground text-background' : 'border-border hover:border-muted-foreground/40')}>
                  <input type="radio" name="when" checked={when === 'asap'} onChange={() => setWhen('asap')} className="sr-only" />
                  <Zap className="size-4 shrink-0" aria-hidden="true" />Jak najszybciej
                </label>
                <label className={cn('flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2.5 text-xs font-bold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring', when === 'scheduled' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-border hover:border-muted-foreground/40')}>
                  <input type="radio" name="when" checked={when === 'scheduled'} onChange={() => { setWhen('scheduled'); setTimePickerOpen(true); if (!time) setTime(roundedFromNow(60)) }} className="sr-only" />
                  <CalendarClock className="size-4 shrink-0" aria-hidden="true" />Na godzinę
                </label>
              </div>
              {when === 'scheduled' && !timePickerOpen && scheduledFor && <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
                <CalendarClock className="size-5 shrink-0 text-emerald-700" aria-hidden="true" />
                <p className="flex-1 text-sm font-semibold text-emerald-900">Na godzinę <span className="font-mono text-lg font-black tabular-nums">{time}</span> <span className="text-xs font-medium text-emerald-800">· {new Date(scheduledFor).toDateString() === new Date().toDateString() ? 'dziś' : 'jutro'}</span></p>
                <button type="button" onClick={() => setTimePickerOpen(true)} className="h-9 rounded-lg border border-emerald-300 bg-white px-3 text-xs font-bold text-emerald-800 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Zmień</button>
              </div>}
              {when === 'scheduled' && (timePickerOpen || !scheduledFor) && <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 md:p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-emerald-900">Wybrana godzina <span className="ml-1 font-mono text-2xl font-black tabular-nums md:text-3xl">{time || '--:--'}</span></p>
                  {scheduledFor && <span className="text-sm font-medium text-emerald-800">{new Date(scheduledFor).toDateString() === new Date().toDateString() ? 'dziś' : 'jutro'}</span>}
                </div>
                <div role="radiogroup" aria-label="Godzina" className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 md:grid-cols-12">
                  {pickerHours.map((hour) => {
                    const value = hour === 24 ? '00' : String(hour).padStart(2, '0')
                    const selected = time.slice(0, 2) === value
                    return <button key={hour} type="button" role="radio" aria-checked={selected} onClick={() => setTime(`${value}:${time.slice(3, 5) || '00'}`)} className={cn('h-11 rounded-lg border text-base font-black tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-12 md:text-lg', selected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-100')}>{String(hour).padStart(2, '0')}</button>
                  })}
                </div>
                <div role="radiogroup" aria-label="Minuty" className="grid grid-cols-6 gap-1.5 md:grid-cols-12">
                  {pickerMinutes.map((minute) => {
                    const value = String(minute).padStart(2, '0')
                    const selected = time.slice(3, 5) === value
                    return <button key={minute} type="button" role="radio" aria-checked={selected} onClick={() => setTime(`${time.slice(0, 2) || '12'}:${value}`)} className={cn('h-11 rounded-lg border text-base font-bold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-12 md:text-lg', selected ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100')}>:{value}</button>
                  })}
                </div>
                <button type="button" disabled={!scheduledFor} onClick={() => setTimePickerOpen(false)} className="flex h-11 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 md:h-12"><Check className="size-4" aria-hidden="true" />Gotowe</button>
              </div>}
            </fieldset>}

            {(source !== 'own' || type !== 'Stacjonarnie') && <div className="grid gap-3 sm:grid-cols-2">
              {source !== 'own' && <label className="flex flex-col gap-1.5 text-xs font-semibold">Nr zamówienia {orderSources[source].label}
                <input value={externalNumber} onChange={(event) => setExternalNumber(event.target.value)} placeholder="np. A7F3K" maxLength={40} className={fieldClass} />
              </label>}
              {type !== 'Stacjonarnie' && <>
                <label className="flex flex-col gap-1.5 text-xs font-semibold">Imię klienta
                  <input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder={code?.customer ?? 'opcjonalnie'} maxLength={120} className={fieldClass} />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-semibold">Telefon
                  <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="opcjonalnie" maxLength={30} className={fieldClass} />
                </label>
              </>}
              {type === 'Dostawa' && <label className="flex flex-col gap-1.5 text-xs font-semibold sm:col-span-2">Adres dostawy
                <input required minLength={3} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="ul. Przykładowa 1, Rybnik" maxLength={200} className={fieldClass} />
              </label>}
            </div>}
            </>}

            {editing && onCustomItem && <Button type="button" variant="outline" className="h-11 justify-start self-start rounded-xl text-sm font-bold" onClick={onCustomItem}><Plus data-icon="inline-start" />Pozycja spoza menu</Button>}

            <section aria-labelledby="menu-picker-title" className="flex flex-col gap-2">
              <div className="flex min-h-11 items-center gap-2 md:min-h-12">
                {category ? <>
                  <button type="button" onClick={() => setCategoryId(null)} className="flex h-11 items-center gap-1.5 rounded-xl border-2 border-border bg-card pl-2 pr-4 text-sm font-bold transition-colors hover:border-foreground/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-12 md:text-base">
                    <ChevronLeft className="size-5" aria-hidden="true" />Kategorie
                  </button>
                  <span className="text-muted-foreground" aria-hidden="true">/</span>
                  <h3 id="menu-picker-title" className="truncate text-base font-extrabold md:text-lg">{category.label}</h3>
                </> : <h3 id="menu-picker-title" className="text-xs font-semibold">Wybierz kategorię</h3>}
              </div>

              {isLoading && <p className="flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />Ładowanie menu…</p>}

              {!category && <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:gap-3">
                {groups.map((group) => {
                  const inOrder = group.products.reduce((sum, product) => sum + quantityOf(product.id), 0)
                  return <li key={group.id}>
                    <button type="button" onClick={() => setCategoryId(group.id)} className="relative flex h-full w-full flex-col items-center gap-2 overflow-hidden rounded-xl border border-border bg-card px-2 pb-3 pt-3.5 text-center transition-colors hover:border-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-16 sm:flex-row sm:gap-2.5 sm:p-2.5 sm:text-left md:min-h-20 md:gap-3 md:p-3">
                      {inOrder > 0 && <span className="absolute right-2 top-2 grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-black tabular-nums text-primary-foreground sm:hidden" aria-hidden="true">{inOrder}</span>}
                      <CategoryIcon image={group.image} className="size-16 sm:size-11 md:size-14" />
                      <span className="flex w-full min-w-0 flex-1 flex-col items-center gap-0.5 sm:items-stretch sm:gap-1">
                        <span className="flex w-full min-w-0 items-start justify-center gap-2 text-sm font-extrabold leading-tight sm:justify-between md:text-base">
                          <span className="min-w-0 break-words [hyphens:auto]">{group.label}</span>
                          <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
                        </span>
                        <span className="text-[11px] font-medium text-muted-foreground">{group.products.length} poz.{inOrder > 0 && <span className="font-bold text-primary max-sm:sr-only"> · w zamówieniu {inOrder}</span>}</span>
                      </span>
                    </button>
                  </li>
                })}
              </ul>}

              {category && <ul className="flex flex-col gap-1.5">
                {category.products.map((product) => {
                  const count = quantityOf(product.id)
                  if (product.disabled) return <li key={product.id}>
                    <div aria-disabled="true" className="flex min-h-12 w-full cursor-not-allowed items-center gap-3 rounded-xl border border-red-200 bg-red-50/60 px-3 py-2 text-left md:min-h-16">
                      <span className="min-w-0 flex-1 text-sm font-bold leading-tight text-red-600 line-through decoration-2 md:text-[15px]">{product.name}</span>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-red-400 line-through">{money(product.price)}</span>
                      <span className="shrink-0 rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">Wyłączone</span>
                    </div>
                  </li>
                  return <li key={product.id}>
                    <button type="button" onClick={() => addProduct(product.id)} disabled={count >= MAX_QUANTITY} className={cn('flex min-h-12 w-full items-center gap-3 rounded-xl border bg-card px-3 py-2 text-left transition-colors hover:border-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 md:min-h-[4.5rem] md:gap-3.5 md:px-4 md:py-2.5', count > 0 ? 'border-primary/50' : 'border-border')}>
                      <span className="min-w-0 flex-1 text-sm font-bold leading-tight md:text-[17px]">{product.name}{hasConfigurator(product) && <span className="ml-1.5 inline-flex translate-y-[-1px] items-center gap-0.5 rounded bg-muted px-1 py-0.5 align-middle text-[10px] font-semibold text-muted-foreground"><Settings2 className="size-3" aria-hidden="true" />opcje</span>}</span>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground md:text-[15px]">{money(product.price)}</span>
                      {count > 0 ? <span className="grid h-7 min-w-7 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-xs font-black tabular-nums text-primary-foreground md:h-8 md:min-w-8 md:text-sm" aria-label={`W zamówieniu: ${count}`}>{count}</span>
                        : <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border text-muted-foreground md:size-8"><Plus className="size-3.5 md:size-4" aria-hidden="true" /></span>}
                    </button>
                  </li>
                })}
              </ul>}
            </section>

            {activeLine && activeProduct && hasConfigurator(activeProduct) && <section aria-label={`Opcje: ${activeProduct.name}`} className="flex flex-col gap-2 rounded-2xl border-2 border-primary/40 bg-card p-3 md:hidden">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-extrabold">{activeProduct.name} <span className="font-semibold tabular-nums text-muted-foreground">· {money(unitPriceOf(activeLine))}</span></p>
                <Button type="button" size="sm" onClick={() => setActiveKey(null)}>Gotowe</Button>
              </div>
              <WorkshopLineConfigurator product={activeProduct} value={{ variantId: activeLine.variantId, modifiers: activeLine.modifiers ?? {} }} onChange={(next) => updateLine(activeLine.key, next)} />
            </section>}

            <div className="sticky bottom-0 -mx-4 mt-auto border-t border-border bg-background/95 px-4 pb-1 pt-3 backdrop-blur sm:-mx-6 sm:px-6 md:hidden">
              <Button type="button" size="lg" className="h-12 w-full justify-between text-sm font-bold" onClick={() => setMobileStep('summary')}>
                <span className="flex items-center gap-2">
                  <span className="grid h-6 min-w-6 place-items-center rounded-full bg-primary-foreground/20 px-1.5 text-xs tabular-nums">{lines.reduce((sum, line) => sum + line.quantity, 0) + (code?.items.length ?? 0)}</span>
                  Dalej – podsumowanie
                </span>
                <span className="flex items-center gap-1 tabular-nums">{money(total)}<ChevronRight className="size-4" aria-hidden="true" /></span>
              </Button>
            </div>
          </div>

          <div className={cn(`type-${typeMeta.tone}`, mobileStep === 'summary' ? 'flex' : 'hidden', 'flex-col overflow-hidden md:flex rounded-2xl border border-[#e9e3dc] bg-[#fffdfa] shadow-[0_8px_28px_rgba(33,25,20,0.06)] md:min-h-0')}>
            <div className="type-band h-1.5 shrink-0" aria-hidden="true" />
            <div className="flex items-center justify-between gap-2 border-b border-[#f0ece7] px-4 py-3">
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setMobileStep('menu')} className="-ml-2 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden">
                  <ChevronLeft className="size-5" aria-hidden="true" /><span className="sr-only">Wróć do menu</span>
                </button>
                <h3 className="text-base font-black tracking-tight md:text-lg">Zamówienie</h3>
                {(editing ? canSubmit || lines.length > 0 : hasItems) && (confirmClear ? <span className="ml-2 flex items-center gap-1">
                  <span className="text-xs font-semibold text-destructive">{editing ? 'Cofnąć zmiany?' : 'Usunąć wszystko?'}</span>
                  <Button type="button" size="sm" variant="destructive" onClick={clearAll}>{editing ? 'Tak, cofnij' : 'Tak, wyczyść'}</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>Nie</Button>
                </span> : <Button type="button" size="sm" variant="outline" className="ml-2 text-destructive hover:text-destructive" onClick={() => setConfirmClear(true)}><RotateCcw data-icon="inline-start" />{editing ? 'Cofnij zmiany' : 'Wyczyść wszystko'}</Button>)}
              </div>
              <div className="flex items-center gap-1.5">
                {scheduledFor && <span className="inline-flex h-7 items-center gap-1 rounded-lg bg-emerald-600 px-2 text-[11px] font-bold text-white"><CalendarClock className="size-3.5" aria-hidden="true" />Na {time}</span>}
                {source !== 'own' && orderSources[source].logo && <img src={orderSources[source].logo} alt={orderSources[source].label} width={24} height={24} className="size-6 rounded-md" />}
                <span className="type-soft inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-[11px] font-bold uppercase tracking-wide"><TypeIcon className="size-3.5" aria-hidden="true" />{typeMeta.short}</span>
              </div>
            </div>

            <div className="flex flex-col px-4 md:min-h-0 md:flex-1 md:overflow-y-auto">
              {!hasItems && <p className="py-10 text-center text-sm text-muted-foreground">Wybierz kategorię i dotknij dania, aby dodać je do zamówienia.</p>}
              {editing && existing.length > 0 && <ul className="divide-y divide-[#f0ece7]" aria-label="Obecne pozycje">
                {existing.map((line) => {
                  const receipted = line.item.receipted ?? 0
                  const changed = line.quantity !== line.item.quantity || line.options.trim() !== (line.item.options ?? '')
                  return <li key={`existing-${line.index}`} className={cn('flex flex-col gap-2 py-3.5', line.cancelled && 'opacity-60')}>
                    <div className="flex items-center gap-2 text-[13px] md:text-sm">
                      {line.cancelled ? <span className="w-[5.25rem] shrink-0 text-center text-xs font-bold text-destructive">usunięte</span> : <div className="flex shrink-0 items-center rounded-lg border border-input bg-background">
                        <button type="button" aria-label={`Zmniejsz ilość: ${line.item.name}`} disabled={line.quantity <= Math.max(1, receipted)} onClick={() => updateExisting(line.index, { quantity: line.quantity - 1 })} className="grid size-9 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30 md:size-10"><Minus className="size-4" aria-hidden="true" /></button>
                        <span className="w-6 text-center text-sm font-bold tabular-nums">{line.quantity}</span>
                        <button type="button" aria-label={`Zwiększ ilość: ${line.item.name}`} disabled={line.quantity >= 50} onClick={() => updateExisting(line.index, { quantity: line.quantity + 1 })} className="grid size-9 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30 md:size-10"><Plus className="size-4" aria-hidden="true" /></button>
                      </div>}
                      <div className="min-w-0 flex-1">
                        <p className={cn('font-bold leading-tight', line.cancelled && 'line-through')}>{line.item.name}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {changed && !line.cancelled ? <span className="font-semibold text-primary">zmieniono · </span> : null}
                          {receipted > 0 ? `na paragonie: ${receipted} szt.` : line.item.packaging ? 'opakowanie' : line.item.done ? 'już wydane z kuchni' : 'w realizacji'}
                        </p>
                      </div>
                      {typeof line.item.unitPrice === 'number' && <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground md:text-sm">{money(line.item.unitPrice * (line.cancelled ? 0 : line.quantity))}</span>}
                      {line.cancelled ? <Button type="button" size="sm" variant="outline" onClick={() => updateExisting(line.index, { cancelled: false })}><RotateCcw data-icon="inline-start" />Przywróć</Button>
                        : <button type="button" aria-label={`Usuń pozycję ${line.item.name}`} disabled={receipted > 0} title={receipted > 0 ? 'Pozycja jest na paragonie – zrób zwrot' : undefined} onClick={() => updateExisting(line.index, { cancelled: true })} className="grid size-9 shrink-0 place-items-center rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-30 md:size-11"><Trash2 className="size-4 md:size-5" aria-hidden="true" /></button>}
                    </div>
                    {!line.cancelled && <input aria-label={`Opis pozycji ${line.item.name}`} value={line.options} disabled={receipted > 0} onChange={(event) => updateExisting(line.index, { options: event.target.value })} placeholder="Opcje / uwagi, np. double, sos BBQ, bez cebuli" maxLength={200} className="h-9 w-full rounded-lg border border-transparent bg-[#f5f2ee] px-3 text-xs outline-none transition placeholder:text-[#9a918a] focus-visible:border-input focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" />}
                  </li>
                })}
              </ul>}
              {editing && lines.length > 0 && <p className="border-t border-[#f0ece7] pt-3 text-[11px] font-bold uppercase tracking-wide text-primary">Nowe pozycje</p>}
              <ul className="divide-y divide-[#f0ece7]" aria-label="Pozycje zamówienia">
                {code?.items.map((item) => <li key={`code-${item.name}`} className="flex items-center gap-3 py-3.5 text-[13px]">
                  <span className="w-6 shrink-0 font-semibold tabular-nums">{item.quantity}×</span>
                  <span className="min-w-0 flex-1 truncate font-bold">{item.name}</span>
                  <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-primary"><Gift className="size-3.5" aria-hidden="true" />gratis · {code.code}</span>
                </li>)}
                {lines.map((line) => {
                  const product = productById.get(line.productId)
                  const name = product?.name ?? 'Pozycja'
                  const configurable = Boolean(product && hasConfigurator(product))
                  const resolved = resolveLine(line, product)
                  const isActive = line.key === activeKey
                  return <li key={line.key} className={cn('flex flex-col gap-2 py-3.5', isActive && 'md:-mx-2 md:rounded-xl md:bg-primary/[0.04] md:px-2')}>
                    <div className="flex items-center gap-2 text-[13px] md:text-sm">
                      <div className="flex shrink-0 items-center rounded-lg border border-input bg-background">
                        <button type="button" aria-label={`Zmniejsz ilość: ${name}`} disabled={line.quantity <= 1} onClick={() => updateLine(line.key, { quantity: line.quantity - 1 })} className="grid size-9 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30"><Minus className="size-4" aria-hidden="true" /></button>
                        <span className="w-6 text-center text-sm font-bold tabular-nums">{line.quantity}</span>
                        <button type="button" aria-label={`Zwiększ ilość: ${name}`} disabled={quantityOf(line.productId) >= MAX_QUANTITY} onClick={() => updateLine(line.key, { quantity: line.quantity + 1 })} className="grid size-9 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30"><Plus className="size-4" aria-hidden="true" /></button>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold leading-tight">{name}</p>
                        {configurable && !isActive && <p className={cn('mt-0.5 text-[11px] leading-snug', resolved?.ok === false ? 'font-semibold text-destructive' : 'text-muted-foreground')}>{resolved?.ok ? resolved.details.join(' · ') || 'bez dodatków' : resolved?.error}</p>}
                      </div>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground md:text-sm">{money(unitPriceOf(line) * line.quantity)}</span>
                      {configurable && <button type="button" aria-expanded={isActive} onClick={() => setActiveKey(isActive ? null : line.key)} className={cn('flex h-9 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10 md:px-3 md:text-[13px]', isActive ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-primary text-primary-foreground hover:bg-primary/90')}>
                        {isActive ? <Check className="size-4" aria-hidden="true" /> : <Settings2 className="size-4" aria-hidden="true" />}{isActive ? 'Gotowe' : 'Opcje'}
                      </button>}
                      <button type="button" aria-label={`Usuń pozycję ${name}`} onClick={() => { setLines((current) => current.filter((entry) => entry.key !== line.key)); if (isActive) setActiveKey(null) }} className="grid size-9 shrink-0 place-items-center rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 md:size-11"><Trash2 className="size-4 md:size-5" aria-hidden="true" /></button>
                    </div>
                    {configurable && isActive && product && <div className="hidden md:block">
                      <WorkshopLineConfigurator product={product} value={{ variantId: line.variantId, modifiers: line.modifiers ?? {} }} onChange={(next) => updateLine(line.key, next)} />
                    </div>}
                    {configurable && isActive && product && <div className="md:hidden">
                      <WorkshopLineConfigurator product={product} value={{ variantId: line.variantId, modifiers: line.modifiers ?? {} }} onChange={(next) => updateLine(line.key, next)} />
                    </div>}
                    <input aria-label={`Uwagi do pozycji ${name}`} value={line.note} onChange={(event) => updateLine(line.key, { note: event.target.value })} placeholder="Uwagi do pozycji, np. bez cebuli" maxLength={200} className="h-9 w-full rounded-lg border border-transparent bg-[#f5f2ee] px-3 text-xs outline-none transition placeholder:text-[#9a918a] focus-visible:border-input focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring" />
                  </li>
                })}
              </ul>

              {hasItems && <WorkshopPackagingPicker counts={packaging} auto={packagingAuto} onChange={adjustPackaging} hint={editing ? 'dorzuć do zamówienia' : 'dodaj ręcznie'} />}

              {source === 'own' && !editing && <div className="flex flex-col gap-1.5 border-t border-[#f0ece7] py-3.5">
                <span className="text-[11px] font-medium text-[#716962]" id="order-code-label">Kod rabatowy / kupon</span>
                {code ? <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
                  <Ticket className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{code.code} <span className="font-semibold text-primary">{describeCodeBenefit(code)}</span></p>
                    <p className="truncate text-[11px] text-muted-foreground">{code.reward}{code.customer ? ` · ${code.customer}` : ''}</p>
                  </div>
                  <button type="button" aria-label="Usuń kod" onClick={() => setCode(null)} className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"><X className="size-4" aria-hidden="true" /></button>
                </div> : <>
                  <div className="flex gap-2">
                    <input aria-labelledby="order-code-label" value={codeInput} onChange={(event) => { setCodeInput(normalizeCodeInput(event.target.value)); setCodeError('') }} onKeyDown={codeKeyDown} placeholder="np. FRYTKI lub 7F3A9C" autoComplete="off" spellCheck={false} className={cn(fieldClass, 'min-w-0 flex-1 font-mono uppercase tracking-wider')} />
                    <Button type="button" variant="outline" className="h-10" disabled={codeInput.length < 3 || checkingCode} onClick={() => void applyCode()}>{checkingCode ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Ticket data-icon="inline-start" />}Zastosuj</Button>
                  </div>
                  {codeError && <p role="alert" className="text-xs font-semibold text-destructive">{codeError}</p>}
                </>}
              </div>}

              {!editing && <label className="flex flex-col gap-1.5 border-t border-[#f0ece7] py-3.5 text-[11px] font-medium text-[#716962]">Uwagi do całego zamówienia
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={500} placeholder="np. sztućce, wszystko w jednej torbie" className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring" />
              </label>}
            </div>

            <div className="flex flex-col gap-3 border-t border-[#eee8e2] bg-[#fffdfa] p-4 sm:flex-row sm:items-end sm:justify-between">
              <dl className="flex flex-col gap-0.5 text-xs text-muted-foreground" aria-live="polite">
                {discount > 0 && <>
                  <div className="flex gap-2"><dt>Suma:</dt><dd className="tabular-nums line-through">{money(subtotal)}</dd></div>
                  <div className="flex gap-2 font-semibold text-primary"><dt>Rabat {code?.code}:</dt><dd className="tabular-nums">-{money(discount)}</dd></div>
                </>}
                <div className="flex items-baseline gap-2"><dt className="text-sm font-semibold md:text-base">Do zapłaty:</dt><dd className="text-2xl font-black tabular-nums text-foreground md:text-3xl">{money(total)}</dd></div>
              </dl>
              <div className="flex gap-2 self-end">
                <Button type="button" variant="outline" className="md:h-11 md:px-5 md:text-base" onClick={() => onOpenChange(false)}>Zamknij</Button>
                {invalidLine && <span role="alert" className="self-center text-xs font-semibold text-destructive">Uzupełnij opcje: {productById.get(invalidLine.productId)?.name}</span>}
                <Button type="submit" className="md:h-11 md:px-5 md:text-base" disabled={submitting || !canSubmit || Boolean(invalidLine)}>{submitting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Plus data-icon="inline-start" />}{editing ? 'Zapisz zmiany' : 'Dodaj zamówienie'}</Button>
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
