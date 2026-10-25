'use client'

import { useEffect } from 'react'
import { motion } from 'motion/react'

const RETURN_AFTER_MS = 15_000

export function KioskDone({ orderNumber, onFinish }: { orderNumber: number; onFinish: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onFinish, RETURN_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [onFinish])

  return (
    <section className="relative flex flex-1 flex-col items-center justify-center gap-8 overflow-hidden bg-primary px-6 text-center text-primary-foreground" aria-live="polite">
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute size-[40rem] rounded-full bg-primary-foreground/10"
        initial={{ scale: 0 }}
        animate={{ scale: 1.4, opacity: [1, 0.4] }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />

      <motion.span
        className="relative grid size-24 place-items-center rounded-full bg-background text-primary"
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
      >
        <svg viewBox="0 0 24 24" className="size-14" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.25, duration: 0.4 }} />
        </svg>
      </motion.span>

      <motion.div className="relative flex flex-col gap-1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <p className="text-2xl font-semibold opacity-90">Twój numer zamówienia</p>
        <motion.p
          className="text-[9rem] font-black leading-none tabular-nums md:text-[14rem]"
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 260, damping: 16 }}
        >
          {orderNumber}
        </motion.p>
      </motion.div>

      <motion.div className="relative flex flex-col items-center gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
        <p className="text-4xl font-black uppercase">Dziękujemy!</p>
        <p className="max-w-xl text-xl opacity-90 text-balance">Zapłać i odbierz zamówienie przy barze, gdy usłyszysz swój numer.</p>
      </motion.div>

      <motion.button
        type="button"
        onClick={onFinish}
        whileTap={{ scale: 0.94 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.75 }}
        className="relative h-16 overflow-hidden rounded-full bg-background px-12 text-xl font-black uppercase text-primary"
      >
        <motion.span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-primary/15"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: RETURN_AFTER_MS / 1000, ease: 'linear' }}
        />
        <span className="relative">Gotowe</span>
      </motion.button>
    </section>
  )
}
