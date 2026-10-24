'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { KIOSK_IDLE_SECONDS } from '@/lib/kiosk'
import type { ProductDraftLine } from '@/components/yummy/product-dialog'
import { KioskStart } from './kiosk-start'
import { KioskMenu } from './kiosk-menu'
import { KioskCheckout } from './kiosk-checkout'
import { KioskDone } from './kiosk-done'

export type KioskLine = ProductDraftLine & { key: string }
type Step = 'start' | 'menu' | 'checkout' | 'done'

const order: Record<Step, number> = { start: 0, menu: 1, checkout: 2, done: 3 }

const variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 80, scale: 0.98 }),
  center: { opacity: 1, x: 0, scale: 1 },
  exit: (direction: number) => ({ opacity: 0, x: direction * -80, scale: 0.98 }),
}

function sameLine(a: ProductDraftLine, b: ProductDraftLine) {
  return a.productId === b.productId && a.details.join('|') === b.details.join('|') && JSON.stringify(a.selection ?? null) === JSON.stringify(b.selection ?? null)
}

export function KioskApp() {
  const [step, setStepState] = useState<Step>('start')
  const [direction, setDirection] = useState(1)
  const [lines, setLines] = useState<KioskLine[]>([])
  const [orderNumber, setOrderNumber] = useState<number | null>(null)

  const setStep = useCallback((next: Step) => {
    setStepState((current) => {
      setDirection(order[next] >= order[current] ? 1 : -1)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setLines([])
    setOrderNumber(null)
    setStep('start')
  }, [setStep])

  useEffect(() => {
    if (step === 'start' || step === 'done') return
    let timer = window.setTimeout(reset, KIOSK_IDLE_SECONDS * 1000)
    const restart = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(reset, KIOSK_IDLE_SECONDS * 1000)
    }
    const events = ['pointerdown', 'keydown', 'scroll'] as const
    events.forEach((name) => window.addEventListener(name, restart, { passive: true, capture: true }))
    return () => {
      window.clearTimeout(timer)
      events.forEach((name) => window.removeEventListener(name, restart, { capture: true }))
    }
  }, [step, reset])

  const addLine = (line: ProductDraftLine) =>
    setLines((prev) => {
      const existing = prev.find((item) => sameLine(item, line))
      if (existing) return prev.map((item) => (item.key === existing.key ? { ...item, quantity: item.quantity + line.quantity } : item))
      return [...prev, { ...line, key: crypto.randomUUID() }]
    })

  const setQuantity = (key: string, quantity: number) =>
    setLines((prev) => (quantity < 1 ? prev.filter((line) => line.key !== key) : prev.map((line) => (line.key === key ? { ...line, quantity } : line))))

  return (
    <MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 420, damping: 36 }}>
      <main className="relative flex h-dvh select-none flex-col overflow-hidden bg-background text-foreground">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 380, damping: 38, opacity: { duration: 0.18 } }}
            className="flex min-h-0 flex-1 flex-col"
          >
            {step === 'start' && <KioskStart onStart={() => setStep('menu')} />}
            {step === 'menu' && (
              <KioskMenu lines={lines} onAdd={addLine} onCancel={reset} onCheckout={() => setStep('checkout')} />
            )}
            {step === 'checkout' && (
              <KioskCheckout
                lines={lines}
                onQuantity={setQuantity}
                onBack={() => setStep('menu')}
                onPlaced={(number) => {
                  setOrderNumber(number)
                  setLines([])
                  setStep('done')
                }}
              />
            )}
            {step === 'done' && orderNumber !== null && <KioskDone orderNumber={orderNumber} onFinish={reset} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </MotionConfig>
  )
}
