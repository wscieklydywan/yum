'use client'

import { motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { Logo } from '@/components/yummy/logo'

export function KioskStart({ onStart }: { onStart: () => void }) {
  return (
    <button
      type="button"
      onClick={onStart}
      className="relative flex flex-1 flex-col items-center justify-center gap-12 overflow-hidden bg-primary px-6 text-center text-primary-foreground outline-none"
    >
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 size-[28rem] rounded-full bg-primary-foreground/10"
        animate={{ scale: [1, 1.15, 1], x: [0, 30, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-24 size-[32rem] rounded-full bg-black/10"
        animate={{ scale: [1.1, 1, 1.1], y: [0, -30, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.span
        className="relative rounded-[2rem] bg-background px-8 py-6 shadow-2xl"
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: [0, -8, 0], opacity: 1 }}
        transition={{ y: { duration: 4, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.4 } }}
      >
        <Logo className="h-16 w-auto md:h-24" />
      </motion.span>

      <motion.span
        className="relative flex flex-col gap-3"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <span className="text-6xl font-black uppercase leading-[0.9] tracking-tight text-balance md:text-8xl">
          Głodny?
          <br />
          Zamów tutaj
        </span>
        <span className="text-lg font-medium opacity-90 md:text-2xl">Na miejscu · odbiór przy barze</span>
      </motion.span>

      <span className="relative">
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-background"
          animate={{ scale: [1, 1.25], opacity: [0.5, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
        />
        <motion.span
          className="relative inline-flex items-center gap-4 rounded-full bg-background py-5 pl-10 pr-5 text-2xl font-black uppercase text-primary shadow-2xl md:text-3xl"
          whileTap={{ scale: 0.94 }}
        >
          Rozpocznij
          <motion.span
            className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground md:size-14"
            animate={{ x: [0, 6, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ArrowRight className="size-7" aria-hidden="true" />
          </motion.span>
        </motion.span>
      </span>
    </button>
  )
}
