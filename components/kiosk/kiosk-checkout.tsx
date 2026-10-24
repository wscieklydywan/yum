'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Check, ChevronDown, LoaderCircle, Minus, Plus, Tag, Trash2, UserRound } from 'lucide-react'
import { formatPrice } from '@/lib/menu'
import type { KioskLine } from './kiosk-app'
import { KioskLegalNote } from './kiosk-legal'

type CodeState = { code: string; benefit: string } | null
type ClubState = { phone: string; firstName: string | null; tierName: string } | null

async function check(query: string) {
  const response = await fetch(`/api/kiosk/check?${query}`, { credentials: 'same-origin' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? 'Coś poszło nie tak.')
  return data
}

export function KioskCheckout({
  lines,
  onQuantity,
  onBack,
  onPlaced,
}: {
  lines: KioskLine[]
  onQuantity: (key: string, quantity: number) => void
  onBack: () => void
  onPlaced: (orderNumber: number) => void
}) {
  const [requestId] = useState(() => crypto.randomUUID())
  const [code, setCode] = useState<CodeState>(null)
  const [club, setClub] = useState<ClubState>(null)
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
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3 md:px-6">
        <motion.button
          type="button"
          onClick={onBack}
          disabled={submitting}
          whileTap={{ scale: 0.92 }}
          className="inline-flex h-14 shrink-0 items-center gap-2 rounded-2xl bg-muted px-4 text-lg font-bold"
        >
          <ArrowLeft className="size-6" aria-hidden="true" />
          <span>Menu</span>
        </motion.button>
        <h1 className="flex-1 truncate text-2xl font-black uppercase md:text-3xl">Twoje zamówienie</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/40 p-4 md:p-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <motion.ul layout className="flex flex-col gap-3">
            <AnimatePresence initial={false} mode="popLayout">
              {lines.map((line, index) => (
                <motion.li
                  layout
                  key={line.key}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: index * 0.04 } }}
                  exit={{ opacity: 0, x: -120, transition: { duration: 0.2 } }}
                  className="flex items-center gap-3 rounded-3xl bg-card p-3 shadow-sm"
                >
                  <span className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-muted md:size-20">
                    {line.image && <Image src={line.image} alt="" fill sizes="80px" className="object-cover" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-lg font-black leading-tight">{line.name}</span>
                    {line.details.length > 0 && <span className="line-clamp-1 text-sm text-muted-foreground">{line.details.join(', ')}</span>}
                    <span className="mt-1 font-black text-primary tabular-nums">{formatPrice(line.unitPrice * line.quantity)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 rounded-2xl bg-muted p-1">
                    <StepButton onClick={() => onQuantity(line.key, line.quantity - 1)} label={line.quantity === 1 ? `Usuń ${line.name}` : `Mniej: ${line.name}`}>
                      {line.quantity === 1 ? <Trash2 className="size-5" aria-hidden="true" /> : <Minus className="size-5" aria-hidden="true" />}
                    </StepButton>
                    <span className="relative w-8 overflow-hidden text-center text-xl font-black tabular-nums" aria-live="polite">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span key={line.quantity} className="block" initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}>
                          {line.quantity}
                        </motion.span>
                      </AnimatePresence>
                    </span>
                    <StepButton onClick={() => onQuantity(line.key, line.quantity + 1)} label={`Więcej: ${line.name}`}>
                      <Plus className="size-5" aria-hidden="true" />
                    </StepButton>
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>

          {lines.length === 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4 rounded-3xl bg-card p-8 text-center">
              <p className="text-xl font-bold">Koszyk jest pusty</p>
              <button type="button" onClick={onBack} className="h-14 rounded-2xl bg-primary px-6 text-lg font-black text-primary-foreground">Wróć do menu</button>
            </motion.div>
          )}

          {lines.length > 0 && (
            <motion.div layout className="flex flex-col gap-3">
              <Extra
                icon={<Tag className="size-6" aria-hidden="true" />}
                title="Mam kod rabatowy"
                placeholder="Wpisz kod"
                inputMode="text"
                applied={code ? `${code.code} – ${code.benefit}` : null}
                onClear={() => setCode(null)}
                onCheck={async (value) => {
                  const data = await check(`code=${encodeURIComponent(value)}`)
                  setCode({ code: data.code, benefit: data.benefit })
                }}
              />
              <Extra
                icon={<UserRound className="size-6" aria-hidden="true" />}
                title="Jestem w Yummy Club"
                placeholder="Numer telefonu"
                inputMode="tel"
                applied={club ? `${club.firstName ? `Cześć, ${club.firstName}! ` : ''}Poziom: ${club.tierName}` : null}
                onClear={() => setClub(null)}
                onCheck={async (value) => {
                  const data = await check(`phone=${encodeURIComponent(value)}`)
                  setClub({ phone: data.phone, firstName: data.firstName, tierName: data.tierName })
                }}
              />
            </motion.div>
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-border bg-card p-3 md:p-4">
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
          <motion.button
            type="button"
            onClick={placeOrder}
            disabled={submitting || lines.length === 0}
            whileTap={{ scale: 0.97 }}
            className="flex h-20 w-full items-center justify-between gap-3 rounded-3xl bg-primary px-6 text-primary-foreground disabled:opacity-50"
          >
            <span className="flex flex-col items-start leading-tight">
              <span className="text-sm font-semibold opacity-80">{code ? 'Przed rabatem' : 'Do zapłaty przy barze'}</span>
              <span className="text-2xl font-black tabular-nums">{formatPrice(total)}</span>
            </span>
            <span className="inline-flex items-center gap-2 text-2xl font-black uppercase">
              {submitting ? <LoaderCircle className="size-7 animate-spin" aria-hidden="true" /> : <Check className="size-7" aria-hidden="true" />}
              {submitting ? 'Wysyłam…' : 'Zamawiam'}
            </span>
          </motion.button>
          <KioskLegalNote />
        </div>
      </footer>
    </>
  )
}

function StepButton({ onClick, label, children }: { onClick: () => void; label: string; children: ReactNode }) {
  return (
    <motion.button type="button" onClick={onClick} whileTap={{ scale: 0.85 }} className="grid size-12 place-items-center rounded-xl bg-card shadow-sm" aria-label={label}>
      {children}
    </motion.button>
  )
}

function Extra({
  icon,
  title,
  placeholder,
  inputMode,
  applied,
  onCheck,
  onClear,
}: {
  icon: ReactNode
  title: string
  placeholder: string
  inputMode: 'text' | 'tel'
  applied: string | null
  onCheck: (value: string) => Promise<void>
  onClear: () => void
}) {
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
      await onCheck(value.trim())
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
      <motion.div layout initial={{ scale: 0.96 }} animate={{ scale: 1 }} className="flex items-center gap-3 rounded-3xl bg-primary/10 p-3 pl-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-6" aria-hidden="true" />
        </span>
        <p className="min-w-0 flex-1 font-bold text-primary">{applied}</p>
        <button type="button" onClick={onClear} className="h-12 shrink-0 rounded-2xl bg-card px-4 font-bold">Usuń</button>
      </motion.div>
    )
  }

  return (
    <motion.section layout className="overflow-hidden rounded-3xl bg-card shadow-sm">
      <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} className="flex h-16 w-full items-center gap-3 px-4 text-left text-lg font-black">
        {icon}
        <span className="flex-1">{title}</span>
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
                placeholder={placeholder}
                aria-label={placeholder}
                inputMode={inputMode}
                type={inputMode === 'tel' ? 'tel' : 'text'}
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
