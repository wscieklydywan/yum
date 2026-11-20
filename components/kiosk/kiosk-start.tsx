'use client'

import { motion } from 'motion/react'
import { BellRing, ChevronRight, CreditCard, Hand, ShoppingBag, Star } from 'lucide-react'
import { Logo } from '@/components/yummy/logo'

const steps = [
  { icon: Hand, title: 'Wybierz z menu', text: 'Jednym dotknięciem dodasz produkt' },
  { icon: CreditCard, title: 'Zapłać przy barze', text: 'Gotówką lub kartą' },
  { icon: BellRing, title: 'Odbierz zamówienie', text: 'Gdy pojawi się Twój numer' },
]

export function KioskStart({ onStart, onClub }: { onStart: () => void; onClub: () => void }) {
  return (
    <section className="flex flex-1 flex-col items-center overflow-hidden bg-background px-5 pb-6 pt-8 text-center md:px-10 md:pb-10 md:pt-14">
      <Logo className="h-12 w-auto md:h-20" priority />

      <h1 className="mt-5 text-5xl font-black leading-[0.92] tracking-tight text-balance md:mt-8 md:text-8xl">
        Zamów
        <br />
        na miejscu
      </h1>

      <div className="flex min-h-0 w-full max-w-2xl flex-1 items-center py-5 md:py-10">
        <ol className="flex w-full flex-col overflow-hidden rounded-[2rem] bg-foreground text-background">
          {steps.map((step, index) => (
            <motion.li
              key={step.title}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'tween', duration: 0.3, delay: 0.08 * index, ease: 'easeOut' }}
              className="flex items-center gap-4 border-b border-background/10 px-5 py-4 text-left last:border-0 md:gap-6 md:px-8 md:py-7"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-lg font-black text-primary-foreground tabular-nums md:size-16 md:text-2xl">
                {index + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-lg font-black leading-tight md:text-3xl">{step.title}</span>
                <span className="text-sm leading-snug text-background/65 md:text-xl">{step.text}</span>
              </span>
              <step.icon className="size-6 shrink-0 text-background/40 md:size-9" aria-hidden="true" />
            </motion.li>
          ))}
        </ol>
      </div>

      <div className="flex w-full max-w-2xl flex-col gap-3 md:gap-4">
        <StartCard
          onClick={onStart}
          icon={<ShoppingBag className="size-6 md:size-9" aria-hidden="true" />}
          title="Zacznij zamówienie"
          subtitle="Odbiór przy barze"
          primary
        />
        <StartCard
          onClick={onClub}
          icon={<Star className="size-6 md:size-9" aria-hidden="true" />}
          title="Mam Yummy Club"
          subtitle="Wpisz numer i zbieraj punkty"
        />
      </div>
    </section>
  )
}

function StartCard({ onClick, icon, title, subtitle, primary }: { onClick: () => void; icon: React.ReactNode; title: string; subtitle: string; primary?: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className={`flex min-h-20 w-full items-center gap-3 rounded-3xl px-4 py-3 text-left shadow-lg md:min-h-28 md:gap-5 md:px-6 ${primary ? 'bg-primary text-primary-foreground shadow-primary/25' : 'bg-card text-foreground'}`}
    >
      <span className={`grid size-12 shrink-0 place-items-center rounded-2xl md:size-16 ${primary ? 'bg-black/15' : 'bg-primary/10 text-primary'}`}>{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-xl font-black leading-tight md:text-3xl">{title}</span>
        <span className={`text-sm leading-snug md:text-lg ${primary ? 'opacity-90' : 'text-muted-foreground'}`}>{subtitle}</span>
      </span>
      <ChevronRight className={`size-7 shrink-0 md:size-9 ${primary ? '' : 'text-primary'}`} aria-hidden="true" />
    </motion.button>
  )
}
