'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import useSWR from 'swr'
import { AlertCircle, ArrowLeft, ArrowRight, Banknote, Bike, CheckCircle2, Clock, CreditCard, Loader2, MapPin, MessageSquareText, Minus, Phone, Plus, Radar, Building2, ShoppingBag, Store, Tag, Trash2, User, X } from 'lucide-react'
import { RESTAURANT, formatDistance } from '@/lib/restaurant'
import { DEFAULT_DELIVERY_ZONES, DEFAULT_MIN_ORDER, deliveryRadius, formatKm, formatZoneRange, type DeliveryZone } from '@/lib/order-settings'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useCart } from './cart-context'
import { SchedulePicker } from './schedule-picker'
import { UnavailableNotice } from './unavailable-notice'
import { GuestLoginPrompt, fetchSignedIn } from './guest-login-prompt'
import { formatPrice } from '@/lib/menu'
import { useMenu } from '@/lib/use-menu'
import { useRestaurantStatus } from '@/lib/use-restaurant-status'
import { hasConfigurator } from '@/lib/menu-config'
import { autoPackaging, packagingTotal } from '@/lib/packaging'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { GUEST_CHECKOUT_CODE, GUEST_PROMO_CODE, checkoutCodeError, codeDiscount, describeCodeBenefit, type CheckoutCode } from '@/lib/checkout-codes'
import { onlineChannel, promotionDiscount, promotionReceiptLabel, type AppliedPromotion } from '@/lib/promotions'
import { usePromotions } from '@/lib/use-promotions'

type Step = 'cart' | 'checkout' | 'done'
type Fulfilment = 'delivery' | 'pickup'
type Direction = 'forward' | 'back'
type ZoneStatus = { state: 'idle' | 'checking' } | { state: 'ok' | 'out' | 'error'; message: string }
type FieldName = 'name' | 'phone' | 'street' | 'city'
const FIELD_LABELS: Record<FieldName, string> = { name: 'imię', phone: 'telefon', street: 'ulica i numer', city: 'miasto' }

async function lookupCheckoutCode(raw: string): Promise<CheckoutCode> {
  const code = raw.trim().toUpperCase().replace(/\s+/g, '')
  if (code === GUEST_PROMO_CODE) return GUEST_CHECKOUT_CODE
  const { data, error } = await createClient().rpc('checkout_code_preview', { p_code: code })
  if (error || !data) throw new Error(checkoutCodeError(error?.message))
  return data as CheckoutCode
}

const stepLabels: Record<Step, string> = { cart: 'Koszyk', checkout: 'Dane', done: 'Gotowe' }

export function CartSheet() {
  const { isOpen, setOpen, lines, subtotal, clear } = useCart()
  const [step, setStep] = useState<Step>('cart')
  const [fulfilment, setFulfilment] = useState<Fulfilment>('delivery')
  const [appliedCode, setAppliedCode] = useState<CheckoutCode | null>(null)
  const [orderNumber, setOrderNumber] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  // Kept across retries until an order is confirmed, so a resend after a dropped connection cannot create a second order.
  const requestIdRef = useRef<string | null>(null)

  const [zoneFee, setZoneFee] = useState<number | null>(null)

  const { products } = useMenu()
  const { status: restaurant } = useRestaurantStatus({ enabled: isOpen })
  const zones = restaurant?.deliveryZones ?? DEFAULT_DELIVERY_ZONES
  const minOrder = restaurant?.minOrderOnline ?? DEFAULT_MIN_ORDER
  const { promotions, now } = usePromotions()
  const promotion = now
    ? promotionDiscount(lines.map((line) => ({ productId: line.productId, category: products.find((entry) => entry.id === line.productId)?.category, amount: line.unitPrice * line.quantity, quantity: line.quantity })), promotions, onlineChannel(fulfilment === 'pickup'), now)
    : { discount: 0, applied: [] as AppliedPromotion[] }
  const discount = Math.round(Math.min(subtotal, promotion.discount + codeDiscount(subtotal - promotion.discount, appliedCode)) * 100) / 100
  const codeDiscountAmount = Math.round((discount - promotion.discount) * 100) / 100
  const freeDeliveryFrom = restaurant?.freeDeliveryFrom ?? null
  const freeDelivery = freeDeliveryFrom !== null && subtotal >= freeDeliveryFrom
  const delivery = fulfilment === 'pickup' || subtotal === 0 || freeDelivery ? 0 : zoneFee
  const packaging = lines.length ? packagingTotal(autoPackaging(lines.flatMap((line) => {
    const product = products.find((entry) => entry.id === line.productId)
    return product ? [{ product, quantity: line.quantity }] : []
  }), 'Dostawa'), restaurant?.packagingPrices) : 0
  const total = Math.round((subtotal + packaging - discount + (delivery ?? 0)) * 100) / 100

  const [note, setNote] = useState('')
  const [direction, setDirection] = useState<Direction>('forward')
  const [checkoutMounted, setCheckoutMounted] = useState(false)
  const stepRef = useRef(step)
  const ownsHistory = useRef(false)

  useEffect(() => {
    stepRef.current = step
  }, [step])

  // The sheet mirrors its steps in browser history so the phone back button / back gesture
  // walks back through the cart instead of leaving the site.
  useEffect(() => {
    if (!isOpen) {
      const depth = Number(window.history.state?.cartDepth ?? 0)
      if (ownsHistory.current && depth > 0) window.history.go(-depth)
      ownsHistory.current = false
      return
    }
    ownsHistory.current = true
    if (!window.history.state?.cartDepth) pushCartHistory(1)

    const onPopState = (event: PopStateEvent) => {
      const depth = Number(event.state?.cartDepth ?? 0)
      if (depth === 0 || stepRef.current === 'done') {
        setOpen(false)
        return
      }
      if (depth === 1) {
        setDirection('back')
        setStep('cart')
      } else {
        setDirection('forward')
        setCheckoutMounted(true)
        setStep('checkout')
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [isOpen, setOpen])

  const goToCheckout = () => {
    setDirection('forward')
    setCheckoutMounted(true)
    setStep('checkout')
    if (window.history.state?.cartDepth === 1) pushCartHistory(2)
  }

  const goBackToCart = () => {
    if (window.history.state?.cartDepth === 2) {
      window.history.back()
      return
    }
    setDirection('back')
    setStep('cart')
  }

  const handleOpenChange = (open: boolean) => {
    setOpen(open)
  }
  const [wasOpen, setWasOpen] = useState(isOpen)
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen)
    if (isOpen && step !== 'cart') {
      setDirection('forward')
      setStep('cart')
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        overlayClassName="duration-200 max-sm:bg-muted max-sm:supports-backdrop-filter:backdrop-blur-none"
        className={cn(
          'w-full gap-0 overflow-hidden bg-muted p-0 data-[side=right]:w-full data-[side=right]:max-w-none data-[side=right]:sm:max-w-md',
          step === 'done' && 'bg-ink data-[side=right]:border-l-0',
        )}
      >
        <StepPane active={step === 'cart'} direction={direction}>
          <CartStep
            note={note}
            onNoteChange={setNote}
            discount={codeDiscountAmount}
            promotions={promotion.applied}
            delivery={delivery}
            pickup={fulfilment === 'pickup'}
            zones={zones}
            freeDeliveryFrom={freeDeliveryFrom}
            subtotal={subtotal}
            minOrder={minOrder}
            packaging={packaging}
            total={total}
            appliedCode={appliedCode}
            onApplyPromo={async (code) => {
              try {
                const found = await lookupCheckoutCode(code)
                setAppliedCode(found)
                toast.success(`Kod ${found.code} aktywny`, { description: describeCodeBenefit(found) })
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Nieprawidłowy kod rabatowy')
              }
            }}
            onRemovePromo={() => setAppliedCode(null)}
            onNext={goToCheckout}
          />
        </StepPane>
        {checkoutMounted && (
          <StepPane active={step === 'checkout'} direction={direction}>
          <CheckoutStep
            note={note}
            onNoteChange={setNote}
            fulfilment={fulfilment}
            onFulfilmentChange={setFulfilment}
            onZoneFee={setZoneFee}
            deliveryShortfall={Math.max(0, Math.round((minOrder - subtotal) * 100) / 100)}
            minOrder={minOrder}
            zones={zones}
            delivery={delivery}
            total={total}
            submitting={submitting}
            error={submitError}
            onBack={goBackToCart}
            onSubmit={async (formData) => {
              setSubmitting(true)
              setSubmitError('')
              requestIdRef.current ??= crypto.randomUUID()
              try {
                if (!navigator.onLine) throw new Error('Brak połączenia z internetem. Sprawdź sieć i spróbuj ponownie.')
                const response = await fetch('/api/orders', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  signal: AbortSignal.timeout(25_000),
                  body: JSON.stringify({
                    clientRequestId: requestIdRef.current,
                    customer: formData.get('name'),
                    phone: formData.get('phone'),
                    address: formData.get('street'),
                    city: formData.get('city'),
                    type: fulfilment === 'delivery' ? 'Dostawa' : 'Odbiór osobisty',
                    promoCode: appliedCode?.code,
                    scheduledFor: formData.get('scheduledFor') || null,
                    paymentMethod: formData.get('paymentMethod'),
                    customerNote: note.trim() || null,
                    lines: lines.map(({ productId, quantity, details, selection }) => ({ productId, quantity, details, selection })),
                  }),
                })
                const result = await response.json().catch(() => ({})) as { orderNumber?: number; error?: string }
                if (!response.ok || !result.orderNumber) throw new Error(result.error ?? 'Nie udało się złożyć zamówienia. Spróbuj ponownie.')
                requestIdRef.current = null
                setOrderNumber(result.orderNumber)
                clear()
                setAppliedCode(null)
                setNote('')
                setDirection('forward')
                setStep('done')
              } catch (error) {
                const name = (error as { name?: string } | null)?.name
                const connectionLost = name === 'TypeError' || name === 'TimeoutError' || name === 'AbortError'
                setSubmitError(connectionLost
                  ? 'Połączenie zostało przerwane. Kliknij ponownie – jeśli zamówienie już dotarło, nie zostanie zdublowane.'
                  : error instanceof Error ? error.message : 'Nie udało się złożyć zamówienia.')
              } finally {
                setSubmitting(false)
              }
            }}
          />
          </StepPane>
        )}
        {step === 'done' && (
          <StepPane active direction="forward">
            <DoneStep fulfilment={fulfilment} orderNumber={orderNumber} onClose={() => handleOpenChange(false)} />
          </StepPane>
        )}
      </SheetContent>
    </Sheet>
  )
}

function pushCartHistory(depth: number) {
  window.history.pushState({ ...window.history.state, cartDepth: depth }, '')
}

function StepPane({ active, direction, children }: { active: boolean; direction: Direction; children: React.ReactNode }) {
  return (
    <div
      hidden={!active}
      inert={!active}
      className={cn('flex min-h-0 flex-1 flex-col', active && (direction === 'forward' ? 'cart-step-forward' : 'cart-step-back'))}
    >
      {children}
    </div>
  )
}

function CartNote({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(value.length > 0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const trimmed = value.trim()

  function toggle() {
    const next = !open
    setOpen(next)
    if (next) requestAnimationFrame(() => textareaRef.current?.focus({ preventScroll: true }))
    else textareaRef.current?.blur()
  }

  // One persistent element that collapses via grid-rows: swapping elements on blur changed the height
  // abruptly while the mobile keyboard was closing, which made the whole sheet jump.
  return (
    <section className="mt-2.5 overflow-hidden rounded-xl bg-card ring-1 ring-border sm:mt-3 sm:rounded-2xl" aria-labelledby="cart-note-title">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="cart-note-panel"
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/50 sm:py-2.5"
      >
        <MessageSquareText className="size-3.5 shrink-0 text-primary sm:size-4" aria-hidden="true" />
        <span id="cart-note-title" className="min-w-0 flex-1 truncate text-[12.5px] font-bold sm:text-sm">
          Uwagi do zamówienia
          <span className="ml-1 font-normal text-muted-foreground">
            {!open && trimmed ? `· ${trimmed}` : open ? `· ${value.length}/300` : '· opcjonalnie'}
          </span>
        </span>
        <Plus className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-45')} aria-hidden="true" />
      </button>
      <div
        id="cart-note-panel"
        inert={!open}
        className={cn('grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-2.5 pb-2.5 pt-1 sm:px-3 sm:pb-3">
            <label htmlFor="cart-note" className="sr-only">Uwagi do zamówienia (opcjonalnie)</label>
            <textarea
              ref={textareaRef}
              id="cart-note"
              rows={2}
              maxLength={300}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="np. bez ogórków, sos osobno"
              className="block min-h-[3.25rem] w-full resize-none rounded-lg bg-muted/50 px-2.5 py-1.5 text-base leading-snug outline-none ring-1 ring-border transition-shadow placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary sm:rounded-xl sm:px-3 sm:py-2"
            />
            <p className="mt-1 hidden text-[11px] text-muted-foreground sm:block">Możesz to jeszcze zmienić w następnym kroku.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function StepHeader({ step, title, meta, onBack, action }: { step: Step; title: string; meta?: string; onBack?: () => void; action?: React.ReactNode }) {
  const order: Step[] = ['cart', 'checkout', 'done']
  const current = order.indexOf(step)
  return (
    <header className="border-b border-border bg-background px-4 pb-3 pt-3.5 sm:px-5 sm:pt-4">
      <div className="flex items-center gap-2.5 pr-9">
        {onBack ? (
          <button type="button" onClick={onBack} className="-ml-1 grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-background transition-[background-color,scale] hover:bg-foreground/85 active:scale-90">
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span className="sr-only">Wróć do koszyka</span>
          </button>
        ) : (
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground" aria-hidden="true">
            <ShoppingBag className="size-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Krok {current + 1} z 3
          </p>
          <div className="flex items-baseline gap-2">
            <SheetTitle className="truncate text-lg font-extrabold leading-tight tracking-tight">{title}</SheetTitle>
            {meta && <span className="shrink-0 font-mono text-xs font-semibold text-muted-foreground">{meta}</span>}
          </div>
        </div>
        {action}
      </div>
      <ol className="mt-3 grid grid-cols-3 gap-1.5" aria-label="Etapy zamówienia">
        {order.map((entry, index) => (
          <li key={entry} aria-current={index === current ? 'step' : undefined} className="min-w-0">
            <span className={cn('block h-1 rounded-full transition-colors', index <= current ? 'bg-primary' : 'bg-border')} aria-hidden="true" />
            <span
              className={cn(
                'mt-1 block truncate text-[10px] font-semibold uppercase tracking-wider',
                index === current ? 'text-foreground' : 'text-muted-foreground/70',
              )}
            >
              {stepLabels[entry]}
            </span>
          </li>
        ))}
      </ol>
    </header>
  )
}

const ADD_ON_GROUPS = [
  { id: 'sosy', label: 'Sosy' },
  { id: 'frytki-dodatki', label: 'Dodatki' },
  { id: 'napoje', label: 'Napoje' },
  { id: 'desery', label: 'Desery' },
] as const

function AddOns() {
  const { lines, addLine, updateQuantity, openProduct } = useCart()
  const { products } = useMenu()
  // Order is frozen on mount so adding an item never reshuffles the tabs under the user's finger.
  const [inCartOnOpen] = useState(() => new Set(lines.map((line) => line.category)))
  const groups = ADD_ON_GROUPS
    .map((group) => ({ ...group, items: products.filter((product) => product.category === group.id).slice(0, 8) }))
    .filter((group) => group.items.length > 0)
    .sort((a, b) => Number(inCartOnOpen.has(a.id)) - Number(inCartOnOpen.has(b.id)))
  const [active, setActive] = useState<string | null>(null)
  const current = groups.find((group) => group.id === active) ?? groups[0]
  if (!current) return null

  return (
    <section className="mt-4 rounded-2xl bg-card p-3 ring-1 ring-border" aria-labelledby="addons-title">
      <div className="flex items-center justify-between gap-2">
        <h3 id="addons-title" className="text-sm font-extrabold">Dorzuć do zamówienia</h3>
        <span className="text-[11px] text-muted-foreground">jednym kliknięciem</span>
      </div>
      <div role="tablist" aria-label="Rodzaj dodatku" className="mt-2.5 flex gap-1 rounded-full bg-muted p-1">
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            role="tab"
            aria-selected={group.id === current.id}
            onClick={() => setActive(group.id)}
            className={cn(
              'h-7 flex-1 rounded-full text-xs font-bold transition-colors',
              group.id === current.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {group.label}
          </button>
        ))}
      </div>
      <ul role="tabpanel" aria-label={current.label} className="mt-2.5 grid grid-cols-1 gap-1.5 min-[400px]:grid-cols-2">
        {current.items.map((p) => {
          const line = lines.find((entry) => entry.productId === p.id)
          const count = lines.filter((entry) => entry.productId === p.id).reduce((sum, entry) => sum + entry.quantity, 0)
          return (
            <li key={p.id} className="min-w-0">
              <div className={cn('flex h-full items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-2 ring-1 transition-colors', count ? 'bg-primary/5 ring-primary/40' : 'bg-muted/40 ring-border')}>
                {p.image && (
                  <div className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-cream">
                    <Image src={p.image} alt="" fill sizes="36px" className="object-cover" />
                  </div>
                )}
                <div className={cn('min-w-0 flex-1', !p.image && 'pl-1.5')}>
                  <p className="truncate text-xs font-semibold leading-tight">{formatAddonName(p.name)}</p>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">+{formatPrice(p.price)}</span>
                </div>
                <div className="shrink-0">
                  {count > 0 && line && !hasConfigurator(p) ? (
                    <MiniStepper value={count} label={p.name} onChange={(q) => updateQuantity(line.key, q)} compact />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (hasConfigurator(p) || p.extras?.length) {
                          openProduct(p)
                          return
                        }
                        addLine({
                          productId: p.id,
                          name: p.name,
                          image: p.image,
                          unitPrice: p.price,
                          quantity: 1,
                          details: p.variantLabel ? [p.variantLabel] : p.sizes ? [p.sizes[0].label] : [],
                          category: p.category,
                        })
                      }}
                      className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-90"
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      <span className="sr-only">Dodaj {p.name}</span>
                    </button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function formatAddonName(name: string) {
  if (name !== name.toLocaleUpperCase('pl-PL')) return name
  const lower = name.toLocaleLowerCase('pl-PL')
  return lower.charAt(0).toLocaleUpperCase('pl-PL') + lower.slice(1)
}

function ReceiptPaper({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('drop-shadow-[0_1px_1px_rgba(20,17,16,0.08)]', className)}>
      <div className="receipt-tear-top" aria-hidden="true" />
      <div className="bg-card px-3.5 py-3 sm:px-5 sm:py-4">{children}</div>
      <div className="receipt-tear-bottom" aria-hidden="true" />
    </div>
  )
}

function ReceiptRow({ label, value, className, valueClassName }: { label: React.ReactNode; value: React.ReactNode; className?: string; valueClassName?: string }) {
  return (
    <div className={cn('flex items-baseline gap-2', className)}>
      <dt className="min-w-0 break-words">{label}</dt>
      <span className="mb-1 min-w-4 flex-1 border-b border-dotted border-foreground/25" aria-hidden="true" />
      <dd className={cn('shrink-0 text-right font-mono tabular-nums', valueClassName)}>{value}</dd>
    </div>
  )
}

function MiniStepper({ value, onChange, label, compact }: { value: number; onChange: (value: number) => void; label: string; compact?: boolean }) {
  const size = compact ? 'size-6' : 'size-7'
  return (
    <div className={cn('inline-flex items-center rounded-full', compact ? 'h-6 bg-primary text-primary-foreground' : 'h-7 bg-muted')}>
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className={cn('grid place-items-center rounded-full transition-colors hover:bg-foreground/10', size)}
      >
        {value <= 1 ? <Trash2 className="size-3" aria-hidden="true" /> : <Minus className="size-3.5" aria-hidden="true" />}
        <span className="sr-only">{value <= 1 ? `Usuń ${label}` : `Zmniejsz ilość: ${label}`}</span>
      </button>
      <span className={cn('text-center font-mono text-xs font-bold tabular-nums', compact ? 'w-3' : 'w-5')} aria-live="polite">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(20, value + 1))}
        className={cn('grid place-items-center rounded-full transition-colors hover:bg-foreground/10', size)}
      >
        <Plus className="size-3.5" aria-hidden="true" />
        <span className="sr-only">Zwiększ ilość: {label}</span>
      </button>
    </div>
  )
}

function CartStep({
  note,
  onNoteChange,
  discount,
  promotions,
  delivery,
  pickup,
  zones,
  freeDeliveryFrom,
  subtotal,
  minOrder,
  packaging,
  total,
  appliedCode,
  onApplyPromo,
  onRemovePromo,
  onNext,
}: {
  note: string
  onNoteChange: (value: string) => void
  discount: number
  promotions: AppliedPromotion[]
  delivery: number | null
  pickup: boolean
  zones: DeliveryZone[]
  freeDeliveryFrom: number | null
  subtotal: number
  minOrder: number
  packaging: number
  total: number
  appliedCode: CheckoutCode | null
  onApplyPromo: (code: string) => Promise<void>
  onRemovePromo: () => void
  onNext: () => void
}) {
  const [checking, setChecking] = useState(false)
  const { lines, updateQuantity, clear, setOpen } = useCart()
  const [code, setCode] = useState('')
  const belowMinimum = subtotal < minOrder
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0)
  const [printedAt] = useState(() => new Date())
  const freeDeliveryMissing = !pickup && freeDeliveryFrom !== null && subtotal < freeDeliveryFrom ? freeDeliveryFrom - subtotal : 0
  const freeDeliveryProgress = freeDeliveryFrom ? Math.min(100, Math.round((subtotal / freeDeliveryFrom) * 100)) : 100

  return (
    <>
      <StepHeader
        step="cart"
        title="Twój koszyk"
        meta={itemCount ? `${itemCount} szt.` : undefined}
        action={lines.length > 0 && (
          <button type="button" onClick={clear} className="inline-flex h-9 min-w-9 shrink-0 items-center justify-center gap-1 rounded-full px-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-primary sm:px-2.5">
            <Trash2 className="size-4 sm:size-3.5" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Wyczyść</span>
          </button>
        )}
      />
      <SheetDescription className="sr-only">Produkty w koszyku i podsumowanie zamówienia</SheetDescription>

      {lines.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <ReceiptPaper className="w-full max-w-xs">
            <div className="flex flex-col items-center py-4 text-center">
              <ShoppingBag className="size-8 text-primary" aria-hidden="true" />
              <p className="mt-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">Paragon pusty</p>
              <p className="mt-1 text-base font-extrabold">Nic tu jeszcze nie ma</p>
              <p className="mt-1 text-xs text-muted-foreground">Dodaj coś pysznego z naszego menu.</p>
              <a
                href="#menu"
                onClick={(e) => {
                  e.preventDefault()
                  setOpen(false)
                  window.setTimeout(() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' }), 250)
                }}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"
              >
                Przejdź do menu
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            </div>
          </ReceiptPaper>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4">
            <UnavailableNotice className="mb-3" />

            <ReceiptPaper>
              <div className="text-center">
                <p className="font-mono text-sm font-bold uppercase tracking-[0.3em]">{RESTAURANT.name}</p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {printedAt.toLocaleDateString('pl-PL')} · {printedAt.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })} · {itemCount} {itemCount === 1 ? 'szt.' : 'szt.'}
                </p>
              </div>

              <div className="receipt-rule my-2.5" aria-hidden="true" />

              <ul className="divide-y divide-dashed divide-border">
                {lines.map((line) => (
                  <li key={line.key} className="flex min-w-0 select-none gap-2.5 py-2.5 first:pt-0.5 last:pb-0.5">
                    <div className="relative size-11 shrink-0 overflow-hidden rounded-md bg-cream sm:size-12">
                      <Image src={line.image || '/placeholder.svg'} alt="" fill sizes="48px" className="object-cover" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex min-w-0 items-start gap-2">
                        <p className="min-w-0 flex-1 break-words text-[13px] font-bold leading-tight sm:text-sm">{line.name}</p>
                        <p className="shrink-0 font-mono text-[13px] font-semibold tabular-nums sm:text-sm">{formatPrice(line.unitPrice * line.quantity)}</p>
                      </div>
                      {line.details.length > 0 && (
                        <p className="mt-0.5 break-words text-[11px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">{line.details.join(' · ')}</p>
                      )}
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                          {line.quantity} × {formatPrice(line.unitPrice)}
                        </span>
                        <MiniStepper value={line.quantity} label={line.name} onChange={(q) => updateQuantity(line.key, q)} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="receipt-rule my-2.5" aria-hidden="true" />

              <dl className="space-y-1 text-xs sm:text-[13px]">
                <ReceiptRow label={<span className="text-muted-foreground">Suma produktów</span>} value={formatPrice(subtotal)} />
                {promotions.map((entry) => (
                  <ReceiptRow
                    key={entry.promotion.id}
                    className="text-primary"
                    label={promotionReceiptLabel(entry)}
                    value={`−${formatPrice(entry.amount)}`}
                  />
                ))}
                {discount > 0 && <ReceiptRow className="text-primary" label={`Rabat ${appliedCode?.code ?? ''}`} value={`−${formatPrice(discount)}`} />}
                {appliedCode?.items.map((item) => (
                  <ReceiptRow key={item.name} className="text-primary" label={`${item.quantity}× ${item.name}`} value="GRATIS" />
                ))}
                {packaging > 0 && <ReceiptRow label={<span className="text-muted-foreground">Opakowania i torba</span>} value={formatPrice(packaging)} />}
                <ReceiptRow
                  label={<span className="text-muted-foreground">Dostawa</span>}
                  valueClassName={cn(!pickup && delivery === 0 && 'font-semibold text-emerald-700')}
                  value={pickup ? 'odbiór' : delivery === null ? `od ${formatPrice(Math.min(...zones.map((zone) => zone.fee)))}` : delivery === 0 ? 'GRATIS' : formatPrice(delivery)}
                />
              </dl>

              <div className="receipt-rule my-2.5" aria-hidden="true" />

              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wider">{delivery === null && !pickup ? 'Razem bez dostawy' : 'Do zapłaty'}</span>
                <span className="font-mono text-lg font-bold tabular-nums">{formatPrice(total)}</span>
              </div>

              {freeDeliveryMissing > 0 && (
                <div className="mt-2.5">
                  <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${freeDeliveryProgress}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Darmowa dostawa od {formatPrice(freeDeliveryFrom ?? 0)} — brakuje <strong className="text-foreground">{formatPrice(freeDeliveryMissing)}</strong>
                  </p>
                </div>
              )}
              {!pickup && delivery === null && (
                <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">Koszt dostawy policzymy po wpisaniu adresu.</p>
              )}

              <div className="receipt-rule my-2.5" aria-hidden="true" />

              {appliedCode ? (
                <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-2.5 py-2">
                  <Tag className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-bold text-primary">{appliedCode.code}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{describeCodeBenefit(appliedCode)}</p>
                  </div>
                  <button type="button" onClick={onRemovePromo} className="grid size-7 shrink-0 place-items-center rounded-full hover:bg-background">
                    <X className="size-3.5" aria-hidden="true" />
                    <span className="sr-only">Usuń kod {appliedCode.code}</span>
                  </button>
                </div>
              ) : (
                <form
                  className="flex items-center gap-2 rounded-lg border border-dashed border-foreground/25 py-1 pl-2.5 pr-1"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    setChecking(true)
                    await onApplyPromo(code)
                    setChecking(false)
                  }}
                >
                  <Tag className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <label htmlFor="promo" className="sr-only">Kod rabatowy lub kupon Yummy Club</label>
                  <input
                    id="promo"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Kod rabatowy lub kupon"
                    className="h-8 min-w-0 flex-1 bg-transparent font-mono text-xs uppercase outline-none placeholder:font-sans placeholder:normal-case placeholder:text-muted-foreground"
                  />
                  <button
                    type="submit"
                    disabled={checking || !code.trim()}
                    className="inline-flex h-7 items-center gap-1 rounded-md bg-foreground px-3 text-xs font-semibold text-background disabled:opacity-30"
                  >
                    {checking && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
                    Użyj
                  </button>
                </form>
              )}

              <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Dziękujemy · Smacznego</p>
            </ReceiptPaper>

            <CartNote value={note} onChange={onNoteChange} />

            <AddOns />

            <DeliveryZonesInfo zones={zones} className="mt-3" />
          </div>

          <div className="border-t border-border bg-background px-3 py-2.5 sm:px-5 sm:py-3.5">
            {belowMinimum && (
              <p role="status" className="mb-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-900">
                Dostawa od <strong>{formatPrice(minOrder)}</strong> — dodaj jeszcze za {formatPrice(minOrder - subtotal)} albo wybierz odbiór osobisty (bez minimum).
              </p>
            )}
            <button
              type="button"
              onClick={onNext}
              className="flex h-12 w-full items-center justify-between gap-3 rounded-xl bg-primary pl-4 pr-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:bg-foreground/80"
            >
              <span>Przejdź dalej</span>
              <span className="flex items-center gap-2 rounded-lg bg-black/15 px-2.5 py-1 font-mono tabular-nums">
                {formatPrice(total)}
                <ArrowRight className="size-4" aria-hidden="true" />
              </span>
            </button>
          </div>
        </>
      )}
    </>
  )
}

function DeliveryZonesInfo({ zones, className }: { zones: DeliveryZone[]; className?: string }) {
  const { status } = useRestaurantStatus()
  const freeFrom = status?.freeDeliveryFrom ?? null
  return (
    <details className={cn('group rounded-lg bg-background/60 px-3 py-2 text-[11px] ring-1 ring-border', className)}>
      <summary className="cursor-pointer select-none font-semibold text-muted-foreground">Cennik dostawy</summary>
      <dl className="mt-1.5 space-y-0.5">
        {zones.map((zone, index) => (
          <ReceiptRow key={zone.upToKm} label={<span className="text-muted-foreground">{formatZoneRange(zones, index)}</span>} value={formatPrice(zone.fee)} />
        ))}
        {freeFrom !== null && (
          <ReceiptRow
            className="pt-0.5 font-semibold text-emerald-700"
            label={freeFrom === 0 ? 'Każde zamówienie' : `Zamówienie od ${formatPrice(freeFrom)}`}
            value="GRATIS"
          />
        )}
      </dl>
    </details>
  )
}

function CheckoutStep({
  note,
  onNoteChange,
  fulfilment,
  onFulfilmentChange,
  onZoneFee,
  deliveryShortfall,
  minOrder,
  zones,
  delivery,
  total,
  submitting,
  error,
  onBack,
  onSubmit,
}: {
  note: string
  onNoteChange: (value: string) => void
  fulfilment: Fulfilment
  onFulfilmentChange: (f: Fulfilment) => void
  onZoneFee: (fee: number | null) => void
  deliveryShortfall: number
  minOrder: number
  zones: DeliveryZone[]
  delivery: number | null
  total: number
  submitting: boolean
  error: string
  onBack: () => void
  onSubmit: (formData: FormData) => void
}) {
  const { status: restaurant } = useRestaurantStatus()
  const orderingClosed = !!restaurant?.preorderReason
  const closedInfo = !orderingClosed ? restaurant?.reason ?? null : null
  const [scheduleError, setScheduleError] = useState('')
  const [selectedPayment, setPayment] = useState<'cash' | 'card' | null>(null)
  const [paymentError, setPaymentError] = useState('')
  const paymentRef = useRef<HTMLDivElement>(null)
  const [zone, setZone] = useState<ZoneStatus>({ state: 'idle' })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({})
  const missingFields = (Object.keys(fieldErrors) as FieldName[]).filter((key) => fieldErrors[key]).map((key) => FIELD_LABELS[key])
  const zoneRequest = useRef(0)
  const formRef = useRef<HTMLFormElement>(null)

  const validate = (data: FormData) => {
    const value = (key: string) => String(data.get(key) ?? '').trim()
    const errors: Partial<Record<FieldName, string>> = {}
    if (value('name').length < 2) errors.name = 'Podaj imię'
    if (!value('phone')) errors.phone = 'Podaj numer telefonu'
    else if (!/^[0-9 +()-]{9,20}$/.test(value('phone'))) errors.phone = 'Numer telefonu wygląda na niepełny'
    if (fulfilment === 'delivery') {
      if (value('street').length < 3) errors.street = 'Podaj ulicę i numer'
      if (value('city').length < 2) errors.city = 'Podaj miasto'
    }
    return errors
  }

  const clearFieldError = (name: FieldName) => {
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const checkZone = async (): Promise<ZoneStatus> => {
    const form = formRef.current
    if (!form) return { state: 'idle' }
    const data = new FormData(form)
    const street = String(data.get('street') ?? '').trim()
    const city = String(data.get('city') ?? '').trim()
    if (street.length < 3 || city.length < 2) {
      setZone({ state: 'idle' })
      onZoneFee(null)
      return { state: 'idle' }
    }
    const requestId = ++zoneRequest.current
    setZone({ state: 'checking' })
    let next: ZoneStatus
    let fee: number | null = null
    try {
      const response = await fetch('/api/delivery/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ street, city }),
      })
      const result = (await response.json()) as { ok: boolean; distanceKm?: number; fee?: number; message?: string; reason?: string }
      fee = result.ok && typeof result.fee === 'number' ? result.fee : null
      next = result.ok
        ? { state: 'ok', message: `Dowozimy · ${formatDistance(result.distanceKm ?? 0)} od lokalu · dostawa ${formatPrice(fee ?? 0)}` }
        : { state: result.reason === 'unavailable' ? 'error' : 'out', message: result.message ?? 'Nie udało się sprawdzić adresu.' }
    } catch {
      next = { state: 'error', message: 'Nie udało się sprawdzić adresu. Spróbuj ponownie.' }
    }
    if (requestId === zoneRequest.current) {
      setZone(next)
      onZoneFee(fee)
    }
    return next
  }

  const addressBlocked = fulfilment === 'delivery' && zone.state === 'out'
  const belowDeliveryMinimum = fulfilment === 'delivery' && deliveryShortfall > 0

  const options = [
    { id: 'delivery' as const, icon: Bike, label: 'Dostawa', hint: `do ${formatKm(deliveryRadius(zones))} km · od ${formatPrice(Math.min(...zones.map((entry) => entry.fee)))}` },
    { id: 'pickup' as const, icon: Store, label: 'Odbiór', hint: RESTAURANT.shortAddress },
  ]

  const handoverPlace = fulfilment === 'delivery' ? 'kierowcy' : 'w lokalu'
  const paymentOptions = [
    { id: 'cash' as const, icon: Banknote, label: 'Gotówka', hint: `płacisz ${handoverPlace}`, enabled: restaurant?.cashPaymentEnabled ?? true },
    { id: 'card' as const, icon: CreditCard, label: 'Karta / BLIK', hint: `terminal ${fulfilment === 'delivery' ? 'u kierowcy' : 'w lokalu'}`, enabled: restaurant?.cardPaymentEnabled ?? true },
  ]
  const enabledPayments = paymentOptions.filter((option) => option.enabled)
  const payment = selectedPayment && paymentOptions.some((option) => option.id === selectedPayment && option.enabled) ? selectedPayment : enabledPayments.length === 1 ? enabledPayments[0].id : null
  const disabledPayment = paymentOptions.find((option) => !option.enabled)

  return (
    <form
      ref={formRef}
      className="flex min-h-0 flex-1 flex-col"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault()
        const form = e.currentTarget
        const formData = new FormData(form)
        const errors = validate(formData)
        setFieldErrors(errors)
        const firstInvalid = (Object.keys(errors) as FieldName[])[0]
        if (firstInvalid) {
          const input = form.elements.namedItem(firstInvalid) as HTMLInputElement | null
          input?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          input?.focus({ preventScroll: true })
          return
        }
        if (!formData.get('scheduledFor')) {
          setScheduleError('Wybierz godzinę zamówienia.')
          return
        }
        setScheduleError('')
        if (!payment) {
          setPaymentError('Wybierz formę płatności.')
          paymentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          return
        }
        formData.set('paymentMethod', payment)
        if (belowDeliveryMinimum) return
        if (zone.state === 'checking') return
        if (fulfilment === 'delivery' && zone.state !== 'ok') {
          const result = await checkZone()
          if (result.state === 'out') return
        }
        void onSubmit(formData)
      }}
    >
      <StepHeader step="checkout" title="Odbiór i dane" onBack={onBack} />
      <SheetDescription className="sr-only">Wybierz sposób odbioru i podaj dane kontaktowe</SheetDescription>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
        <GuestLoginPrompt />
        <Section number="1" title="Sposób odbioru">
          <div role="radiogroup" aria-label="Sposób odbioru" className="grid grid-cols-2 gap-2.5">
            {options.map(({ id, icon: Icon, label, hint }) => (
              <ChoiceTile key={id} selected={fulfilment === id} onSelect={() => onFulfilmentChange(id)} icon={Icon} label={label} hint={hint} />
            ))}
          </div>
        </Section>

        <Section number="2" title={fulfilment === 'delivery' ? 'Dane i adres' : 'Dane kontaktowe'}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field id="name" label="Imię" icon={User} placeholder="np. Kasia" autoComplete="given-name" required error={fieldErrors.name} onInput={() => clearFieldError('name')} />
            <Field id="phone" label="Telefon" icon={Phone} placeholder="np. 600 100 200" type="tel" inputMode="tel" autoComplete="tel" required error={fieldErrors.phone} onInput={() => clearFieldError('phone')} />
          </div>
          {fulfilment === 'delivery' && (
            <div className="mt-2.5 space-y-2.5">
              <div className="grid grid-cols-[1fr_8rem] gap-2.5">
                <Field
                  id="street"
                  label="Ulica i numer"
                  icon={MapPin}
                  placeholder="np. Rynek 12/3"
                  autoComplete="street-address"
                  required
                  error={fieldErrors.street}
                  aria-describedby="delivery-zone-status"
                  aria-invalid={addressBlocked || undefined}
                  onChange={() => {
                    clearFieldError('street')
                    if (zone.state !== 'idle') setZone({ state: 'idle' })
                  }}
                  onBlur={() => void checkZone()}
                />
                <Field
                  id="city"
                  label="Miasto"
                  icon={Building2}
                  autoComplete="address-level2"
                  defaultValue="Rybnik"
                  required
                  error={fieldErrors.city}
                  aria-describedby="delivery-zone-status"
                  aria-invalid={addressBlocked || undefined}
                  onChange={() => {
                    clearFieldError('city')
                    if (zone.state !== 'idle') setZone({ state: 'idle' })
                  }}
                  onBlur={() => void checkZone()}
                />
              </div>
              <p
                id="delivery-zone-status"
                aria-live="polite"
                className={cn(
                  'flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] leading-snug',
                  zone.state === 'ok' && 'bg-emerald-50 text-emerald-800',
                  zone.state === 'out' && 'bg-red-50 text-red-700',
                  zone.state === 'error' && 'bg-amber-50 text-amber-800',
                  (zone.state === 'idle' || zone.state === 'checking') && 'bg-muted text-muted-foreground',
                )}
              >
                {zone.state === 'checking' ? (
                  <Loader2 className="mt-px size-3.5 shrink-0 animate-spin" aria-hidden="true" />
                ) : zone.state === 'ok' ? (
                  <CheckCircle2 className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                ) : zone.state === 'out' || zone.state === 'error' ? (
                  <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <MapPin className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>
                  {'message' in zone
                    ? zone.message
                    : zone.state === 'checking'
                      ? 'Sprawdzamy, czy dowozimy pod ten adres…'
                      : `Dowozimy do ${formatKm(deliveryRadius(zones))} km od ${RESTAURANT.name}. Cena zależy od odległości.`}
                </span>
              </p>
              <DeliveryZonesInfo zones={zones} className="bg-muted/50" />
            </div>
          )}
        </Section>

        <Section number="3" title={fulfilment === 'delivery' ? 'Na którą godzinę dostawa?' : 'Na którą godzinę odbiór?'}>
          {closedInfo && (
            <p className="mb-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs leading-snug text-amber-900">
              <Clock className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              <span>{closedInfo}</span>
            </p>
          )}
          <SchedulePicker key={fulfilment} openingHours={restaurant?.openingHours} closeBeforeMinutes={restaurant?.closeBeforeMinutes} leadMinutes={fulfilment === 'delivery' ? 45 : 20} />
        </Section>

        <Section number="4" title="Płatność">
          <div ref={paymentRef} role="radiogroup" aria-label="Forma płatności" aria-describedby={paymentError ? 'payment-error' : undefined} className="grid grid-cols-2 gap-2">
            {paymentOptions.map(({ id, icon, label, hint, enabled }) => (
              <ChoiceTile
                key={id}
                selected={payment === id}
                disabled={!enabled}
                onSelect={() => {
                  setPayment(id)
                  setPaymentError('')
                }}
                icon={icon}
                label={label}
                hint={enabled ? hint : 'chwilowo niedostępna'}
              />
            ))}
          </div>
          {disabledPayment && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs leading-snug text-amber-800">
              <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              <span>{disabledPayment.id === 'card' ? 'Terminal płatniczy chwilowo nie działa – dziś zapłacisz tylko gotówką.' : 'Chwilowo nie przyjmujemy gotówki – zapłacisz kartą lub BLIK-iem na terminalu.'}</span>
            </p>
          )}
          {paymentError && (
            <p id="payment-error" role="alert" className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs leading-snug text-red-700">
              <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              <span>{paymentError}</span>
            </p>
          )}
        </Section>

        <Section number="5" title="Uwagi do zamówienia">
          <label htmlFor="note" className="block rounded-xl bg-card px-3.5 py-2.5 ring-1 ring-border transition-shadow focus-within:ring-2 focus-within:ring-primary">
            <span className="flex items-center gap-2 text-[11px] font-semibold leading-tight text-muted-foreground">
              <MessageSquareText className="size-3.5" aria-hidden="true" />
              Opcjonalnie
            </span>
            <textarea
              id="note"
              name="note"
              rows={3}
              maxLength={300}
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="np. bez ogórków, sos osobno, domofon nie działa – proszę dzwonić"
              className="mt-1 block w-full resize-none bg-transparent text-base leading-snug outline-none placeholder:text-muted-foreground/60"
            />
          </label>
          <p className="mt-1 text-right font-mono text-[10px] tabular-nums text-muted-foreground">{note.length}/300</p>
        </Section>
      </div>

      <div className="border-t border-border bg-background px-3 py-2.5 sm:px-5 sm:py-3.5">
        {orderingClosed && <p role="status" className="mb-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">{restaurant?.preorderReason}</p>}
        {closedInfo && !orderingClosed && <p role="status" className="mb-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">{closedInfo}</p>}
        {missingFields.length > 0 && (
          <p role="alert" className="mb-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs leading-snug text-red-700">
            <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>Uzupełnij: {missingFields.join(', ')}</span>
          </p>
        )}
        {addressBlocked && missingFields.length === 0 && (
          <p role="alert" className="mb-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs leading-snug text-red-700">
            <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>Nie dowozimy pod ten adres. Zmień adres albo wybierz odbiór osobisty.</span>
          </p>
        )}
        {belowDeliveryMinimum && (
          <p role="status" className="mb-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs leading-snug text-amber-900">
            <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Dostawa od <strong>{formatPrice(minOrder)}</strong> — brakuje {formatPrice(deliveryShortfall)}. Odbiór osobisty jest bez minimum.
            </span>
          </p>
        )}
        {(scheduleError || error) && <p role="alert" className="mb-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700">{scheduleError || error}</p>}
        <button
          type="submit"
          disabled={submitting || orderingClosed || belowDeliveryMinimum}
          className="flex h-12 w-full items-center justify-between gap-3 rounded-xl bg-primary pl-4 pr-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:bg-foreground/80"
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            {(submitting || zone.state === 'checking') && <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />}
            {submitting ? 'Zapisywanie…' : orderingClosed ? 'Lokal nie przyjmuje zamówień' : belowDeliveryMinimum ? `Dostawa od ${formatPrice(minOrder)}` : zone.state === 'checking' ? 'Sprawdzamy adres…' : 'Zamawiam'}
          </span>
          <span className="shrink-0 rounded-lg bg-black/15 px-2.5 py-1 font-mono tabular-nums">{formatPrice(total)}</span>
        </button>
        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
          {fulfilment === 'delivery' && delivery === null ? 'Kwota bez dostawy · ' : ''}Płatność przy odbiorze{payment ? ` – ${payment === 'cash' ? 'gotówką' : 'kartą'}` : ' – gotówką lub kartą'}
        </p>
        <p className="mt-1 text-center text-[11px] leading-snug text-muted-foreground">
          Składając zamówienie, akceptujesz{' '}
          <a href="/regulaminy?dokument=regulamin" target="_blank" rel="noopener" className="font-semibold text-foreground underline underline-offset-2 hover:text-primary">
            Regulamin
          </a>{' '}
          i{' '}
          <a href="/regulaminy?dokument=polityka-prywatnosci" target="_blank" rel="noopener" className="font-semibold text-foreground underline underline-offset-2 hover:text-primary">
            Politykę prywatności
          </a>
          .
        </p>
      </div>
    </form>
  )
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="sr-only">{title}</legend>
      <p className="mb-3 flex items-center gap-2.5" aria-hidden="true">
        <span className="font-mono text-xs font-bold text-primary">{number.padStart(2, '0')}</span>
        <span className="text-[15px] font-extrabold tracking-tight">{title}</span>
        <span className="h-px flex-1 bg-border" />
      </p>
      {children}
    </fieldset>
  )
}

function ChoiceTile({
  selected,
  onSelect,
  icon: Icon,
  label,
  hint,
  disabled = false,
}: {
  selected: boolean
  onSelect: () => void
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>
  label: string
  hint: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex min-w-0 items-center gap-2.5 rounded-xl bg-card px-2.5 py-2.5 text-left transition-all',
        disabled ? 'cursor-not-allowed opacity-50 ring-1 ring-border' : selected ? 'ring-2 ring-primary' : 'ring-1 ring-border hover:ring-foreground/30',
      )}
    >
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg transition-colors', selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className={cn('block truncate text-[13px] font-bold leading-tight', selected && 'text-primary')}>{label}</span>
        <span className="block truncate text-[10px] leading-tight text-muted-foreground">{hint}</span>
      </span>
    </button>
  )
}

function Field({
  id,
  label,
  icon: Icon,
  className,
  error,
  ...props
}: { id: string; label: string; error?: string; icon?: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }> } & React.InputHTMLAttributes<HTMLInputElement>) {
  const errorId = `${id}-error`
  return (
    <div className={cn('min-w-0', className)}>
      <label
        htmlFor={id}
        className="flex min-w-0 cursor-text items-center gap-3 rounded-xl bg-card px-3.5 py-2 ring-1 ring-border transition-shadow focus-within:ring-2 focus-within:ring-primary has-[[aria-invalid=true]]:ring-2 has-[[aria-invalid=true]]:ring-red-500"
      >
        {Icon && <Icon className={cn('size-4 shrink-0', error ? 'text-red-600' : 'text-muted-foreground')} aria-hidden="true" />}
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold leading-tight text-muted-foreground">
            {label}
            {props.required && <span className="text-primary"> *</span>}
          </span>
          <input
            id={id}
            name={id}
            className="h-7 w-full min-w-0 bg-transparent text-base font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground/60"
            {...props}
            aria-invalid={error ? true : props['aria-invalid']}
            aria-describedby={cn(error && errorId, props['aria-describedby']) || undefined}
          />
        </span>
      </label>
      {error && (
        <p id={errorId} className="mt-1 px-1 text-[11px] font-semibold text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

function DoneStep({ fulfilment, orderNumber, onClose }: { fulfilment: Fulfilment; orderNumber: number | null; onClose: () => void }) {
  const [printedAt] = useState(() => new Date())
  const { data: signedIn } = useSWR('cart-signed-in', fetchSignedIn)
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto overscroll-contain bg-ink px-5 py-8 text-ink-foreground">
      <ReceiptPaper className="w-full max-w-xs text-foreground">
        <div className="text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-full bg-emerald-600 text-white">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </span>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{RESTAURANT.name} · Potwierdzenie</p>
          <SheetTitle className="mt-1 text-xl font-extrabold">Dziękujemy za zamówienie!</SheetTitle>
        </div>

        <div className="receipt-rule my-3" aria-hidden="true" />

        {orderNumber && (
          <div className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Numer zamówienia</p>
            <p className="font-mono text-4xl font-bold tabular-nums">#{orderNumber}</p>
          </div>
        )}

        <dl className="mt-3 space-y-1 text-xs">
          <ReceiptRow label={<span className="text-muted-foreground">Sposób</span>} value={fulfilment === 'delivery' ? 'Dostawa' : 'Odbiór'} />
          <ReceiptRow label={<span className="text-muted-foreground">Czas</span>} value={fulfilment === 'delivery' ? 'ok. 30 min' : 'ok. 15 min'} />
          <ReceiptRow label={<span className="text-muted-foreground">Złożono</span>} value={printedAt.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })} />
        </dl>

        <div className="receipt-rule my-3" aria-hidden="true" />

        <SheetDescription className="text-center text-xs leading-relaxed text-muted-foreground">
          {fulfilment === 'delivery'
            ? 'Kierowca wyruszy, gdy tylko burgery zejdą z grilla.'
            : 'Zamówienie będzie gotowe do odbioru w lokalu.'}
        </SheetDescription>
        <p className="mt-2 text-center font-script text-2xl text-primary">Smacznego!</p>
      </ReceiptPaper>

      <div className="mt-6 flex w-full max-w-xs flex-col gap-2.5">
        {signedIn && orderNumber ? (
          <Link
            href={`/yummy-club?sledz=${orderNumber}#sledzenie`}
            onClick={onClose}
            className="flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Radar className="size-4" aria-hidden="true" />
            Śledź zamówienie
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-full px-6 text-sm font-semibold text-white ring-1 ring-white/30 hover:bg-white/10"
        >
          Wróć do strony
        </button>
      </div>
    </div>
  )
}
