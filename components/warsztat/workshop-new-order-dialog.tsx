'use client'

import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { splitAddress } from '@/lib/delivery-zone'

type DeliveryZoneStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'ok'; fee: number; distanceKm: number }
  | { state: 'error'; message: string }
import { Bike, CalendarClock, Check, Zap, ChevronLeft, ChevronRight, Gift, LoaderCircle, Minus, Plus, RotateCcw, Settings2, ShoppingBag, Store, Ticket, Trash2, Wallet, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { codeDiscount, describeCodeBenefit } from '@/lib/checkout-codes'
import { hasConfigurator, resolveSelection, setFields, setKeyFor } from '@/lib/menu-config'
import type { Product } from '@/lib/menu'
import { cn } from '@/lib/utils'
import { WorkshopLineConfigurator, type LineSelection } from './workshop-line-configurator'
import { WorkshopPackagingPicker } from './workshop-packaging-picker'
import { packagingCount, packagingItems, packagingTotal, PACKAGING_KINDS, type PackagingCounts, type PackagingKind } from '@/lib/packaging'
import { newRequestId, postOrder, removePendingOrder, savePendingOrder, type OrderDraft, type PendingOrder } from './pending-orders'
import { orderSources, orderTypeMeta, type KitchenOrder, type OrderItem, type OrderSource, type OrderType } from './order-data'
import { useGroupedMenu } from './use-grouped-menu'
import { CategoryIcon } from './category-icon'
import { WorkshopClubOrderField, type ClubMember } from './workshop-club-order-field'
import { fetchWorkshopCode, normalizeCodeInput, type WorkshopCodePreview } from './workshop-code'
import { discountLabel, inStoreChannel, isPromotionRunning, promotionDiscount } from '@/lib/promotions'
import { usePromotions } from '@/lib/use-promotions'
import { TRAINING_NOTE, useTrainingSandbox } from './training/training-sandbox'

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

const PICKER_DAYS = 7
const weekdayShort = new Intl.DateTimeFormat('pl-PL', { weekday: 'short' })
const dayMonth = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'numeric' })
const longDate = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })

function addDays(offset: number) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offset)
  return date
}

/** "dziś" / "jutro" / "pojutrze" / "piątek, 16 października" for a scheduled ISO date. */
function scheduledDayLabel(iso: string) {
  const date = new Date(iso)
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const offset = Math.round((start.getTime() - addDays(0).getTime()) / 86_400_000)
  if (offset === 0) return 'dziś'
  if (offset === 1) return 'jutro'
  if (offset === 2) return 'pojutrze'
  return longDate.format(date)
}

/** The chosen day at the chosen time. For today, a time that has already passed rolls over to tomorrow. */
function scheduledIso(time: string, dayOffset: number) {
  const [hours, minutes] = time.split(':').map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  const date = addDays(dayOffset)
  date.setHours(hours, minutes, 0, 0)
  if (dayOffset === 0 && date.getTime() < Date.now() - 5 * 60_000) date.setDate(date.getDate() + 1)
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
  /** „Dodaj i rozlicz”: hands the not-yet-saved order to the parent, which opens the payment at once and saves in the background. */
  onPayStart?: (entry: PendingOrder) => void
  /** Reopens a draft whose save failed, exactly as it was typed. */
  initialDraft?: OrderDraft | null
}

type ExistingLine = { index: number; item: OrderItem; quantity: number; options: string; cancelled: boolean }

const initialExisting = (order: KitchenOrder | null | undefined): ExistingLine[] =>
  (order?.items ?? []).flatMap((item, index) => item.cancelled ? [] : [{ index, item, quantity: item.quantity, options: item.options ?? '', cancelled: false }])

const DEFAULT_NAMES = ['Klient', 'Klient stacjonarny', 'Klient Glovo', 'Klient Pyszne.pl', 'Klient Kiosk']

/** Type, time and customer fields of an order being edited, as the form shows them. */
function initialDetails(order: KitchenOrder) {
  const scheduled = order.scheduledFor ? new Date(order.scheduledFor) : null
  let dayOffset = 0
  if (scheduled) {
    const start = new Date(scheduled)
    start.setHours(0, 0, 0, 0)
    dayOffset = Math.min(PICKER_DAYS - 1, Math.max(0, Math.round((start.getTime() - addDays(0).getTime()) / 86_400_000)))
  }
  return {
    type: order.type,
    customer: DEFAULT_NAMES.includes(order.customer) ? '' : order.customer,
    phone: order.phone ?? '',
    address: order.address ?? '',
    when: scheduled ? 'scheduled' as const : 'asap' as const,
    time: scheduled ? toTimeValue(scheduled) : '',
    dayOffset,
  }
}

export function WorkshopNewOrderDialog({ open, onOpenChange, initialCode = null, onSubmitted, editOrder = null, onCustomItem, onPayStart, initialDraft = null }: Props) {
  const editing = Boolean(editOrder)
  const sandbox = useTrainingSandbox()
  const [original] = useState(() => editOrder ? initialDetails(editOrder) : null)
  const [existing, setExisting] = useState<ExistingLine[]>(() => initialExisting(editOrder))
  const { products, groups, isLoading } = useGroupedMenu({ includeUnavailable: true })
  const { promotions, now } = usePromotions()
  const [mobileStep, setMobileStep] = useState<'menu' | 'summary'>(initialDraft ? 'summary' : 'menu')
  // One id per draft: every retry of this order is recognised by the server, so it is never saved twice.
  const [clientRequestId] = useState(() => initialDraft?.clientRequestId ?? newRequestId())
  const [source, setSource] = useState<ManualSource>(initialDraft?.source ?? 'own')
  const [type, setType] = useState<KitchenOrder['type']>(original?.type ?? initialDraft?.type ?? ((initialDraft?.source ?? 'own') === 'own' ? 'Stacjonarnie' : 'Odbiór osobisty'))
  const [customer, setCustomer] = useState(original?.customer ?? initialDraft?.customer ?? '')
  const [phone, setPhone] = useState(original?.phone ?? initialDraft?.phone ?? '')
  const [address, setAddress] = useState(original?.address ?? initialDraft?.address ?? '')
  const [externalNumber, setExternalNumber] = useState(initialDraft?.externalNumber ?? '')
  const [note, setNote] = useState(initialDraft?.note ?? '')
  const [lines, setLines] = useState<Line[]>(initialDraft?.lines ?? [])
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [code, setCode] = useState<WorkshopCodePreview | null>(initialDraft ? initialDraft.code : initialCode)
  const [codeInput, setCodeInput] = useState('')
  const [checkingCode, setCheckingCode] = useState(false)
  const [codeError, setCodeError] = useState('')
  const [clubMember, setClubMember] = useState<ClubMember | null>(initialDraft?.clubMember ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [when, setWhen] = useState<'asap' | 'scheduled'>(original?.when ?? initialDraft?.when ?? 'asap')
  const [time, setTime] = useState(original?.time ?? initialDraft?.time ?? '')
  const [dayOffset, setDayOffset] = useState(original?.dayOffset ?? initialDraft?.dayOffset ?? 0)
  const [timePickerOpen, setTimePickerOpen] = useState(!original?.time)
  const [activeKey, setActiveKey] = useState<number | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [packagingAdjust, setPackagingAdjust] = useState<PackagingCounts>(initialDraft?.packagingAdjust ?? {})
  const [zone, setZone] = useState<DeliveryZoneStatus>({ state: 'idle' })
  const zoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const zoneRequest = useRef(0)
  const orderSource: OrderSource = editing ? editOrder?.source ?? 'yummy' : source
  const platform = orderSource === 'glovo' || orderSource === 'pyszne'
  // When editing, the zone is checked only for a new delivery address; an unchanged one keeps its fee.
  const needsZone = (value: string, nextType = type) => nextType === 'Dostawa' && (editing
    ? !platform && (editOrder?.type !== 'Dostawa' || value.trim() !== (editOrder?.address ?? '').trim())
    : source === 'own')
  const checksZone = needsZone(address)
  const deliveryFee = !editing
    ? checksZone && zone.state === 'ok' ? zone.fee : 0
    : platform ? editOrder?.deliveryFee ?? 0
    : type !== 'Dostawa' ? 0
    : checksZone ? zone.state === 'ok' ? zone.fee : 0
    : editOrder?.deliveryFee ?? 0
  const settled = Boolean(editOrder?.paidAt) || Boolean(editOrder?.items.some((item) => (item.receipted ?? 0) > 0))
  const feeBlocked = editing && settled && Math.round(deliveryFee * 100) !== Math.round((editOrder?.deliveryFee ?? 0) * 100)

  const checkZone = async (value: string) => {
    const requestId = ++zoneRequest.current
    const { street, city } = splitAddress(value)
    if (street.length < 3) {
      setZone({ state: 'idle' })
      return
    }
    setZone({ state: 'checking' })
    try {
      const response = await fetch('/api/delivery/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ street, city }) })
      const result = (await response.json()) as { ok: boolean; distanceKm?: number; fee?: number; message?: string }
      if (requestId !== zoneRequest.current) return
      setZone(result.ok
        ? { state: 'ok', fee: result.fee ?? 0, distanceKm: result.distanceKm ?? 0 }
        : { state: 'error', message: result.message ?? 'Nie dowozimy pod ten adres.' })
    } catch {
      if (requestId === zoneRequest.current) setZone({ state: 'error', message: 'Nie udało się sprawdzić adresu.' })
    }
  }

  const changeAddress = (value: string) => {
    setAddress(value)
    if (zoneTimer.current) clearTimeout(zoneTimer.current)
    if (!needsZone(value)) {
      zoneRequest.current++
      setZone({ state: 'idle' })
      return
    }
    zoneRequest.current++
    setZone({ state: value.trim().length >= 3 ? 'checking' : 'idle' })
    if (value.trim().length >= 3) zoneTimer.current = setTimeout(() => void checkZone(value), 700)
  }

  const canSchedule = true
  const scheduleUntouched = Boolean(original && editOrder?.scheduledFor && when === original.when && time === original.time && dayOffset === original.dayOffset)
  const scheduledFor = canSchedule && when === 'scheduled' ? scheduleUntouched ? editOrder!.scheduledFor! : scheduledIso(time, dayOffset) : null
  const finalAddress = (value: string, forType: OrderType) => forType === 'Dostawa' ? value.trim() : ''
  const detailsChanged = Boolean(original && editOrder) && (
    type !== original!.type
    || (scheduledFor ? Date.parse(scheduledFor) : null) !== (editOrder!.scheduledFor ? Date.parse(editOrder!.scheduledFor) : null)
    || customer.trim() !== original!.customer.trim()
    || phone.trim() !== original!.phone.trim()
    || finalAddress(address, type) !== finalAddress(original!.address, original!.type)
  )

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
  // Packaging is always added by hand at the bar �� nothing is counted automatically.
  const packagingAuto: PackagingCounts = {}
  const packaging: PackagingCounts = Object.fromEntries(PACKAGING_KINDS.map((kind) => [kind, Math.max(0, (packagingAuto[kind] ?? 0) + (packagingAdjust[kind] ?? 0))]))
  const packagingSum = packagingTotal(packaging)
  const subtotal = foodSubtotal + packagingSum
  const invalidLine = lines.find((line) => resolveLine(line, productById.get(line.productId))?.ok === false)
  const activeLine = lines.find((line) => line.key === activeKey)
  const activeProduct = activeLine && productById.get(activeLine.productId)
  const promotionsApply = source === 'own' && !editing
  const promotionChannel = inStoreChannel(type === 'Dostawa')
  const runningPromotions = promotionsApply && now ? promotions.filter((promotion) => isPromotionRunning(promotion, now, promotionChannel)) : []
  const promotion = runningPromotions.length && now
    ? promotionDiscount(lines.map((line) => ({ productId: line.productId, category: productById.get(line.productId)?.category, amount: unitPriceOf(line) * line.quantity, quantity: line.quantity })), runningPromotions, promotionChannel, now)
    : { discount: 0, applied: [] }
  const discount = editing
    ? Math.min(editOrder?.discount ?? 0, subtotal)
    : Math.round(Math.min(foodSubtotal, promotion.discount + codeDiscount(foodSubtotal - promotion.discount, code)) * 100) / 100
  const codeDiscountAmount = Math.round((discount - promotion.discount) * 100) / 100
  const total = subtotal - discount + deliveryFee
  const liveExisting = existing.filter((line) => !line.cancelled).length
  const hasItems = lines.length > 0 || Boolean(code?.items.length) || liveExisting > 0
  const itemsChanged = lines.length > 0 || existingChanges.length > 0 || packagingCount(packaging) > 0
  const canSubmit = editing ? (itemsChanged || detailsChanged) && hasItems && !feeBlocked && !(checksZone && zone.state === 'checking') : hasItems
  const category = groups.find((group) => group.id === categoryId) ?? null
  const quantityOf = (productId: string) => lines.reduce((sum, line) => line.productId === productId ? sum + line.quantity : sum, 0)
  const typeMeta = orderTypeMeta[type]
  const TypeIcon = typeIcons[type]
  // Glovo/Pyszne orders are paid in the platform app, so only own orders can be settled right away.
  const canPayNow = !editing && source === 'own' && Boolean(onPayStart)

  function chooseType(next: OrderType) {
    setType(next)
    if (!editing) return
    if (zoneTimer.current) clearTimeout(zoneTimer.current)
    zoneRequest.current++
    setZone({ state: 'idle' })
    if (needsZone(address, next) && address.trim().length >= 3) void checkZone(address)
  }

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
    setClubMember(null)
    setCustomer(original?.customer ?? '')
    setPhone(original?.phone ?? '')
    setAddress(original?.address ?? '')
    setExternalNumber('')
    setNote('')
    if (original) setType(original.type)
    setZone({ state: 'idle' })
    setWhen(original?.when ?? 'asap')
    setTime(original?.time ?? '')
    setDayOffset(original?.dayOffset ?? 0)
    setTimePickerOpen(!original?.time)
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
      if (!canSubmit || invalidLine || (canSchedule && when === 'scheduled' && !scheduledFor)) return
      if (sandbox) {
        toast.info('Edycja nie jest zapisywana w szkoleniu', { description: TRAINING_NOTE })
        onOpenChange(false)
        return
      }
      setSubmitting(true)
      const response = await fetch(`/api/workshop/orders/${encodeURIComponent(editOrder.databaseId ?? editOrder.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: existingChanges.map((line) => line.cancelled ? { index: line.index, cancelled: true } : { index: line.index, quantity: line.quantity, options: line.options.trim() }),
          lines: serializeLines(),
          packaging,
          ...(detailsChanged ? { details: { type, scheduledFor, customer, phone, address } } : {}),
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
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const payAfter = canPayNow && submitter?.value === 'pay'
    const entry = buildPendingOrder(payAfter)
    if (sandbox) {
      if (payAfter && onPayStart) onPayStart(entry)
      else {
        const created = sandbox.createOrder(entry.provisional)
        toast.success(`Dodano zamówienie ${created.id}`, { description: TRAINING_NOTE })
      }
      onOpenChange(false)
      onSubmitted?.()
      return
    }
    // Backed up before the request leaves, so a crash or lost connection never loses what was typed.
    savePendingOrder(entry)
    if (payAfter && onPayStart) {
      onPayStart(entry)
      onOpenChange(false)
      onSubmitted?.()
      return
    }
    setSubmitting(true)
    const result = await postOrder(entry.payload)
    setSubmitting(false)
    if (!result.ok) {
      // The form is still open with everything filled in; the backup only matters if the request may have gone through.
      if (!result.retryable) removePendingOrder(clientRequestId)
      toast.error(result.error, { description: result.retryable ? 'Dane są zapisane – spróbuj ponownie, zamówienie nie doda się podwójnie.' : undefined })
      return
    }
    removePendingOrder(clientRequestId)
    const details = [code ? `Kod ${code.code} wykorzystany · ${describeCodeBenefit(code)}` : orderSources[source].label]
    if (clubMember && source === 'own' && !result.data.duplicate) {
      details.push('Yummy Club: Stars i rabat statusowy naliczone – punkty wpadną po wydaniu zamówienia')
    }
    toast.success(`Dodano zamówienie #${result.data.orderNumber}`, { description: details.join(' · ') })
    onOpenChange(false)
    onSubmitted?.()
  }

  function buildPendingOrder(payNow: boolean): PendingOrder {
    const clubPhone = source === 'own' ? clubMember?.phone : undefined
    const payload = { clientRequestId, source, type, customer: source === 'glovo' ? '' : customer, phone: source === 'own' ? phone : '', address: source === 'glovo' ? '' : address, externalNumber, note, code: code?.code, scheduledFor, lines: serializeLines(), packaging, clubPhone, payNow }
    const draft: OrderDraft = { clientRequestId, source, type, customer, phone, address, externalNumber, note, lines, packagingAdjust, code, clubMember, when, time, dayOffset }
    let position = 0
    const items: OrderItem[] = [
      ...lines.flatMap((line): OrderItem[] => {
        const product = productById.get(line.productId)
        const resolved = resolveLine(line, product)
        const station = (product as { station?: OrderItem['station'] } | undefined)?.station
        if (!resolved?.ok) {
          const options = line.note.trim()
          return [{ quantity: line.quantity, name: product?.name ?? 'Pozycja', unitPrice: unitPriceOf(line), ...(station ? { station } : {}), ...(options ? { options } : {}) }]
        }
        // Same split as the server: each part of a set goes to its own station, grouped under the main product.
        const set = setKeyFor(resolved.separateLines, position)
        position += 1 + resolved.separateLines.length
        const options = [...resolved.baseDetails, line.note.trim()].filter(Boolean).join(', ')
        return [
          { quantity: line.quantity, name: product?.name ?? 'Pozycja', unitPrice: resolved.baseUnitPrice, ...(station ? { station } : {}), ...(options ? { options } : {}), ...(set ? { set } : {}) },
          ...resolved.separateLines.map((extra) => ({ quantity: line.quantity, name: extra.name, unitPrice: extra.unitPrice, station: extra.station, ...setFields(extra, set) })),
        ]
      }),
      ...(code?.items ?? []).map((item) => ({ quantity: item.quantity, name: item.name, unitPrice: 0 })),
      ...packagingItems(packaging),
    ]
    const provisional: KitchenOrder = {
      id: 'Nowe',
      status: 'new',
      customer: customer.trim() || code?.customer || clubMember?.full_name || 'Klient',
      phone,
      type,
      created: toTimeValue(new Date()),
      eta: '',
      items,
      source,
      discount,
      deliveryFee,
      total: Math.round(total * 100) / 100,
    }
    return { clientRequestId, payload, draft, provisional, createdAt: Date.now() }
  }

  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0) + (code?.items.length ?? 0)
  const lastLine = lines.at(-1)
  const lastLineName = lastLine ? productById.get(lastLine.productId)?.name ?? 'Pozycja' : code?.items[0]?.name ?? ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-keep-size className="workshop-dashboard flex max-h-[94dvh] flex-col gap-4 overflow-hidden rounded-2xl p-4 max-sm:inset-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:pt-[max(1rem,env(safe-area-inset-top))] max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:ring-0 max-sm:data-open:zoom-in-100 sm:max-w-2xl sm:p-6 md:h-[95dvh] md:max-w-[min(100rem,97vw)] md:p-6 xl:p-7">
        <DialogHeader>
          <DialogTitle className="text-base font-extrabold sm:text-lg md:text-xl">{editOrder ? `Edytuj zamówienie ${editOrder.id}` : 'Nowe zamówienie'}</DialogTitle>
          <DialogDescription className="max-sm:sr-only">{editOrder ? 'Zmień typ, godzinę lub dane klienta. Pozycje poprawisz po prawej, nowe dania dodasz z menu.' : initialCode ? 'Kupon jest już nabity. Coś jeszcze? Dodaj kolejne pozycje dla klienta.' : 'Dodaj zamówienie własne albo przepisz je z Glovo lub Pyszne.pl. Trafi na koniec kolejki „Nowe”.'}</DialogDescription>
        </DialogHeader>

        {runningPromotions.length > 0 && (
          <div role="status" className="-mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <span className="font-bold">Aktywna promocja:</span>
            {runningPromotions.map((entry) => <span key={entry.id} className="font-semibold">{entry.title} <span className="font-black text-emerald-700">{discountLabel(entry)}</span></span>)}
            <span className="text-xs text-emerald-800/80">Rabat doliczy się automatycznie.</span>
          </div>
        )}

        <form onSubmit={submit} className="-mx-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 sm:-mx-6 sm:px-6 md:mx-0 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-6 md:overflow-hidden md:px-0">
          <div className={cn('flex-col gap-4 md:flex md:min-h-0 md:overflow-y-auto md:pr-1', mobileStep === 'menu' ? 'flex' : 'hidden')}>
            {!editing && <fieldset className="flex flex-col">
              <legend className="mb-1.5 text-xs font-semibold">Źródło zamówienia</legend>
              <div className="grid grid-cols-3 gap-2">
                {sourceOptions.map((option) => {
                  const meta = orderSources[option]
                  return <label key={option} className={cn('flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 p-2 text-[11px] font-bold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring', source === option ? `source-option-${option}` : 'border-border hover:border-muted-foreground/40')}>
                    <input type="radio" name="source" value={option} checked={source === option} onChange={() => chooseSource(option)} className="sr-only" />
                    {meta.logo ? <img src={meta.logo} alt="" width={28} height={28} className="size-6 shrink-0 sm:size-7" /> : <span className="grid size-6 shrink-0 sm:size-7 place-items-center rounded-[8px] bg-primary text-primary-foreground"><Store className="size-3.5" aria-hidden="true" /></span>}
                    <span className="truncate">{meta.label}</span>
                  </label>
                })}
              </div>
            </fieldset>}

            <fieldset className="flex flex-col">
              <legend className="mb-1.5 text-xs font-semibold">Typ zamówienia</legend>
              <div className="grid grid-cols-3 gap-2">
                {typeOptions.map((option) => {
                  const meta = orderTypeMeta[option]
                  const Icon = typeIcons[option]
                  const disabled = option === 'Stacjonarnie' && (editing ? platform : source !== 'own')
                  return <label key={option} className={cn(`type-${meta.tone}`, 'flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2.5 text-xs font-bold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring', type === option ? 'type-badge border-transparent' : 'border-border hover:border-muted-foreground/40', disabled && 'cursor-not-allowed opacity-40')}>
                    <input type="radio" name="type" value={option} checked={type === option} disabled={disabled} onChange={() => chooseType(option)} className="sr-only" />
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
                <label className={cn('flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2.5 text-xs font-bold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring', when === 'scheduled' ? 'border-slate-900 bg-slate-900 text-white' : 'border-border hover:border-muted-foreground/40')}>
                  <input type="radio" name="when" checked={when === 'scheduled'} onChange={() => { setWhen('scheduled'); setTimePickerOpen(true); if (!time) setTime(roundedFromNow(60)) }} className="sr-only" />
                  <CalendarClock className="size-4 shrink-0" aria-hidden="true" />Na godzinę
                </label>
              </div>
              {when === 'scheduled' && !timePickerOpen && scheduledFor && <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <CalendarClock className="size-5 shrink-0 text-slate-600" aria-hidden="true" />
                <p className="flex-1 text-sm font-semibold text-slate-900">Na godzinę <span className="font-mono text-lg font-black tabular-nums">{time}</span> <span className="text-xs font-medium text-slate-600">· {scheduledDayLabel(scheduledFor)}</span></p>
                <button type="button" onClick={() => setTimePickerOpen(true)} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Zmień</button>
              </div>}
              {when === 'scheduled' && (timePickerOpen || !scheduledFor) && <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-700">Wybrana godzina <span className="ml-1 font-mono text-2xl font-black tabular-nums text-slate-900 md:text-3xl">{time || '--:--'}</span></p>
                  {scheduledFor && <span className="text-sm font-semibold text-slate-600">{scheduledDayLabel(scheduledFor)}</span>}
                </div>
                <div role="radiogroup" aria-label="Dzień" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
                  {Array.from({ length: PICKER_DAYS }, (_, offset) => {
                    const date = addDays(offset)
                    const selected = dayOffset === offset
                    const name = offset === 0 ? 'Dziś' : offset === 1 ? 'Jutro' : weekdayShort.format(date)
                    return <button key={offset} type="button" role="radio" aria-checked={selected} aria-label={longDate.format(date)} onClick={() => setDayOffset(offset)} className={cn('flex h-12 min-w-16 shrink-0 flex-col items-center justify-center rounded-lg border px-2 leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-14 md:flex-1', selected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900 shadow-sm hover:bg-slate-100')}>
                      <span className="text-sm font-black capitalize">{name}</span>
                      <span className={cn('text-[11px] font-semibold tabular-nums', selected ? 'text-slate-300' : 'text-slate-500')}>{dayMonth.format(date)}</span>
                    </button>
                  })}
                </div>
                <div role="radiogroup" aria-label="Godzina" className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 md:grid-cols-12">
                  {pickerHours.map((hour) => {
                    const value = hour === 24 ? '00' : String(hour).padStart(2, '0')
                    const selected = time.slice(0, 2) === value
                    return <button key={hour} type="button" role="radio" aria-checked={selected} onClick={() => setTime(`${value}:${time.slice(3, 5) || '00'}`)} className={cn('h-11 rounded-lg border text-base font-black tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-12 md:text-lg', selected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900 shadow-sm hover:bg-slate-100')}>{String(hour).padStart(2, '0')}</button>
                  })}
                </div>
                <div role="radiogroup" aria-label="Minuty" className="grid grid-cols-6 gap-1.5 md:grid-cols-12">
                  {pickerMinutes.map((minute) => {
                    const value = String(minute).padStart(2, '0')
                    const selected = time.slice(3, 5) === value
                    return <button key={minute} type="button" role="radio" aria-checked={selected} onClick={() => setTime(`${time.slice(0, 2) || '12'}:${value}`)} className={cn('h-11 rounded-lg border text-base font-bold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-12 md:text-lg', selected ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200')}>:{value}</button>
                  })}
                </div>
                <button type="button" disabled={!scheduledFor} onClick={() => setTimePickerOpen(false)} className="flex h-11 items-center justify-center gap-1.5 rounded-lg bg-slate-900 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 md:h-12"><Check className="size-4" aria-hidden="true" />Gotowe</button>
              </div>}
            </fieldset>}

            {((!editing && source !== 'own') || orderSource !== 'glovo') && <div className="grid gap-3 sm:grid-cols-2">
              {!editing && source !== 'own' && <label className="flex flex-col gap-1.5 text-xs font-semibold">Nr zamówienia {orderSources[source].label}
                <input required={source === 'glovo'} value={externalNumber} onChange={(event) => setExternalNumber(event.target.value)} placeholder={source === 'glovo' ? 'np. A7F3K' : 'opcjonalnie'} maxLength={40} className={fieldClass} />
              </label>}
              {orderSource !== 'glovo' && <>
                <label className="flex flex-col gap-1.5 text-xs font-semibold">Imię klienta
                  <input required={orderSource === 'pyszne'} value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder={orderSource === 'pyszne' ? 'np. Anna' : code?.customer ?? 'opcjonalnie'} maxLength={120} className={fieldClass} />
                </label>
                {(editing ? !platform : source === 'own') && <label className="flex flex-col gap-1.5 text-xs font-semibold">Telefon
                  <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="opcjonalnie" maxLength={30} className={fieldClass} />
                </label>}
              </>}
              {orderSource !== 'glovo' && type === 'Dostawa' && <label className="flex flex-col gap-1.5 text-xs font-semibold sm:col-span-2">Adres dostawy
                <input required minLength={3} value={address} onChange={(event) => changeAddress(event.target.value)} onBlur={() => { if (checksZone && zone.state === 'idle') void checkZone(address) }} placeholder="ul. Przykładowa 1, Rybnik" maxLength={200} aria-describedby={checksZone ? 'workshop-zone-status' : undefined} className={fieldClass} />
                {checksZone && zone.state !== 'idle' && <span id="workshop-zone-status" role="status" className={cn('flex items-center gap-1.5 text-xs font-semibold', zone.state === 'ok' && 'text-emerald-700', zone.state === 'error' && 'text-destructive', zone.state === 'checking' && 'font-normal text-muted-foreground')}>
                  {zone.state === 'checking' && <><LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />Sprawdzam strefę dostawy…</>}
                  {zone.state === 'ok' && <><Check className="size-3.5" aria-hidden="true" />Dowozimy · {zone.distanceKm.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} km · dostawa {money(zone.fee)}</>}
                  {zone.state === 'error' && <><X className="size-3.5" aria-hidden="true" />{zone.message}</>}
                </span>}
              </label>}
            </div>}
            {feeBlocked && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs font-semibold text-destructive">Zamówienie jest już rozliczone, a ta zmiana zmieniłaby opłatę za dostawę ({money(editOrder?.deliveryFee ?? 0)} → {money(deliveryFee)}). Zostaw typ i adres albo zrób zwrot i nowe zamówienie.</p>}

            {editing && onCustomItem && <Button type="button" variant="outline" className="h-11 justify-start self-start rounded-xl text-sm font-bold" onClick={onCustomItem}><Plus data-icon="inline-start" />Pozycja spoza menu</Button>}

            <section aria-labelledby="menu-picker-title" className="flex flex-col gap-2">
              <div className="flex min-h-11 items-center gap-2 md:min-h-12">
                {category ? <>
                  <button type="button" onClick={() => setCategoryId(null)} className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-200 pl-2.5 pr-4 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-300 active:bg-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-12 md:text-base">
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
                    <button type="button" onClick={() => setCategoryId(group.id)} className="relative flex h-full w-full flex-col items-center gap-2 overflow-hidden rounded-xl border border-border bg-card px-2 pb-2.5 pt-3 text-center transition-colors hover:border-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-16 sm:flex-row sm:gap-2.5 sm:p-2.5 sm:text-left md:min-h-20 md:gap-3 md:p-3">
                      {inOrder > 0 && <span className="absolute right-2 top-2 grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-black tabular-nums text-primary-foreground sm:hidden" aria-hidden="true">{inOrder}</span>}
                      <CategoryIcon image={group.image} className="size-12 sm:size-11 md:size-14" />
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

            <div className="sticky bottom-0 -mx-4 mt-auto bg-gradient-to-t from-background via-background to-background/0 px-3 pb-1 pt-4 sm:-mx-6 sm:px-6 md:hidden">
              <button type="button" onClick={() => setMobileStep('summary')} aria-label={`Otwórz koszyk: ${itemCount} poz., ${money(total)}`} className={cn('flex h-14 w-full items-center gap-3 rounded-2xl pl-2 pr-3 text-left shadow-[0_10px_30px_rgba(20,15,10,0.25)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', itemCount > 0 ? 'bg-foreground text-background' : 'border border-dashed border-border bg-card text-muted-foreground shadow-none')}>
                <span className={cn('relative grid size-10 shrink-0 place-items-center rounded-xl', itemCount > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                  <ShoppingBag className="size-5" aria-hidden="true" />
                  {itemCount > 0 && <span key={itemCount} className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-background px-1 text-[11px] font-black tabular-nums text-foreground ring-2 ring-foreground animate-in zoom-in-50 duration-300">{itemCount}</span>}
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="text-sm font-extrabold">{itemCount > 0 ? 'Koszyk' : 'Koszyk jest pusty'}</span>
                  <span key={lastLineName} className={cn('truncate text-[11px] font-medium animate-in fade-in slide-in-from-bottom-1 duration-300', itemCount > 0 ? 'text-background/70' : 'text-muted-foreground')}>{itemCount > 0 ? `Ostatnio: ${lastLineName}` : 'Dotknij dania, aby je dodać'}</span>
                </span>
                {itemCount > 0 && <span className="flex shrink-0 items-center gap-1 text-base font-black tabular-nums">{money(total)}<ChevronRight className="size-5" aria-hidden="true" /></span>}
              </button>
            </div>
          </div>

          <div className={cn(`type-${typeMeta.tone}`, mobileStep === 'summary' ? 'flex' : 'hidden', 'min-h-0 flex-1 flex-col overflow-hidden md:flex md:flex-none rounded-2xl border border-black/[0.07] bg-white shadow-[0_10px_32px_rgba(15,23,42,0.10)] md:min-h-0 max-sm:-mx-4 max-sm:rounded-none max-sm:border-x-0 max-sm:border-b-0 max-sm:shadow-none')}>
            <div className="type-band h-1.5 shrink-0" aria-hidden="true" />
            <button type="button" onClick={() => setMobileStep('menu')} className="flex h-11 shrink-0 items-center justify-center gap-1.5 border-b border-[#f0ece7] bg-primary/[0.06] text-sm font-bold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:hidden">
              <Plus className="size-4" aria-hidden="true" />Dodaj więcej z menu
            </button>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0ece7] px-3 py-2.5 sm:px-4 sm:py-3">
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setMobileStep('menu')} className="-ml-1 grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden">
                  <ChevronLeft className="size-5" aria-hidden="true" /><span className="sr-only">Wróć do menu</span>
                </button>
                <h3 className="flex items-center gap-1.5 text-base font-black tracking-tight md:text-lg"><ShoppingBag className="size-4 text-primary md:hidden" aria-hidden="true" /><span className="md:hidden">Koszyk</span><span className="max-md:hidden">Zamówienie</span>{itemCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-black tabular-nums text-primary-foreground md:hidden">{itemCount}</span>}</h3>
                {(editing ? canSubmit || lines.length > 0 : hasItems) && (confirmClear ? <span className="ml-2 flex items-center gap-1">
                  <span className="text-xs font-semibold text-destructive">{editing ? 'Cofnąć zmiany?' : 'Usunąć wszystko?'}</span>
                  <Button type="button" size="sm" variant="destructive" onClick={clearAll}>{editing ? 'Tak, cofnij' : 'Tak, wyczyść'}</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>Nie</Button>
                </span> : <Button type="button" size="sm" variant="outline" className="ml-2 text-destructive hover:text-destructive" onClick={() => setConfirmClear(true)}><RotateCcw data-icon="inline-start" />{editing ? 'Cofnij zmiany' : <><span className="sm:hidden">Wyczyść</span><span className="max-sm:hidden">Wyczyść wszystko</span></>}</Button>)}
              </div>
              <div className="flex items-center gap-1.5">
                {scheduledFor && <span className="inline-flex h-7 items-center gap-1 rounded-lg bg-slate-900 px-2 text-[11px] font-bold text-white"><CalendarClock className="size-3.5" aria-hidden="true" />Na {time}{scheduledDayLabel(scheduledFor) !== 'dziś' ? ` · ${scheduledDayLabel(scheduledFor)}` : ''}</span>}
                {source !== 'own' && orderSources[source].logo && <img src={orderSources[source].logo} alt={orderSources[source].label} width={24} height={24} className="size-6 rounded-md" />}
                <span className="type-soft inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-[11px] font-bold uppercase tracking-wide"><TypeIcon className="size-3.5" aria-hidden="true" />{typeMeta.short}</span>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 sm:px-4">
              {!hasItems && <p className="py-10 text-center text-sm text-muted-foreground">Wybierz kategorię i dotknij dania, aby dodać je do zamówienia.</p>}
              {editing && existing.length > 0 && <ul className="divide-y divide-[#f0ece7]" aria-label="Obecne pozycje">
                {existing.map((line) => {
                  const receipted = line.item.receipted ?? 0
                  const changed = line.quantity !== line.item.quantity || line.options.trim() !== (line.item.options ?? '')
                  return <li key={`existing-${line.index}`} className={cn('flex flex-col gap-2 py-3.5', line.cancelled && 'opacity-60')}>
                    <div className="flex items-center gap-2 text-[13px] max-sm:flex-wrap max-sm:gap-y-1.5 md:text-sm">
                      <span className="hidden basis-full max-sm:order-1 max-sm:block" aria-hidden="true" />
                      {line.cancelled ? <span className="w-[5.25rem] shrink-0 text-center text-xs font-bold text-destructive max-sm:order-2">usuni��te                      </span> : <div className="flex shrink-0 items-center rounded-lg border border-input bg-background max-sm:order-2">
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
                      {line.cancelled ? <Button type="button" size="sm" variant="outline" className="max-sm:order-3 max-sm:ml-auto" onClick={() => updateExisting(line.index, { cancelled: false })}><RotateCcw data-icon="inline-start" />Przywróć</Button>
                        : <button type="button" aria-label={`Usuń pozycję ${line.item.name}`} disabled={receipted > 0} title={receipted > 0 ? 'Pozycja jest na paragonie – zrób zwrot' : undefined} onClick={() => updateExisting(line.index, { cancelled: true })} className="grid size-9 shrink-0 place-items-center rounded-lg max-sm:order-3 max-sm:ml-auto text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-30 md:size-11"><Trash2 className="size-4 md:size-5" aria-hidden="true" /></button>}
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
                    <div className="flex items-center gap-2 text-[13px] max-sm:flex-wrap max-sm:gap-y-1.5 md:text-sm">
                      <div className="flex shrink-0 items-center rounded-lg border border-input bg-background max-sm:order-2">
                        <button type="button" aria-label={`Zmniejsz ilość: ${name}`} disabled={line.quantity <= 1} onClick={() => updateLine(line.key, { quantity: line.quantity - 1 })} className="grid size-9 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30"><Minus className="size-4" aria-hidden="true" /></button>
                        <span className="w-6 text-center text-sm font-bold tabular-nums">{line.quantity}</span>
                        <button type="button" aria-label={`Zwiększ ilość: ${name}`} disabled={quantityOf(line.productId) >= MAX_QUANTITY} onClick={() => updateLine(line.key, { quantity: line.quantity + 1 })} className="grid size-9 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30"><Plus className="size-4" aria-hidden="true" /></button>
                      </div>
                      <div className="min-w-0 flex-1 max-sm:order-1">
                        <p className="font-bold leading-tight max-sm:text-[15px]">{name}</p>
                        {configurable && !isActive && <p className={cn('mt-0.5 text-[11px] leading-snug max-sm:text-xs', resolved?.ok === false ? 'font-semibold text-destructive' : 'text-muted-foreground')}>{resolved?.ok ? resolved.details.join(' · ') || 'bez dodatków' : resolved?.error}</p>}
                      </div>
                      <span className="shrink-0 self-start text-xs font-semibold tabular-nums text-muted-foreground max-sm:order-1 max-sm:pt-0.5 max-sm:text-sm max-sm:font-bold max-sm:text-foreground sm:self-center md:text-sm">{money(unitPriceOf(line) * line.quantity)}</span>
                      <span className="hidden basis-full max-sm:order-1 max-sm:block" aria-hidden="true" />
                      {configurable && <button type="button" aria-expanded={isActive} onClick={() => setActiveKey(isActive ? null : line.key)} className={cn('flex h-9 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:order-3 max-sm:ml-auto max-sm:px-4 md:h-10 md:px-3 md:text-[13px]', isActive ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-primary text-primary-foreground hover:bg-primary/90')}>
                        {isActive ? <Check className="size-4" aria-hidden="true" /> : <Settings2 className="size-4" aria-hidden="true" />}{isActive ? 'Gotowe' : 'Opcje'}
                      </button>}
                      <button type="button" aria-label={`Usuń pozycję ${name}`} onClick={() => { setLines((current) => current.filter((entry) => entry.key !== line.key)); if (isActive) setActiveKey(null) }} className={cn('grid size-9 shrink-0 place-items-center rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 max-sm:order-4 md:size-11', !configurable && 'max-sm:ml-auto')}><Trash2 className="size-4 md:size-5" aria-hidden="true" /></button>
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

              {source === 'own' && !editing && <WorkshopClubOrderField member={clubMember} onChange={setClubMember} total={total} fieldClass={fieldClass} />}

              {!editing && <label className="flex flex-col gap-1.5 border-t border-[#f0ece7] py-3.5 text-[11px] font-medium text-[#716962]">Uwagi do całego zamówienia
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={500} placeholder="np. sztućce, wszystko w jednej torbie" className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring" />
              </label>}
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-black/[0.06] bg-white p-3 sm:flex-row sm:items-end sm:justify-between sm:gap-3 sm:p-4">
              <dl className="flex flex-col gap-0.5 text-xs text-muted-foreground" aria-live="polite">
                {discount > 0 && <>
                  <div className="flex gap-2"><dt>Suma:</dt><dd className="tabular-nums line-through">{money(subtotal)}</dd></div>
                  {promotion.applied.map((entry) => <div key={entry.promotion.id} className="flex gap-2 font-semibold text-emerald-700"><dt>Promocja {entry.promotion.title} {discountLabel(entry.promotion)}:</dt><dd className="tabular-nums">-{money(entry.amount)}</dd></div>)}
                  {codeDiscountAmount > 0 && <div className="flex gap-2 font-semibold text-primary"><dt>Rabat{editing ? '' : ` ${code?.code ?? ''}`}:</dt><dd className="tabular-nums">-{money(codeDiscountAmount)}</dd></div>}
                </>}
                {deliveryFee > 0 && <div className="flex gap-2 font-semibold"><dt>Dostawa:</dt><dd className="tabular-nums">+{money(deliveryFee)}</dd></div>}
                <div className="flex items-baseline gap-2"><dt className="text-sm font-semibold md:text-base">Do zapłaty:</dt><dd className="text-xl font-black tabular-nums text-foreground sm:text-2xl md:text-3xl">{money(total)}</dd></div>
              </dl>
              <div className="flex flex-wrap justify-end gap-2 self-end max-sm:grid max-sm:grid-cols-2 max-sm:self-stretch">
                <Button type="button" variant="outline" className="max-sm:h-11 md:h-11 md:px-5 md:text-base" onClick={() => onOpenChange(false)}>Zamknij</Button>
                {invalidLine && <span role="alert" className="self-center text-xs font-semibold text-destructive max-sm:order-first max-sm:col-span-2">Uzupełnij opcje: {productById.get(invalidLine.productId)?.name}</span>}
                <Button type="submit" variant={canPayNow ? 'outline' : 'default'} className="max-sm:h-11 md:h-11 md:px-5 md:text-base" disabled={submitting || !canSubmit || Boolean(invalidLine)}>{submitting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Plus data-icon="inline-start" />}{editing ? 'Zapisz zmiany' : canPayNow ? 'Dodaj' : 'Dodaj zamówienie'}</Button>
                {canPayNow && <Button type="submit" name="intent" value="pay" className="bg-emerald-600 font-bold text-white hover:bg-emerald-700 max-sm:col-span-2 max-sm:h-12 max-sm:text-base md:h-11 md:px-5 md:text-base" disabled={submitting || !canSubmit || Boolean(invalidLine)}><Wallet data-icon="inline-start" />Dodaj i rozlicz</Button>}
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
