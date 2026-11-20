'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight, LoaderCircle, Minus, Plus, Star, Tag, Trash2 } from 'lucide-react'
import { formatPrice } from '@/lib/menu'
import type { KioskLine } from './kiosk-app'
import { KioskLegalNote } from './kiosk-legal'
import { ClubBadge, type ClubState } from './kiosk-phone'

type CodeState = { code: string; benefit: string } | null

export function KioskCheckout({
  lines,
  club,
  onQuantity,
  onBack,
  onClub,
  onClearClub,
  onPlaced,
}: {
  lines: KioskLine[]
  club: ClubState
  onQuantity: (key: string, quantity: number) => void
  onBack: () => void
  onClub: () => void
  onClearClub: () => void
  onPlaced: (orderNumber: number) => void
}) {
  const [requestId] = useState(() => crypto.randomUUID())
  const [code, setCode] = useState<CodeState>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const total = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)

  async function placeOrder() {
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/kiosk/orders', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientRequestId: requestId,
          code: code?.code,
          clubPhone: club?.phone,
          lines: lines.map((line) => ({ productId: line.productId, quantity: line.quantity, note: '', selection: line.selection })),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || typeof data.orderNumber !== 'number') throw new Error(data.error ?? 'Nie udało się złożyć zamówienia.')
      onPlaced(data.orderNumber)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Nie udało się złożyć zamówienia.')
      setSubmitting(false)
    }
  }

  return (
    <>
      <header className="flex shrink-0 flex-col gap-4 px-4 pb-3 pt-4 md:px-6">
        <motion.button
          type="button"
          onClick={onBack}
          disabled={submitting}
          whileTap={{ scale: 0.9 }}
          className="grid size-12 place-items-center rounded-full bg-card shadow-sm"
          aria-label="Wróć do menu"
        >
          <ArrowLeft className="size-6" aria-hidden="true" />
        </motion.button>
        <h1 className="text-3xl font-black tracking-tight md:text-4xl">Twoje zamówienie</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 md:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <motion.ul layout className="flex flex-col divide-y divide-border overflow-hidden rounded-3xl bg-card shadow-sm">
            <AnimatePresence initial={false} mode="popLayout">
              {lines.map((line) => (
                <motion.li
                  layout
                  key={line.key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -120, transition: { duration: 0.2 } }}
                  className="flex items-center gap-3 p-3"
                >
                  <span className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-muted md:size-20">
                    {line.image && <Image src={line.image} alt="" fill sizes="80px" className="object-cover" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-lg font-black leading-tight">{line.name}</span>
                    {line.details.length > 0 && <span className="line-clamp-1 text-sm text-muted-foreground">{line.details.join(', ')}</span>}
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1 rounded-full bg-muted p-1">
                        <StepButton onClick={() => onQuantity(line.key, line.quantity - 1)} label={line.quantity === 1 ? `Usuń ${line.name}` : `Mniej: ${line.name}`}>
                          {line.quantity === 1 ? <Trash2 className="size-5" aria-hidden="true" /> : <Minus className="size-5" aria-hidden="true" />}
                        </StepButton>
                        <span className="w-7 text-center text-lg font-black tabular-nums" aria-live="polite">{line.quantity}</span>
                        <StepButton onClick={() => onQuantity(line.key, line.quantity + 1)} label={`Więcej: ${line.name}`}>
                          <Plus className="size-5" aria-hidden="true" />
                        </StepButton>
                      </span>
                      <span className="text-lg font-black tabular-nums">{formatPrice(line.unitPrice * line.quantity)}</span>
                    </span>
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>

          {lines.length === 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4 rounded-3xl bg-card p-8 text-center">
              <p className="text-xl font-bold">Koszyk jest pusty</p>
              <button type="button" onClick={onBack} className="h-14 rounded-full bg-primary px-6 text-lg font-black text-primary-foreground">Wróć do menu</button>
            </motion.div>
          )}

          {lines.length > 0 && (
            <motion.div layout className="flex flex-col gap-3">
              <motion.button
                type="button"
                onClick={onBack}
                whileTap={{ scale: 0.97 }}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-full border-2 border-border text-lg font-bold"
              >
                <Plus className="size-5 text-primary" aria-hidden="true" />
                Dodaj coś jeszcze
              </motion.button>

              {club ? (
                <div className="flex items-center gap-3 rounded-3xl bg-card p-3 shadow-sm">
                  <ClubBadge club={club} onClear={onClearClub} />
                  <span className="ml-auto text-right text-sm font-semibold text-muted-foreground">
                    {club.tierPercent > 0 ? `Rabat ${club.tierPercent}% + punkty` : 'Punkty zostaną dopisane'}
                  </span>
                </div>
              ) : (
                <motion.button
                  type="button"
                  onClick={onClub}
                  whileTap={{ scale: 0.97 }}
                  className="flex h-20 items-center gap-3 rounded-3xl bg-primary/10 px-4 text-left text-primary"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Star className="size-6 fill-current" aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-lg font-black">Dodaj numer telefonu</span>
                    <span className="text-sm font-semibold opacity-80">Zbieraj punkty Yummy Club</span>
                  </span>
                  <ChevronRight className="size-7 shrink-0" aria-hidden="true" />
                </motion.button>
              )}

              <CodeField applied={code ? `${code.code} – ${code.benefit}` : null} onClear={() => setCode(null)} onApply={setCode} />
            </motion.div>
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-border bg-card px-4 pb-4 pt-3 md:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <AnimatePresence>
            {error && (
              <motion.p
                role="alert"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto', x: [0, -8, 8, -4, 0] }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-2xl bg-destructive/10 px-4 py-3 text-center text-lg font-semibold text-destructive"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold">{code || (club?.tierPercent ?? 0) > 0 ? 'Razem przed rabatem' : 'Razem'}</span>
            <span className="text-3xl font-black tabular-nums">{formatPrice(total)}</span>
          </div>
          <motion.button
            type="button"
            onClick={placeOrder}
            disabled={submitting || lines.length === 0}
            whileTap={{ scale: 0.97 }}
            className="inline-flex h-18 w-full items-center justify-center gap-3 rounded-full bg-primary py-5 text-2xl font-black text-primary-foreground shadow-lg shadow-primary/30 disabled:opacity-50"
          >
            {submitting ? <LoaderCircle className="size-7 animate-spin" aria-hidden="true" /> : null}
            {submitting ? 'Wysyłam…' : 'Zamawiam i płacę przy barze'}
            {!submitting && <ArrowRight className="size-7" aria-hidden="true" />}
          </motion.button>
          <KioskLegalNote />
        </div>
      </footer>
    </>
  )
}

function StepButton({ onClick, label, children }: { onClick: () => void; label: string; children: ReactNode }) {
  return (
    <motion.button type="button" onClick={onClick} whileTap={{ scale: 0.85 }} className="grid size-11 place-items-center rounded-full bg-card shadow-sm" aria-label={label}>
      {children}
    </motion.button>
  )
}

function CodeField({ applied, onApply, onClear }: { applied: string | null; onApply: (code: NonNullable<CodeState>) => void; onClear: () => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!value.trim()) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/kiosk/check?code=${encodeURIComponent(value.trim())}`, { credentials: 'same-origin' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Coś poszło nie tak.')
      onApply({ code: data.code, benefit: data.benefit })
      setValue('')
      setOpen(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Coś poszło nie tak.')
    } finally {
      setBusy(false)
    }
  }

  if (applied) {
    return (
      <motion.div layout initial={{ scale: 0.96 }} animate={{ scale: 1 }} className="flex items-center gap-3 rounded-3xl bg-card p-3 pl-4 shadow-sm">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-6" aria-hidden="true" />
        </span>
        <p className="min-w-0 flex-1 font-bold text-primary">{applied}</p>
        <button type="button" onClick={onClear} className="h-12 shrink-0 rounded-full bg-muted px-4 font-bold">Usuń</button>
      </motion.div>
    )
  }

  return (
    <motion.section layout className="overflow-hidden rounded-3xl bg-card shadow-sm">
      <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} className="flex h-16 w-full items-center gap-3 px-4 text-left text-lg font-bold">
        <Tag className="size-6 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1">Mam kod rabatowy</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }}>
          <ChevronDown className="size-6" aria-hidden="true" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <form onSubmit={submit} className="flex gap-2 px-4 pb-4">
              <input
                value={value}
                onChange={(event) => { setValue(event.target.value); setError('') }}
                placeholder="Wpisz kod"
                aria-label="Kod rabatowy"
                autoComplete="off"
                autoFocus
                className="h-14 min-w-0 flex-1 rounded-2xl border border-input bg-background px-4 text-lg uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-invalid={Boolean(error)}
              />
              <button type="submit" disabled={busy || !value.trim()} className="inline-flex h-14 items-center rounded-2xl bg-foreground px-5 text-lg font-bold text-background disabled:opacity-40">
                {busy ? <LoaderCircle className="size-6 animate-spin" aria-hidden="true" /> : 'OK'}
              </button>
            </form>
            {error && <p role="alert" className="px-4 pb-4 text-sm font-semibold text-destructive">{error}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}
