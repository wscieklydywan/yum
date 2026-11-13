'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Delete, LoaderCircle, Star, X } from 'lucide-react'

export type ClubState = { phone: string; firstName: string | null; tierName: string; tierPercent: number } | null

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const

function formatDigits(digits: string) {
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ')
}

export function PhonePad({
  onMember,
  onSkip,
  skipLabel,
  title = 'Zbieraj punkty Yummy Club',
}: {
  onMember: (club: NonNullable<ClubState>) => void
  onSkip: () => void
  skipLabel: string
  title?: string
}) {
  const [digits, setDigits] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function press(key: (typeof KEYS)[number]) {
    setError('')
    if (key === 'clear') return setDigits('')
    if (key === 'back') return setDigits((current) => current.slice(0, -1))
    setDigits((current) => (current.length < 9 ? current + key : current))
  }

  async function submit() {
    if (digits.length !== 9) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/kiosk/check?phone=${digits}`, { credentials: 'same-origin' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Coś poszło nie tak.')
      onMember({ phone: data.phone, firstName: data.firstName, tierName: data.tierName, tierPercent: data.tierPercent ?? 0 })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Coś poszło nie tak.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-5">
      <span className="grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
        <Star className="size-8 fill-current" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1 text-center">
        <h2 className="text-3xl font-black text-balance">{title}</h2>
        <p className="text-lg text-muted-foreground text-balance">Wpisz numer telefonu przypisany do konta</p>
      </div>

      <motion.output
        aria-live="polite"
        aria-label="Wpisany numer telefonu"
        animate={error ? { x: [0, -10, 10, -6, 0] } : { x: 0 }}
        className={`flex h-20 w-full items-center justify-center rounded-3xl border-2 bg-card text-4xl font-black tracking-wider tabular-nums ${error ? 'border-destructive' : 'border-border'}`}
      >
        {digits ? formatDigits(digits) : <span className="text-muted-foreground/50">{'___ ___ ___'}</span>}
      </motion.output>

      <AnimatePresence>
        {error && (
          <motion.p role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="-mt-2 text-center font-semibold text-destructive">
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="grid w-full grid-cols-3 gap-3">
        {KEYS.map((key) => (
          <motion.button
            key={key}
            type="button"
            onClick={() => press(key)}
            whileTap={{ scale: 0.9 }}
            aria-label={key === 'back' ? 'Usuń cyfrę' : key === 'clear' ? 'Wyczyść' : key}
            className={`grid h-16 place-items-center rounded-2xl text-3xl font-black shadow-sm ${key === 'clear' || key === 'back' ? 'bg-muted text-muted-foreground' : 'bg-card'}`}
          >
            {key === 'back' ? <Delete className="size-7" aria-hidden="true" /> : key === 'clear' ? <span className="text-base font-bold">Wyczyść</span> : key}
          </motion.button>
        ))}
      </div>

      <motion.button
        type="button"
        onClick={submit}
        disabled={digits.length !== 9 || busy}
        whileTap={{ scale: 0.97 }}
        className="inline-flex h-16 w-full items-center justify-center gap-2 rounded-full bg-primary text-xl font-black text-primary-foreground transition-opacity disabled:opacity-40"
      >
        {busy && <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />}
        {busy ? 'Sprawdzam…' : 'Zatwierdź'}
      </motion.button>
      <button type="button" onClick={onSkip} className="h-12 px-4 text-lg font-bold text-muted-foreground underline-offset-4 hover:underline">
        {skipLabel}
      </button>
    </div>
  )
}

export function KioskPhoneScreen({ onMember, onBack, onSkip }: { onMember: (club: NonNullable<ClubState>) => void; onBack: () => void; onSkip: () => void }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col bg-background">
      <header className="flex shrink-0 items-center px-4 pt-4 md:px-6">
        <motion.button type="button" onClick={onBack} whileTap={{ scale: 0.9 }} className="grid size-14 place-items-center rounded-full bg-card shadow-sm" aria-label="Wróć">
          <ArrowLeft className="size-7" aria-hidden="true" />
        </motion.button>
      </header>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 py-6">
        <PhonePad onMember={onMember} onSkip={onSkip} skipLabel="Zamawiam bez punktów" />
      </div>
    </section>
  )
}

export function KioskPhoneSheet({ open, onClose, onMember }: { open: boolean; onClose: () => void; onMember: (club: NonNullable<ClubState>) => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="phone-sheet" className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
          <motion.button type="button" aria-label="Zamknij" onClick={onClose} className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Yummy Club"
            className="relative flex max-h-[94dvh] w-full justify-center overflow-y-auto rounded-t-[2rem] bg-background px-6 pb-6 pt-10 shadow-2xl md:w-[min(30rem,calc(100vw-2rem))] md:rounded-[2rem]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
          >
            <motion.button type="button" onClick={onClose} whileTap={{ scale: 0.9 }} className="absolute right-3 top-3 grid size-12 place-items-center rounded-full bg-muted" aria-label="Zamknij">
              <X className="size-6" aria-hidden="true" />
            </motion.button>
            <PhonePad onMember={onMember} onSkip={onClose} skipLabel="Anuluj" title="Dodaj punkty do zamówienia" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function ClubBadge({ club, onClear }: { club: NonNullable<ClubState>; onClear?: () => void }) {
  return (
    <span className="inline-flex h-12 max-w-full items-center gap-2 rounded-full bg-primary/10 pl-2 pr-1 text-primary">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
        <Star className="size-4 fill-current" aria-hidden="true" />
      </span>
      <span className="truncate font-bold">{club.firstName ? `${club.firstName} · ${club.tierName}` : club.tierName}</span>
      {onClear && (
        <button type="button" onClick={onClear} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-primary/10" aria-label="Usuń numer Yummy Club">
          <X className="size-5" aria-hidden="true" />
        </button>
      )}
    </span>
  )
}
