'use client'

import { useEffect, useRef, useState } from 'react'

const PARTICLE_COLORS = ['255,79,216', '236,72,153', '192,132,252', '168,85,247', '240,171,252']
const LOGO_RATIO = 485 / 812

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  color: string
}

const outerTransform = (x: number, y: number, s: number) => `translate(${x}px, ${y}px) scale(${s})`
const innerTransform = (rotateY: number, rotate: number, scaleX = 1, scaleY = 1, lift = 0) =>
  `perspective(600px) translateY(${lift}px) rotateY(${rotateY}deg) rotate(${rotate}deg) scale(${scaleX}, ${scaleY})`

export function HomeFarewell() {
  const darkRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const skipRef = useRef<() => void>(() => {})
  const [visible, setVisible] = useState(true)
  const [blocking, setBlocking] = useState(false)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    const html = document.documentElement
    const dark = darkRef.current
    const canvas = canvasRef.current
    const outer = outerRef.current
    const inner = innerRef.current
    if (!dark || !canvas || !outer || !inner) return

    const timers: number[] = []
    const animations: Animation[] = []
    let raf = 0
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const headerLogo = document.querySelector<HTMLImageElement>('header img[alt="Yummy"]')

    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms))
    const play = (el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
      const animation = el.animate(keyframes, { fill: 'forwards', ...options })
      animations.push(animation)
      return animation
    }

    const vw = window.innerWidth
    const vh = window.innerHeight
    const rect = headerLogo?.getBoundingClientRect()
    const hasRect = rect && rect.width > 0 && rect.bottom > 0
    const w = hasRect ? rect.width : 80
    const h = hasRect ? rect.height : 80 * LOGO_RATIO
    const sx = hasRect ? rect.left : vw / 2 - w / 2
    const sy = hasRect ? rect.top : -h - 20
    const S = Math.min(vw * 0.42, 240) / w
    const centered = (scale: number, yRatio: number) =>
      [vw / 2 - (w * scale) / 2, vh * yRatio - (h * scale) / 2] as const
    const [landX, landY] = centered(S, 0.62)
    const [faceX, faceY] = centered(S * 1.12, 0.5)
    const [awayX, awayY] = centered(S * 0.14, 0.4)

    outer.style.width = `${w}px`
    outer.style.height = `${h}px`
    outer.style.transform = outerTransform(sx, sy, 1)

    const restore = () => {
      timers.forEach(clearTimeout)
      animations.forEach((a) => a.cancel())
      cancelAnimationFrame(raf)
      html.classList.remove('yd-alive', 'yd-frozen', 'yd-holo')
      html.style.overflow = ''
      if (headerLogo) headerLogo.style.visibility = ''
    }
    skipRef.current = () => {
      restore()
      setVisible(false)
    }

    if (reduceMotion) {
      at(3000, () => {
        html.style.overflow = 'hidden'
        setBlocking(true)
        play(dark, [{ opacity: 0 }, { opacity: 1 }], { duration: 2500, easing: 'ease-in-out' })
      })
      at(6000, () => setFinished(true))
      return restore
    }

    // 0–3 s: ostatnie chwile – interfejs pulsuje
    html.classList.add('yd-alive')

    // 3–5 s: zatrzymanie – logo spada i się rozgląda
    at(3000, () => {
      html.classList.remove('yd-alive')
      html.classList.add('yd-frozen')
      html.style.overflow = 'hidden'
      setBlocking(true)
      if (headerLogo) headerLogo.style.visibility = 'hidden'
      outer.style.opacity = '1'
      play(inner, [
        { transform: innerTransform(0, 0) },
        { transform: innerTransform(0, -9) },
        { transform: innerTransform(0, 7) },
        { transform: innerTransform(0, 0) },
      ], { duration: 300, easing: 'ease-in-out' })
    })
    at(3300, () => {
      play(outer, [
        { transform: outerTransform(sx, sy, 1) },
        { transform: outerTransform(sx, sy - 14, 1.05), offset: 0.15 },
        { transform: outerTransform(landX, landY, S) },
      ], { duration: 800, easing: 'cubic-bezier(.5,0,.85,.55)' })
    })
    at(4100, () => {
      play(inner, [
        { transform: innerTransform(0, 0, 1.18, 0.78) },
        { transform: innerTransform(0, 0, 0.94, 1.08, -10) },
        { transform: innerTransform(0, 0) },
      ], { duration: 320, easing: 'ease-out' })
    })
    at(4420, () => {
      play(inner, [
        { transform: innerTransform(0, 0) },
        { transform: innerTransform(-38, 0), offset: 0.25 },
        { transform: innerTransform(-38, 0), offset: 0.4 },
        { transform: innerTransform(38, 0), offset: 0.7 },
        { transform: innerTransform(38, 0), offset: 0.8 },
        { transform: innerTransform(0, -15) },
      ], { duration: 780, easing: 'ease-in-out' })
    })

    // 5–8 s: rozpad hologramu na cząsteczki
    at(5000, () => {
      html.classList.add('yd-holo')
      dark.style.opacity = '1'
      play(inner, [
        { transform: innerTransform(0, -15) },
        { transform: innerTransform(-22, -8), offset: 0.3 },
        { transform: innerTransform(14, -12), offset: 0.65 },
        { transform: innerTransform(0, -15) },
      ], { duration: 2800, easing: 'ease-in-out' })
      play(outer, [
        { filter: 'drop-shadow(0 0 0 rgba(236,72,153,0))' },
        { filter: 'drop-shadow(0 0 14px rgba(236,72,153,.75))' },
      ], { duration: 1500, composite: 'add' })

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = vw * dpr
      canvas.height = vh * dpr
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(dpr, dpr)

      const particles: Particle[] = []
      const duration = 3000
      const start = performance.now()
      const perFrame = Math.min(140, Math.round((vw / 360) * 45))

      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / duration)
        const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
        const band = eased * (vh + 200) - 100
        const mask = `linear-gradient(to bottom, #000 ${band - 70}px, rgba(0,0,0,.55) ${band}px, transparent ${band + 50}px)`
        dark.style.maskImage = mask
        dark.style.webkitMaskImage = mask

        if (p < 1) {
          for (let i = 0; i < perFrame; i++) {
            const max = 50 + Math.random() * 80
            particles.push({
              x: Math.random() * vw,
              y: band + (Math.random() - 0.3) * 60,
              vx: (Math.random() - 0.5) * 0.7,
              vy: -(0.3 + Math.random() * 1.4),
              life: max,
              max,
              size: 0.6 + Math.random() * 2.2,
              color: PARTICLE_COLORS[(Math.random() * PARTICLE_COLORS.length) | 0],
            })
          }
        }

        ctx.clearRect(0, 0, vw, vh)
        ctx.globalCompositeOperation = 'lighter'
        for (let i = particles.length - 1; i >= 0; i--) {
          const pt = particles[i]
          pt.life -= 1
          if (pt.life <= 0) {
            particles.splice(i, 1)
            continue
          }
          pt.vx += (Math.random() - 0.5) * 0.08
          pt.x += pt.vx
          pt.y += pt.vy
          const alpha = (pt.life / pt.max) * 0.85
          ctx.fillStyle = `rgba(${pt.color},${alpha})`
          ctx.fillRect(pt.x, pt.y, pt.size, pt.size)
        }

        if (p < 1) {
          const line = ctx.createLinearGradient(0, band - 3, 0, band + 3)
          line.addColorStop(0, 'rgba(236,72,153,0)')
          line.addColorStop(0.5, 'rgba(240,171,252,.55)')
          line.addColorStop(1, 'rgba(168,85,247,0)')
          ctx.fillStyle = line
          ctx.fillRect(0, band - 3, vw, 6)
        } else {
          dark.style.maskImage = 'none'
          dark.style.webkitMaskImage = 'none'
        }

        if (p < 1 || particles.length > 0) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    })

    // 8–11 s: pożegnanie – spojrzenie, odwrót, odejście i zgaśnięcie
    at(8000, () => {
      html.classList.remove('yd-holo')
      play(outer, [
        { transform: outerTransform(landX, landY, S) },
        { transform: outerTransform(faceX, faceY, S * 1.12) },
      ], { duration: 800, easing: 'cubic-bezier(.4,0,.2,1)' })
      play(inner, [
        { transform: innerTransform(0, -15) },
        { transform: innerTransform(0, 0), offset: 0.55 },
        { transform: innerTransform(0, 0, 1, 1, -7), offset: 0.75 },
        { transform: innerTransform(0, 0) },
      ], { duration: 1000, easing: 'ease-in-out' })
    })
    at(9100, () => {
      play(inner, [
        { transform: innerTransform(0, 0), filter: 'brightness(1)' },
        { transform: innerTransform(180, 0), filter: 'brightness(.7)' },
      ], { duration: 550, easing: 'ease-in-out' })
    })
    at(9650, () => {
      play(outer, [
        { transform: outerTransform(faceX, faceY, S * 1.12) },
        { transform: outerTransform(awayX, awayY, S * 0.14) },
      ], { duration: 1350, easing: 'cubic-bezier(.3,.1,.5,1)' })
      play(inner, [
        { transform: innerTransform(180, 0), filter: 'brightness(.7)' },
        { transform: innerTransform(180, 4, 1, 1, -5), filter: 'brightness(.7)' },
        { transform: innerTransform(180, -4), filter: 'brightness(.7)' },
        { transform: innerTransform(180, 4, 1, 1, -5), filter: 'brightness(.7)' },
        { transform: innerTransform(180, -4), filter: 'brightness(.7)' },
        { transform: innerTransform(180, 0), filter: 'brightness(.75)' },
      ], { duration: 1350, easing: 'linear' })
    })
    at(10900, () => {
      play(outer, [
        { opacity: 1, filter: 'drop-shadow(0 0 14px rgba(236,72,153,.75))' },
        { opacity: 1, filter: 'drop-shadow(0 0 26px rgba(240,171,252,.95))', offset: 0.35 },
        { opacity: 0, filter: 'drop-shadow(0 0 0 rgba(236,72,153,0))' },
      ], { duration: 1100, easing: 'ease-out' })
    })
    at(12000, () => setFinished(true))

    return restore
  }, [])

  if (!visible) return null

  return (
    <div className="yd-root" aria-hidden={finished ? undefined : true}>
      <div
        ref={darkRef}
        className="fixed inset-0 z-[9990] bg-[#0b0612] opacity-0"
        style={{ pointerEvents: blocking ? 'auto' : 'none' }}
      />
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[9991] h-full w-full" />
      <div
        ref={outerRef}
        className="pointer-events-none fixed left-0 top-0 z-[9992] opacity-0"
        style={{ transformOrigin: '0 0', willChange: 'transform, opacity' }}
      >
        <div ref={innerRef} className="h-full w-full" style={{ transformOrigin: '50% 85%' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/yummy-logo.webp" alt="" className="h-full w-full select-none" draggable={false} />
        </div>
      </div>
      {!finished && (
        <button
          type="button"
          onClick={() => skipRef.current()}
          className="fixed bottom-4 right-4 z-[9993] rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"
        >
          Pomiń animację
        </button>
      )}
    </div>
  )
}
