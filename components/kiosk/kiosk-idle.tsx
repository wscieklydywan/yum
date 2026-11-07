'use client'

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Hand, RotateCcw } from 'lucide-react'
import { KIOSK_PROMPT_SECONDS } from '@/lib/kiosk'

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function KioskIdlePrompt({ onContinue, onTimeout }: { onContinue: () => void; onTimeout: () => void }) {
  const [left, setLeft] = useState(KIOSK_PROMPT_SECONDS)

  useEffect(() => {
    const startedAt = Date.now()
    const interval = window.setInterval(() => {
      const remaining = KIOSK_PROMPT_SECONDS - Math.floor((Date.now() - startedAt) / 1000)
      setLeft(Math.max(0, remaining))
      if (remaining <= 0) {
        window.clearInterval(interval)
        onTimeout()
      }
    }, 250)
    return () => window.clearInterval(interval)
  }, [onTimeout])

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="kiosk-idle-title"
        aria-describedby="kiosk-idle-desc"
        className="flex w-full max-w-md flex-col items-center gap-6 rounded-[2rem] bg-card p-8 text-center shadow-2xl"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
      >
        <span className="relative grid size-32 place-items-center">
          <svg viewBox="0 0 120 120" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
            <circle cx="60" cy="60" r={RADIUS} fill="none" strokeWidth="8" className="stroke-muted" />
            <motion.circle
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className="stroke-primary"
              strokeDasharray={CIRCUMFERENCE}
              initial={{ strokeDashoffset: 0 }}
              animate={{ strokeDashoffset: CIRCUMFERENCE }}
              transition={{ duration: KIOSK_PROMPT_SECONDS, ease: 'linear' }}
            />
          </svg>
          <span className="text-5xl font-black tabular-nums" aria-live="polite">{left}</span>
        </span>

        <div className="flex flex-col gap-2">
          <h2 id="kiosk-idle-title" className="text-3xl font-black text-balance">Czy potrzebujesz więcej czasu?</h2>
          <p id="kiosk-idle-desc" className="text-lg text-muted-foreground text-balance">
            Jeśli nic nie wybierzesz, zamówienie zostanie anulowane.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <motion.button
            type="button"
            onClick={onContinue}
            whileTap={{ scale: 0.96 }}
            autoFocus
            className="inline-flex h-16 items-center justify-center gap-3 rounded-full bg-primary text-xl font-black text-primary-foreground"
          >
            <Hand className="size-6" aria-hidden="true" />
            Tak, kontynuuję
          </motion.button>
          <motion.button
            type="button"
            onClick={onTimeout}
            whileTap={{ scale: 0.96 }}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-full border-2 border-border text-lg font-bold"
          >
            <RotateCcw className="size-5" aria-hidden="true" />
            Zacznij od nowa
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}
