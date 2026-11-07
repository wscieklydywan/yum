'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { KIOSK_IDLE_SECONDS } from '@/lib/kiosk'
import type { ProductDraftLine } from '@/components/yummy/product-dialog'
import { KioskStart } from './kiosk-start'
import { KioskMenu } from './kiosk-menu'
import { KioskCheckout } from './kiosk-checkout'
import { KioskDone } from './kiosk-done'
import { KioskIdlePrompt } from './kiosk-idle'
import { KioskPhoneScreen, KioskPhoneSheet, type ClubState } from './kiosk-phone'

export type KioskLine = ProductDraftLine & { key: string }
type Step = 'start' | 'phone' | 'menu' | 'checkout' | 'done'

const order: Record<Step, number> = { start: 0, phone: 1, menu: 2, checkout: 3, done: 4 }

const variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 32 }),
  center: { opacity: 1, x: 0, transition: { type: 'tween' as const, duration: 0.2, ease: [0.25, 1, 0.5, 1] as const } },
  exit: (direction: number) => ({ opacity: 0, x: direction * -24, transition: { type: 'tween' as const, duration: 0.12, ease: 'easeIn' as const } }),
}

function sameLine(a: ProductDraftLine, b: ProductDraftLine) {
  return a.productId === b.productId && a.details.join('|') === b.details.join('|') && JSON.stringify(a.selection ?? null) === JSON.stringify(b.selection ?? null)
}

export function KioskApp() {
  const [step, setStepState] = useState<Step>('start')
  const [direction, setDirection] = useState(1)
  const [lines, setLines] = useState<KioskLine[]>([])
  const [club, setClub] = useState<ClubState>(null)
  const [phoneSheet, setPhoneSheet] = useState(false)
  const [idlePrompt, setIdlePrompt] = useState(false)
  const [orderNumber, setOrderNumber] = useState<number | null>(null)

  const setStep = useCallback((next: Step) => {
    setStepState((current) => {
      setDirection(order[next] >= order[current] ? 1 : -1)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setLines([])
    setClub(null)
    setPhoneSheet(false)
    setIdlePrompt(false)
    setOrderNumber(null)
    setStep('start')
  }, [setStep])

  useEffect(() => {
    if (step === 'start' || step === 'done' || idlePrompt) return
    let timer = window.setTimeout(() => setIdlePrompt(true), KIOSK_IDLE_SECONDS * 1000)
    const restart = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setIdlePrompt(true), KIOSK_IDLE_SECONDS * 1000)
    }
    const events = ['pointerdown', 'keydown', 'scroll'] as const
    events.forEach((name) => window.addEventListener(name, restart, { passive: true, capture: true }))
    return () => {
      window.clearTimeout(timer)
      events.forEach((name) => window.removeEventListener(name, restart, { capture: true }))
    }
  }, [step, idlePrompt])

  const addLine = (line: ProductDraftLine) =>
    setLines((prev) => {
      const existing = prev.find((item) => sameLine(item, line))
      if (existing) return prev.map((item) => (item.key === existing.key ? { ...item, quantity: item.quantity + line.quantity } : item))
      return [...prev, { ...line, key: crypto.randomUUID() }]
    })

  const setQuantity = (key: string, quantity: number) =>
    setLines((prev) => (quantity < 1 ? prev.filter((line) => line.key !== key) : prev.map((line) => (line.key === key ? { ...line, quantity } : line))))

  const onMember = (member: NonNullable<ClubState>) => {
    setClub(member)
    setPhoneSheet(false)
    if (step === 'phone') setStep('menu')
  }

  return (
    <MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 420, damping: 36 }}>
      <main className="relative flex h-dvh select-none flex-col overflow-hidden bg-background text-foreground">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex min-h-0 flex-1 flex-col will-change-transform"
          >
            {step === 'start' && <KioskStart onStart={() => setStep('menu')} onClub={() => setStep('phone')} />}
            {step === 'phone' && <KioskPhoneScreen onMember={onMember} onBack={reset} onSkip={() => setStep('menu')} />}
            {step === 'menu' && (
              <KioskMenu
                lines={lines}
                club={club}
                onAdd={addLine}
                onQuantity={setQuantity}
                onCancel={reset}
                onCheckout={() => setStep('checkout')}
                onClub={() => setPhoneSheet(true)}
              />
            )}
            {step === 'checkout' && (
              <KioskCheckout
                lines={lines}
                club={club}
                onQuantity={setQuantity}
                onBack={() => setStep('menu')}
                onClub={() => setPhoneSheet(true)}
                onClearClub={() => setClub(null)}
                onPlaced={(number) => {
                  setOrderNumber(number)
                  setLines([])
                  setClub(null)
                  setStep('done')
                }}
              />
            )}
            {step === 'done' && orderNumber !== null && <KioskDone orderNumber={orderNumber} onFinish={reset} />}
          </motion.div>
        </AnimatePresence>

        <KioskPhoneSheet open={phoneSheet} onClose={() => setPhoneSheet(false)} onMember={onMember} />

        <AnimatePresence>{idlePrompt && <KioskIdlePrompt onContinue={() => setIdlePrompt(false)} onTimeout={reset} />}</AnimatePresence>
      </main>
    </MotionConfig>
  )
}
