'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, Bike, PartyPopper, Plus, ShoppingBag, Store, Tag, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useCart } from './cart-context'
import { QuantityStepper } from '@/components/yummy/product-dialog'
import { DELIVERY_FEE, FREE_DELIVERY_FROM, formatPrice, products } from '@/lib/menu'
import { cn } from '@/lib/utils'

type Step = 'cart' | 'checkout' | 'done'
type Fulfilment = 'delivery' | 'pickup'

const PROMO_CODE = 'YUMMY10'
const upsell = products.filter((p) => ['onion-rings', 'nuggets', 'frytki'].includes(p.id))

export function CartSheet() {
  const { isOpen, setOpen, lines, subtotal, clear } = useCart()
  const [step, setStep] = useState<Step>('cart')
  const [fulfilment, setFulfilment] = useState<Fulfilment>('delivery')
  const [promoApplied, setPromoApplied] = useState(false)

  const discount = promoApplied ? subtotal * 0.1 : 0
  const delivery =
    fulfilment === 'pickup' || subtotal === 0 || subtotal - discount >= FREE_DELIVERY_FROM ? 0 : DELIVERY_FEE
  const total = subtotal - discount + delivery

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
            total={total}
            promoApplied={promoApplied}
            onApplyPromo={(code) => {
              if (code.trim().toUpperCase() === PROMO_CODE) {
                setPromoApplied(true)
                toast.success('Kod YUMMY10 aktywny – 10% rabatu')
              } else {
                toast.error('Nieprawidłowy kod rabatowy')
              }
            }}
            onNext={() => setStep('checkout')}
          />
        )}
        {step === 'checkout' && (
          <CheckoutStep
            fulfilment={fulfilment}
            onFulfilmentChange={setFulfilment}
            total={total}
            onBack={() => setStep('cart')}
            onSubmit={() => {
              clear()
              setPromoApplied(false)
              setStep('done')
            }}
          />
        )}
        {step === 'done' && <DoneStep fulfilment={fulfilment} onClose={() => handleOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

function CartStep({
  discount,
  delivery,
  total,
  promoApplied,
  onApplyPromo,
  onNext,
}: {
  discount: number
  delivery: number
  total: number
  promoApplied: boolean
  onApplyPromo: (code: string) => void
  onNext: () => void
}) {
  const { lines, subtotal, updateQuantity, removeLine, clear, addLine, setOpen } = useCart()
  const [code, setCode] = useState('')

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
            <ul className="space-y-3">
              {lines.map((line) => (
                <li key={line.key} className="flex gap-4 rounded-2xl bg-card p-3 ring-1 ring-border">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-cream">
                    <Image src={line.image || '/placeholder.svg'} alt="" fill sizes="80px" className="object-cover" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold leading-tight">{line.name}</p>
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        className="text-muted-foreground transition-colors hover:text-primary"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        <span className="sr-only">Usuń {line.name}</span>
                      </button>
                    </div>
                    {line.details.length > 0 && (
                      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{line.details.join(', ')}</p>
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
                      addLine({
                        productId: p.id,
                        name: p.name,
                        image: p.image,
                        unitPrice: p.price,
                        quantity: 1,
                        details: p.variantLabel ? [p.variantLabel] : p.sizes ? [p.sizes[0].label] : [],
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

            <form
              className="mt-6 flex items-center gap-2 rounded-2xl bg-card p-2 pl-4 ring-1 ring-border"
              onSubmit={(e) => {
                e.preventDefault()
                onApplyPromo(code)
              }}
            >
              <Tag className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="promo" className="sr-only">Kod rabatowy</label>
              <input
                id="promo"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={promoApplied}
                placeholder={promoApplied ? 'YUMMY10 aktywny' : 'Kod rabatowy (np. YUMMY10)'}
                className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                disabled={promoApplied || !code}
                className="h-9 rounded-xl bg-muted px-4 text-sm font-semibold disabled:opacity-50"
              >
                Dodaj
              </button>
            </form>
          </div>

<div className="border-t border-border bg-card px-4 py-4 sm:px-6 sm:py-5">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Suma produktów</dt>
                <dd>{formatPrice(subtotal)}</dd>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-primary">
                  <dt>Rabat YUMMY10</dt>
                  <dd>- {formatPrice(discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Dostawa</dt>
                <dd>{delivery === 0 ? 'Gratis' : formatPrice(delivery)}</dd>
              </div>
              <div className="flex justify-between pt-2 text-lg font-black">
                <dt>Razem</dt>
                <dd>{formatPrice(total)}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={onNext}
              className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-full bg-primary py-4 font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90"
            >
              Przejdź do realizacji
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </>
  )
}

function CheckoutStep({
  fulfilment,
  onFulfilmentChange,
  total,
  onBack,
  onSubmit,
}: {
  fulfilment: Fulfilment
  onFulfilmentChange: (f: Fulfilment) => void
  total: number
  onBack: () => void
  onSubmit: () => void
}) {
  const [when, setWhen] = useState<'asap' | 'later'>('asap')

  const options = [
    { id: 'delivery' as const, icon: Bike, label: 'Dostawa', hint: 'Pod Twój adres' },
    { id: 'pickup' as const, icon: Store, label: 'Odbiór osobisty', hint: 'W naszym lokalu' },
  ]

  return (
    <form
      className="flex h-full flex-col"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
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
                  selected ? 'bg-secondary ring-2 ring-primary' : 'bg-card ring-1 ring-border hover:bg-muted',
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
              <Field id="street" label="Ulica i numer" autoComplete="street-address" required />
              <Field id="city" label="Miasto" autoComplete="address-level2" defaultValue="Rybnik" required />
            </>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-3 font-bold">Kiedy?</legend>
          <div className="space-y-2">
            {[
              { id: 'asap' as const, label: 'Jak najszybciej', hint: fulfilment === 'delivery' ? 'ok. 30–45 min' : 'ok. 15 min' },
              { id: 'later' as const, label: 'Na konkretną godzinę', hint: 'Wybierzesz po potwierdzeniu' },
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
          </div>
        </fieldset>
      </div>

      <div className="border-t border-border bg-card px-6 py-5">
        <button
          type="submit"
          className="flex w-full items-center justify-between rounded-full bg-primary px-6 py-4 font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90"
        >
          <span>Zamawiam i płacę</span>
          <span>{formatPrice(total)}</span>
        </button>
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

function DoneStep({ fulfilment, onClose }: { fulfilment: Fulfilment; onClose: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-ink px-8 text-center text-ink-foreground">
      <span className="grid size-20 place-items-center rounded-full bg-primary text-primary-foreground">
        <PartyPopper className="size-9" aria-hidden="true" />
      </span>
      <SheetTitle className="mt-6 text-3xl font-black text-white">Dziękujemy za zamówienie!</SheetTitle>
      <SheetDescription className="mt-3 text-ink-foreground/70">
        {fulfilment === 'delivery'
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
