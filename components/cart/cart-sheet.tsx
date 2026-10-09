'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { AlertCircle, ArrowLeft, ArrowRight, Bike, CheckCircle2, Loader2, MapPin, PartyPopper, Plus, ShoppingBag, Store, Tag, Trash2 } from 'lucide-react'
import { RESTAURANT, formatDistance } from '@/lib/restaurant'
import { DEFAULT_DELIVERY_ZONES, DEFAULT_MIN_ORDER, deliveryRadius, formatKm, formatZoneRange, type DeliveryZone } from '@/lib/order-settings'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useCart } from './cart-context'
import { SchedulePicker } from './schedule-picker'
import { UnavailableNotice } from './unavailable-notice'
import { QuantityStepper } from '@/components/yummy/product-dialog'
import { formatPrice } from '@/lib/menu'
import { useMenu } from '@/lib/use-menu'
import { useRestaurantStatus } from '@/lib/use-restaurant-status'
import { hasConfigurator } from '@/lib/menu-config'
import { autoPackaging, packagingTotal } from '@/lib/packaging'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { GUEST_CHECKOUT_CODE, GUEST_PROMO_CODE, checkoutCodeError, codeDiscount, describeCodeBenefit, type CheckoutCode } from '@/lib/checkout-codes'

type Step = 'cart' | 'checkout' | 'done'
type Fulfilment = 'delivery' | 'pickup'
type ZoneStatus = { state: 'idle' | 'checking' } | { state: 'ok' | 'out' | 'error'; message: string }

async function lookupCheckoutCode(raw: string): Promise<CheckoutCode> {
  const code = raw.trim().toUpperCase().replace(/\s+/g, '')
  if (code === GUEST_PROMO_CODE) return GUEST_CHECKOUT_CODE
  const { data, error } = await createClient().rpc('checkout_code_preview', { p_code: code })
  if (error || !data) throw new Error(checkoutCodeError(error?.message))
  return data as CheckoutCode
}

export function CartSheet() {
  const { isOpen, setOpen, lines, subtotal, clear } = useCart()
  const [step, setStep] = useState<Step>('cart')
  const [fulfilment, setFulfilment] = useState<Fulfilment>('delivery')
  const [appliedCode, setAppliedCode] = useState<CheckoutCode | null>(null)
  const [orderNumber, setOrderNumber] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const [zoneFee, setZoneFee] = useState<number | null>(null)

  const { products } = useMenu()
  const { status: restaurant } = useRestaurantStatus()
  const zones = restaurant?.deliveryZones ?? DEFAULT_DELIVERY_ZONES
  const minOrder = restaurant?.minOrderOnline ?? DEFAULT_MIN_ORDER
  const discount = codeDiscount(subtotal, appliedCode)
  const freeDeliveryFrom = restaurant?.freeDeliveryFrom ?? null
  const freeDelivery = freeDeliveryFrom !== null && subtotal >= freeDeliveryFrom
  const delivery = fulfilment === 'pickup' || subtotal === 0 || freeDelivery ? 0 : zoneFee
  const packaging = lines.length ? packagingTotal(autoPackaging(lines.flatMap((line) => {
    const product = products.find((entry) => entry.id === line.productId)
    return product ? [{ product, quantity: line.quantity }] : []
  }), 'Dostawa'), restaurant?.packagingPrices) : 0
  const total = Math.round((subtotal + packaging - discount + (delivery ?? 0)) * 100) / 100

  const handleOpenChange = (open: boolean) => {
    setOpen(open)
    if (!open && step === 'done') setStep('cart')
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full gap-0 bg-background p-0 data-[side=right]:w-full data-[side=right]:max-w-none data-[side=right]:sm:max-w-md">
        {step === 'cart' && (
          <CartStep
            discount={discount}
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
            onNext={() => setStep('checkout')}
          />
        )}
        {step === 'checkout' && (
          <CheckoutStep
            fulfilment={fulfilment}
            onFulfilmentChange={setFulfilment}
            onZoneFee={setZoneFee}
            zones={zones}
            delivery={delivery}
            total={total}
            submitting={submitting}
            error={submitError}
            onBack={() => setStep('cart')}
            onSubmit={async (formData) => {
              setSubmitting(true)
              setSubmitError('')
              try {
                const response = await fetch('/api/orders', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    customer: formData.get('name'),
                    phone: formData.get('phone'),
                    address: formData.get('street'),
                    city: formData.get('city'),
                    type: fulfilment === 'delivery' ? 'Dostawa' : 'Odbiór osobisty',
                    promoCode: appliedCode?.code,
                    scheduledFor: formData.get('scheduledFor') || null,
                    lines: lines.map(({ productId, quantity, details, selection }) => ({ productId, quantity, details, selection })),
                  }),
                })
                const result = await response.json() as { orderNumber?: number; error?: string }
                if (!response.ok || !result.orderNumber) throw new Error(result.error ?? 'Nie udało się złożyć zamówienia.')
                setOrderNumber(result.orderNumber)
                clear()
                setAppliedCode(null)
                setStep('done')
              } catch (error) {
                setSubmitError(error instanceof Error ? error.message : 'Nie udało się złożyć zamówienia.')
              } finally {
                setSubmitting(false)
              }
            }}
          />
        )}
        {step === 'done' && <DoneStep fulfilment={fulfilment} orderNumber={orderNumber} onClose={() => handleOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

function CartStep({
  discount,
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
  discount: number
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
  const { lines, updateQuantity, removeLine, clear, addLine, setOpen, openProduct } = useCart()
  const { products } = useMenu()
  const upsell = products
    .filter((product) => product.category === 'frytki-dodatki' && product.price >= 10 && !hasConfigurator(product) && !product.sizes?.length)
    .slice(0, 3)
  const [code, setCode] = useState('')
  const belowMinimum = subtotal < minOrder

  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-4 py-4 pr-14 sm:px-6 sm:py-5">
        <SheetTitle className="text-xl font-black sm:text-2xl">Twój koszyk</SheetTitle>
        {lines.length > 0 && (
          <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            Wyczyść
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <SheetDescription className="sr-only">Produkty w koszyku i podsumowanie zamówienia</SheetDescription>

      {lines.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <span className="grid size-20 place-items-center rounded-full bg-secondary text-primary">
            <ShoppingBag className="size-9" aria-hidden="true" />
          </span>
          <p className="text-lg font-bold">Koszyk jest pusty</p>
          <p className="text-sm text-muted-foreground">Dodaj coś pysznego z naszego menu.</p>
          <a
            href="#menu"
            onClick={() => setOpen(false)}
            className="mt-2 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground"
          >
            Przejdź do menu
            <ArrowRight className="size-4" aria-hidden="true" />
          </a>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            <UnavailableNotice className="mb-4" />
            <ul className="space-y-3">
              {lines.map((line) => (
                <li key={line.key} className="flex min-w-0 select-none gap-3 rounded-2xl bg-card p-3 ring-1 ring-border sm:gap-4">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-cream">
                    <Image src={line.image || '/placeholder.svg'} alt="" fill sizes="80px" className="object-cover" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <p className="min-w-0 break-words font-bold leading-tight">{line.name}</p>
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        <span className="sr-only">Usuń {line.name}</span>
                      </button>
                    </div>
                    {line.details.length > 0 && (
                      <p className="mt-0.5 break-words text-xs leading-snug text-muted-foreground [overflow-wrap:anywhere]">{line.details.join(', ')}</p>
                    )}
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <p className="font-bold">{formatPrice(line.unitPrice * line.quantity)}</p>
                      <QuantityStepper
                        size="sm"
                        min={0}
                        value={line.quantity}
                        label={line.name}
                        onChange={(q) => updateQuantity(line.key, q)}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <h3 className="mt-8 text-base font-bold">Dobierz coś jeszcze?</h3>
            <ul className="mt-3 grid grid-cols-3 gap-3">
              {upsell.map((p) => (
                <li key={p.id} className="relative overflow-hidden rounded-2xl bg-card ring-1 ring-border">
                  <div className="relative aspect-square">
                    <Image src={p.image || '/placeholder.svg'} alt="" fill sizes="120px" className="object-cover" />
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{formatPrice(p.price)}</p>
                  </div>
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
                    className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-primary text-primary-foreground shadow"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    <span className="sr-only">Dodaj {p.name}</span>
                  </button>
                </li>
              ))}
            </ul>

            {appliedCode ? (
              <div className="mt-6 flex items-center gap-3 rounded-2xl bg-primary/10 p-3 pl-4 ring-1 ring-primary/30">
                <Tag className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm font-bold text-primary">{appliedCode.code}</p>
                  <p className="text-xs text-muted-foreground">{describeCodeBenefit(appliedCode)}</p>
                </div>
                <button type="button" onClick={onRemovePromo} className="h-9 shrink-0 rounded-xl bg-background px-3 text-sm font-semibold">
                  Usuń
                </button>
              </div>
            ) : (
              <form
                className="mt-6 flex items-center gap-2 rounded-2xl bg-card p-2 pl-4 ring-1 ring-border"
                onSubmit={async (e) => {
                  e.preventDefault()
                  setChecking(true)
                  await onApplyPromo(code)
                  setChecking(false)
                }}
              >
                <Tag className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <label htmlFor="promo" className="sr-only">Kod rabatowy lub kupon Yummy Club</label>
                <input
                  id="promo"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Kod rabatowy lub kupon"
                  className="h-9 min-w-0 flex-1 bg-transparent text-sm uppercase outline-none placeholder:normal-case placeholder:text-muted-foreground"
                />
                <button
                  type="submit"
                  disabled={checking || !code.trim()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-muted px-4 text-sm font-semibold disabled:opacity-50"
                >
                  {checking && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                  Dodaj
                </button>
              </form>
            )}
          </div>

<div className="border-t border-border bg-card px-4 py-4 sm:px-6 sm:py-5">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Suma produktów</dt>
                <dd>{formatPrice(subtotal)}</dd>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-primary">
                  <dt>Rabat {appliedCode?.code}</dt>
                  <dd>- {formatPrice(discount)}</dd>
                </div>
              )}
              {appliedCode?.items.map((item) => (
                <div key={item.name} className="flex justify-between gap-2 text-primary">
                  <dt className="min-w-0 break-words">{item.quantity}× {item.name}</dt>
                  <dd className="shrink-0">Gratis</dd>
                </div>
              ))}
              {packaging > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Opakowania i torba</dt>
                  <dd>{formatPrice(packaging)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Dostawa</dt>
                <dd className={cn('text-right', !pickup && delivery === 0 && 'font-semibold text-emerald-700')}>{pickup ? 'Odbiór osobisty' : delivery === null ? `od ${formatPrice(Math.min(...zones.map((zone) => zone.fee)))}` : delivery === 0 ? 'Gratis' : formatPrice(delivery)}</dd>
              </div>
              {!pickup && freeDeliveryFrom !== null && subtotal < freeDeliveryFrom && (
                <p className="text-xs text-muted-foreground">Darmowa dostawa od {formatPrice(freeDeliveryFrom)} – brakuje {formatPrice(freeDeliveryFrom - subtotal)}.</p>
              )}
              {!pickup && delivery === null && <p className="text-xs text-muted-foreground">Koszt dostawy zależy od odległości – policzymy go po wpisaniu adresu.</p>}
              <div className="flex justify-between pt-2 text-lg font-black">
                <dt>{delivery === null && !pickup ? 'Razem (bez dostawy)' : 'Razem'}</dt>
                <dd>{formatPrice(total)}</dd>
              </div>
            </dl>
            {belowMinimum && (
              <p role="status" className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                Minimalna wartość zamówienia online to <strong>{formatPrice(minOrder)}</strong>. Dodaj produkty za jeszcze {formatPrice(minOrder - subtotal)}.
              </p>
            )}
            <button
              type="button"
              onClick={onNext}
              disabled={belowMinimum}
              className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-full bg-primary py-4 font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {belowMinimum ? `Minimum ${formatPrice(minOrder)}` : 'Przejdź do realizacji'}
              {!belowMinimum && <ArrowRight className="size-4" aria-hidden="true" />}
            </button>
            <DeliveryZonesInfo zones={zones} className="mt-3" />
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
    <details className={cn('group rounded-xl bg-muted/60 px-3 py-2 text-xs', className)}>
      <summary className="cursor-pointer select-none font-semibold text-muted-foreground">Cennik dostawy</summary>
      <ul className="mt-2 space-y-1">
        {zones.map((zone, index) => (
          <li key={zone.upToKm} className="flex justify-between">
            <span className="text-muted-foreground">{formatZoneRange(zones, index)}</span>
            <span className="font-semibold tabular-nums">{formatPrice(zone.fee)}</span>
          </li>
        ))}
        {freeFrom !== null && (
          <li className="flex justify-between border-t border-border/60 pt-1 font-semibold text-emerald-700">
            <span>{freeFrom === 0 ? 'Każde zamówienie' : `Zamówienie od ${formatPrice(freeFrom)}`}</span>
            <span>Gratis</span>
          </li>
        )}
      </ul>
    </details>
  )
}

function CheckoutStep({
  fulfilment,
  onFulfilmentChange,
  onZoneFee,
  zones,
  delivery,
  total,
  submitting,
  error,
  onBack,
  onSubmit,
}: {
  fulfilment: Fulfilment
  onFulfilmentChange: (f: Fulfilment) => void
  onZoneFee: (fee: number | null) => void
  zones: DeliveryZone[]
  delivery: number | null
  total: number
  submitting: boolean
  error: string
  onBack: () => void
  onSubmit: (formData: FormData) => void
}) {
  const { status: restaurant } = useRestaurantStatus()
  const orderingClosed = restaurant ? !restaurant.acceptingOrders : false
  const [when, setWhen] = useState<'asap' | 'later'>('asap')
  const [scheduleError, setScheduleError] = useState('')
  const [zone, setZone] = useState<ZoneStatus>({ state: 'idle' })
  const zoneRequest = useRef(0)
  const formRef = useRef<HTMLFormElement>(null)

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
        ? { state: 'ok', message: `Adres w strefie dostawy · ${formatDistance(result.distanceKm ?? 0)} od lokalu · dostawa ${formatPrice(fee ?? 0)}` }
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

  const options = [
    { id: 'delivery' as const, icon: Bike, label: 'Dostawa', hint: `Do ${formatKm(deliveryRadius(zones))} km · od ${formatPrice(Math.min(...zones.map((entry) => entry.fee)))}` },
    { id: 'pickup' as const, icon: Store, label: 'Odbiór osobisty', hint: RESTAURANT.shortAddress },
  ]

  return (
    <form
      ref={formRef}
      className="flex h-full flex-col"
      onSubmit={async (e) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        if (when === 'later' && !formData.get('scheduledFor')) {
          setScheduleError('Wybierz godzinę zamówienia.')
          return
        }
        setScheduleError('')
        if (when === 'asap') formData.delete('scheduledFor')
        if (fulfilment === 'delivery' && zone.state !== 'ok') {
          const result = await checkZone()
          if (result.state === 'out') return
        }
        void onSubmit(formData)
      }}
    >
      <div className="flex items-center gap-3 border-b border-border px-6 py-5 pr-14">
        <button type="button" onClick={onBack} className="grid size-9 place-items-center rounded-full hover:bg-muted">
          <ArrowLeft className="size-5" aria-hidden="true" />
          <span className="sr-only">Wróć do koszyka</span>
        </button>
        <SheetTitle className="text-xl font-black">Jak chcesz odebrać zamówienie?</SheetTitle>
      </div>
      <SheetDescription className="sr-only">Wybierz sposób odbioru i podaj dane kontaktowe</SheetDescription>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <div role="radiogroup" aria-label="Sposób odbioru" className="grid grid-cols-2 gap-3">
          {options.map(({ id, icon: Icon, label, hint }) => {
            const selected = fulfilment === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onFulfilmentChange(id)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-2xl p-4 text-center transition-colors',
                  selected ? 'bg-card ring-2 ring-foreground' : 'bg-card ring-1 ring-border hover:bg-muted',
                )}
              >
                <Icon className={cn('size-7', selected ? 'text-primary' : 'text-foreground')} aria-hidden="true" />
                <span className={cn('font-bold', selected && 'text-primary')}>{label}</span>
                <span className="text-xs text-muted-foreground">{hint}</span>
              </button>
            )
          })}
        </div>

        <fieldset className="space-y-3">
          <legend className="mb-3 font-bold">Dane kontaktowe</legend>
          <Field id="name" label="Imię" autoComplete="given-name" required />
          <Field id="phone" label="Telefon" type="tel" autoComplete="tel" required pattern="[0-9 +]{9,15}" />
          {fulfilment === 'delivery' && (
            <>
              <Field
                id="street"
                label="Ulica i numer"
                autoComplete="street-address"
                required
                aria-describedby="delivery-zone-status"
                aria-invalid={addressBlocked || undefined}
                onChange={() => zone.state !== 'idle' && setZone({ state: 'idle' })}
                onBlur={() => void checkZone()}
              />
              <Field
                id="city"
                label="Miasto"
                autoComplete="address-level2"
                defaultValue="Rybnik"
                required
                aria-describedby="delivery-zone-status"
                aria-invalid={addressBlocked || undefined}
                onChange={() => zone.state !== 'idle' && setZone({ state: 'idle' })}
                onBlur={() => void checkZone()}
              />
              <p
                id="delivery-zone-status"
                aria-live="polite"
                className={cn(
                  'flex items-start gap-2 rounded-xl px-3 py-2 text-xs leading-relaxed',
                  zone.state === 'ok' && 'bg-emerald-50 text-emerald-800',
                  zone.state === 'out' && 'bg-red-50 text-red-700',
                  zone.state === 'error' && 'bg-amber-50 text-amber-800',
                  (zone.state === 'idle' || zone.state === 'checking') && 'bg-muted text-muted-foreground',
                )}
              >
                {zone.state === 'checking' ? (
                  <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin" aria-hidden="true" />
                ) : zone.state === 'ok' ? (
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                ) : zone.state === 'out' || zone.state === 'error' ? (
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>
                  {'message' in zone
                    ? zone.message
                    : zone.state === 'checking'
                      ? 'Sprawdzamy, czy dowozimy pod ten adres…'
                      : `Dowozimy w promieniu ${formatKm(deliveryRadius(zones))} km od ${RESTAURANT.name} (${RESTAURANT.fullAddress}). Koszt dostawy zależy od odległości.`}
                </span>
              </p>
              <DeliveryZonesInfo zones={zones} />
            </>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-3 font-bold">Kiedy?</legend>
          <div className="space-y-2">
            {[
              { id: 'asap' as const, label: 'Jak najszybciej', hint: fulfilment === 'delivery' ? 'ok. 30–45 min' : 'ok. 15 min' },
              { id: 'later' as const, label: 'Na konkretną godzinę', hint: 'Wybierz dzień i godzinę poniżej' },
            ].map((opt) => (
              <label
                key={opt.id}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-2xl bg-card p-4 transition-shadow',
                  when === opt.id ? 'ring-2 ring-primary' : 'ring-1 ring-border',
                )}
              >
                <input
                  type="radio"
                  name="when"
                  checked={when === opt.id}
                  onChange={() => setWhen(opt.id)}
                  className="size-4 accent-primary"
                />
                <span>
                  <span className="block text-sm font-semibold">{opt.label}</span>
                  <span className="block text-xs text-muted-foreground">{opt.hint}</span>
                </span>
              </label>
            ))}
            {when === 'later' && <SchedulePicker key={fulfilment} openingHours={restaurant?.openingHours} closeBeforeMinutes={restaurant?.closeBeforeMinutes} leadMinutes={fulfilment === 'delivery' ? 45 : 20} />}
          </div>
        </fieldset>
      </div>

      <div className="border-t border-border bg-card px-6 py-5">
        {orderingClosed && <p role="status" className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{restaurant?.reason ?? 'Zamówienia online są teraz wyłączone.'}</p>}
        {(scheduleError || error) && <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{scheduleError || error}</p>}
        <button
          type="submit"
          disabled={submitting || addressBlocked || zone.state === 'checking' || orderingClosed}
          className="flex w-full items-center justify-between rounded-full bg-primary px-6 py-4 font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          <span>{submitting ? 'Zapisywanie…' : orderingClosed ? 'Lokal nie przyjmuje zamówień' : addressBlocked ? 'Adres poza strefą dostawy' : 'Zamawiam i płacę'}</span>
          <span>{formatPrice(total)}</span>
        </button>
        {fulfilment === 'delivery' && delivery === null && <p className="mt-2 text-center text-xs text-muted-foreground">Kwota bez dostawy – koszt dostawy pojawi się po sprawdzeniu adresu.</p>}
        <p className="mt-2 text-center text-xs text-muted-foreground">Płatność przy odbiorze – gotówką lub kartą.</p>
      </div>
    </form>
  )
}

function Field({
  id,
  label,
  ...props
}: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        className="h-12 w-full rounded-xl bg-card px-4 text-sm outline-none ring-1 ring-border transition-shadow focus-visible:ring-2 focus-visible:ring-primary"
        {...props}
      />
    </div>
  )
}

function DoneStep({ fulfilment, orderNumber, onClose }: { fulfilment: Fulfilment; orderNumber: number | null; onClose: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-ink px-8 text-center text-ink-foreground">
      <span className="grid size-20 place-items-center rounded-full bg-primary text-primary-foreground">
        <PartyPopper className="size-9" aria-hidden="true" />
      </span>
      <SheetTitle className="mt-6 text-3xl font-black text-white">Dziękujemy za zamówienie!</SheetTitle>
      <SheetDescription className="mt-3 text-ink-foreground/70">
        {orderNumber ? `Numer zamówienia: #${orderNumber}. ` : ''}{fulfilment === 'delivery'
          ? 'Nasz kierowca wyruszy, gdy tylko burgery zejdą z grilla. Szacowany czas: ok. 30 minut.'
          : 'Twoje zamówienie będzie gotowe do odbioru za ok. 15 minut.'}
      </SheetDescription>
      <p className="mt-6 font-script text-3xl text-primary">Smacznego!</p>
      <button
        type="button"
        onClick={onClose}
        className="mt-8 rounded-full px-8 py-3 font-semibold text-white ring-1 ring-white/30 hover:bg-white/10"
      >
        Wróć do strony
      </button>
    </div>
  )
}
