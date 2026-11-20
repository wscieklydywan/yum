'use client'

import { useEffect, useRef } from 'react'
import { playSound } from '@/lib/halloween-sound'

const W = 360
const H = 540
const PLAYER_Y = H - 46
const PLAYER_HALF = 34
const START_LIVES = 3

type ItemType = 'pumpkin' | 'candy' | 'golden' | 'skull' | 'bat'
type Item = { x: number; y: number; vy: number; phase: number; type: ItemType; r: number }
type Floater = { x: number; y: number; text: string; life: number; color: string }

const itemValue: Record<ItemType, number> = { pumpkin: 10, candy: 5, golden: 50, skull: 0, bat: 0 }
const isHazard = (type: ItemType) => type === 'skull' || type === 'bat'

function pickType(elapsed: number): ItemType {
  const hazardChance = 0.2 + Math.min(0.2, elapsed * 0.004)
  const roll = Math.random()
  if (roll < hazardChance) return Math.random() < 0.55 ? 'skull' : 'bat'
  if (roll < hazardChance + 0.04) return 'golden'
  return Math.random() < 0.6 ? 'pumpkin' : 'candy'
}

function drawPumpkin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, golden: boolean) {
  ctx.save()
  ctx.translate(x, y)
  const body = golden ? '#f7c948' : '#f07b1d'
  const shade = golden ? '#d79a1c' : '#c95a0c'
  if (golden) {
    ctx.shadowColor = 'rgba(255,214,90,0.9)'
    ctx.shadowBlur = 16
  }
  ctx.fillStyle = shade
  ctx.beginPath()
  ctx.ellipse(-r * 0.45, 0, r * 0.6, r * 0.85, 0, 0, Math.PI * 2)
  ctx.ellipse(r * 0.45, 0, r * 0.6, r * 0.85, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.ellipse(0, 0, r * 0.62, r * 0.88, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#3f6b2a'
  ctx.fillRect(-r * 0.1, -r * 1.12, r * 0.2, r * 0.36)
  ctx.fillStyle = '#2a1405'
  ctx.beginPath()
  ctx.moveTo(-r * 0.42, -r * 0.18)
  ctx.lineTo(-r * 0.16, -r * 0.18)
  ctx.lineTo(-r * 0.29, -r * 0.42)
  ctx.closePath()
  ctx.moveTo(r * 0.42, -r * 0.18)
  ctx.lineTo(r * 0.16, -r * 0.18)
  ctx.lineTo(r * 0.29, -r * 0.42)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-r * 0.45, r * 0.18)
  ctx.quadraticCurveTo(0, r * 0.62, r * 0.45, r * 0.18)
  ctx.quadraticCurveTo(0, r * 0.36, -r * 0.45, r * 0.18)
  ctx.fill()
  ctx.restore()
}

function drawCandy(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, phase: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(Math.sin(phase * 3) * 0.4)
  ctx.fillStyle = '#b26bf0'
  ctx.beginPath()
  ctx.moveTo(-r * 0.7, 0)
  ctx.lineTo(-r * 1.4, -r * 0.6)
  ctx.lineTo(-r * 1.4, r * 0.6)
  ctx.closePath()
  ctx.moveTo(r * 0.7, 0)
  ctx.lineTo(r * 1.4, -r * 0.6)
  ctx.lineTo(r * 1.4, r * 0.6)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#e9d5ff'
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#b26bf0'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.4, 0, Math.PI * 1.4)
  ctx.stroke()
  ctx.restore()
}

function drawSkull(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = '#efe9df'
  ctx.beginPath()
  ctx.arc(0, -r * 0.1, r * 0.85, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillRect(-r * 0.45, r * 0.4, r * 0.9, r * 0.45)
  ctx.fillStyle = '#1b0f22'
  ctx.beginPath()
  ctx.arc(-r * 0.32, -r * 0.1, r * 0.22, 0, Math.PI * 2)
  ctx.arc(r * 0.32, -r * 0.1, r * 0.22, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillRect(-r * 0.06, r * 0.18, r * 0.12, r * 0.2)
  ctx.fillRect(-r * 0.3, r * 0.55, r * 0.08, r * 0.3)
  ctx.fillRect(r * 0.22, r * 0.55, r * 0.08, r * 0.3)
  ctx.restore()
}

function drawBat(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, phase: number) {
  const flap = Math.sin(phase * 14) * r * 0.45
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = '#120a18'
  ctx.strokeStyle = 'rgba(190,140,255,0.55)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(0, -r * 0.2)
  ctx.quadraticCurveTo(-r * 0.9, -r * 0.6 - flap, -r * 1.6, -flap)
  ctx.quadraticCurveTo(-r * 1.1, r * 0.1, -r * 0.9, r * 0.45)
  ctx.quadraticCurveTo(-r * 0.5, r * 0.2, 0, r * 0.5)
  ctx.quadraticCurveTo(r * 0.5, r * 0.2, r * 0.9, r * 0.45)
  ctx.quadraticCurveTo(r * 1.1, r * 0.1, r * 1.6, -flap)
  ctx.quadraticCurveTo(r * 0.9, -r * 0.6 - flap, 0, -r * 0.2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#ff4d4d'
  ctx.fillRect(-r * 0.22, -r * 0.05, r * 0.12, r * 0.12)
  ctx.fillRect(r * 0.1, -r * 0.05, r * 0.12, r * 0.12)
  ctx.restore()
}

function drawCauldron(ctx: CanvasRenderingContext2D, x: number, hurt: number, logo: HTMLCanvasElement | null) {
  ctx.save()
  ctx.translate(x, PLAYER_Y)
  ctx.fillStyle = hurt > 0 ? '#7a1d1d' : '#1d1424'
  ctx.beginPath()
  ctx.moveTo(-PLAYER_HALF, -8)
  ctx.quadraticCurveTo(-PLAYER_HALF - 4, 26, 0, 30)
  ctx.quadraticCurveTo(PLAYER_HALF + 4, 26, PLAYER_HALF, -8)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#7ee05a'
  ctx.beginPath()
  ctx.ellipse(0, -8, PLAYER_HALF, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#2e2236'
  ctx.fillRect(-PLAYER_HALF - 4, -12, PLAYER_HALF * 2 + 8, 5)
  ctx.restore()
  if (logo) {
    // Drawn 1:1 on whole device pixels: a fractional x (the cauldron glides smoothly) would resample the bitmap and blur it.
    const scale = ctx.getTransform().a
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = 0.92
    ctx.drawImage(
      logo,
      Math.round(x * scale - logo.width / 2),
      Math.round((PLAYER_Y + 11) * scale - logo.height / 2),
    )
    ctx.restore()
  }
}

const LOGO_RATIO = 812 / 484
const LOGO_WIDTH = 27

function tintWhite(source: HTMLCanvasElement): HTMLCanvasElement {
  const tinted = document.createElement('canvas')
  tinted.width = source.width
  tinted.height = source.height
  const tintedCtx = tinted.getContext('2d')!
  tintedCtx.drawImage(source, 0, 0)
  tintedCtx.globalCompositeOperation = 'source-in'
  tintedCtx.fillStyle = '#ffffff'
  tintedCtx.fillRect(0, 0, tinted.width, tinted.height)
  return tinted
}

// Shrinking an 812px image straight to ~48px in one drawImage skips most pixels and looks jagged.
// Halving step by step keeps the edges smooth, and the small result is cheap to draw every frame.
function downscaleLogo(image: HTMLImageElement, targetWidth: number): HTMLCanvasElement {
  const ratio = image.naturalWidth / image.naturalHeight || LOGO_RATIO
  let source: CanvasImageSource = image
  let width = image.naturalWidth
  let height = image.naturalHeight
  const finalWidth = Math.max(1, Math.round(targetWidth))
  do {
    width = Math.max(finalWidth, Math.round(width / 2))
    height = Math.max(1, Math.round(width / ratio))
    const step = document.createElement('canvas')
    step.width = width
    step.height = height
    const stepCtx = step.getContext('2d')!
    stepCtx.imageSmoothingEnabled = true
    stepCtx.imageSmoothingQuality = 'high'
    stepCtx.drawImage(source, 0, 0, width, height)
    source = step
  } while (width > finalWidth)
  return source as HTMLCanvasElement
}



function paintStaticBackground(ctx: CanvasRenderingContext2D) {
  const sky = ctx.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#1a0b2e')
  sky.addColorStop(0.65, '#3b1650')
  sky.addColorStop(1, '#5c1f2c')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#fbe7b5'
  ctx.shadowColor = 'rgba(251,231,181,0.6)'
  ctx.shadowBlur = 30
  ctx.beginPath()
  ctx.arc(W - 64, 70, 30, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.fillStyle = '#12081c'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, H - 22)
  ctx.quadraticCurveTo(W * 0.25, H - 40, W * 0.5, H - 20)
  ctx.quadraticCurveTo(W * 0.75, H - 4, W, H - 28)
  ctx.lineTo(W, H)
  ctx.fill()
}

function drawStars(ctx: CanvasRenderingContext2D, stars: { x: number; y: number; s: number }[], time: number) {
  ctx.fillStyle = '#fff4d6'
  for (const star of stars) {
    ctx.globalAlpha = 0.4 + 0.4 * Math.sin(time * 2 + star.x)
    ctx.fillRect(star.x, star.y, star.s, star.s)
  }
  ctx.globalAlpha = 1
}

type Sprite = { image: HTMLCanvasElement; half: number }

function makeSprite(dpr: number, half: number, paint: (ctx: CanvasRenderingContext2D) => void): Sprite {
  const image = document.createElement('canvas')
  image.width = Math.ceil(half * 2 * dpr)
  image.height = Math.ceil(half * 2 * dpr)
  const ctx = image.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.translate(half, half)
  paint(ctx)
  return { image, half }
}

const drawSprite = (ctx: CanvasRenderingContext2D, sprite: Sprite, x: number, y: number) =>
  ctx.drawImage(sprite.image, x - sprite.half, y - sprite.half, sprite.half * 2, sprite.half * 2)

function drawHud(ctx: CanvasRenderingContext2D, score: number, lives: number, combo: number, lifeSprite: Sprite) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath()
  ctx.roundRect(10, 10, W - 20, 40, 14)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = '800 20px system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(String(score), 24, 31)
  if (combo > 1) {
    ctx.fillStyle = '#7ee05a'
    ctx.font = '800 14px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`COMBO x${combo}`, W / 2, 31)
  }
  for (let i = 0; i < START_LIVES; i++) {
    ctx.globalAlpha = i < lives ? 1 : 0.25
    drawSprite(ctx, lifeSprite, W - 32 - i * 26, 31)
  }
  ctx.globalAlpha = 1
}

export function HalloweenGameCanvas({ onGameOver }: { onGameOver: (score: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onGameOverRef = useRef(onGameOver)
  onGameOverRef.current = onGameOver

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d', { alpha: false })
    if (!canvas || !ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    const background = document.createElement('canvas')
    background.width = W * dpr
    background.height = H * dpr
    const backgroundCtx = background.getContext('2d')!
    backgroundCtx.scale(dpr, dpr)
    paintStaticBackground(backgroundCtx)

    let logo: HTMLCanvasElement | null = null
    const logoImage = new Image()
    logoImage.crossOrigin = 'anonymous'
    logoImage.decoding = 'async'
    logoImage.onload = () => {
      logo = tintWhite(downscaleLogo(logoImage, LOGO_WIDTH * dpr))
    }
    logoImage.src = '/images/yummy-logo.webp'

    const sprites = {
      pumpkin: makeSprite(dpr, 22, (c) => drawPumpkin(c, 0, 0, 15, false)),
      golden: makeSprite(dpr, 40, (c) => drawPumpkin(c, 0, 0, 17, true)),
      skull: makeSprite(dpr, 16, (c) => drawSkull(c, 0, 0, 15)),
      life: makeSprite(dpr, 13, (c) => drawPumpkin(c, 0, 0, 9, false)),
    }

    const stars = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.6, s: Math.random() < 0.2 ? 2 : 1 }))
    const items: Item[] = []
    const floaters: Floater[] = []
    const keys = { left: false, right: false }
    let pointerX: number | null = null
    let playerX = W / 2
    let score = 0
    let lives = START_LIVES
    let streak = 0
    let combo = 1
    let hurt = 0
    let elapsed = 0
    let countdown = 3
    let spawnTimer = 0
    let last = performance.now()
    let frame = 0
    let over = false

    let rect = canvas.getBoundingClientRect()
    const refreshRect = () => {
      rect = canvas.getBoundingClientRect()
    }
    const toLocalX = (clientX: number) => ((clientX - rect.left) / rect.width) * W
    let lastKeyDir = 0
    const onPointer = (event: PointerEvent) => {
      pointerX = toLocalX(event.clientX)
    }
    const onPointerDown = (event: PointerEvent) => {
      canvas.setPointerCapture?.(event.pointerId)
      refreshRect()
      onPointer(event)
    }
    const onKey = (event: KeyboardEvent, down: boolean) => {
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        keys.left = down
        if (down) lastKeyDir = -1
      } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        keys.right = down
        if (down) lastKeyDir = 1
      } else return
      event.preventDefault()
      if (down) pointerX = null
    }
    const keyDown = (event: KeyboardEvent) => onKey(event, true)
    const keyUp = (event: KeyboardEvent) => onKey(event, false)

    canvas.addEventListener('pointermove', onPointer)
    canvas.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('resize', refreshRect)
    window.addEventListener('scroll', refreshRect, { capture: true, passive: true })

    const addFloater = (x: number, y: number, text: string, color: string) => floaters.push({ x, y, text, color, life: 0.8 })

    const loseLife = (x: number, y: number) => {
      if (over) return
      lives -= 1
      streak = 0
      combo = 1
      hurt = 0.35
      addFloater(Math.max(20, Math.min(W - 20, x)), y, '-1', '#ff6b6b')
      if (lives > 0) {
        playSound('hit')
        return
      }
      over = true
      playSound('over')
      window.setTimeout(() => onGameOverRef.current(score), 700)
    }

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      if (countdown > 0) {
        const before = Math.ceil(countdown)
        countdown -= dt
        const after = Math.ceil(countdown)
        if (after !== before) playSound(after > 0 ? 'tick' : 'go')
      } else if (!over) {
        elapsed += dt

        const keyDir = keys.left && keys.right ? lastKeyDir : keys.left ? -1 : keys.right ? 1 : 0
        if (keyDir !== 0) playerX += keyDir * 560 * dt
        else if (pointerX !== null) {
          const diff = pointerX - playerX
          playerX += Math.sign(diff) * Math.min(Math.abs(diff), 2600 * dt)
        }
        playerX = Math.max(PLAYER_HALF, Math.min(W - PLAYER_HALF, playerX))

        spawnTimer -= dt
        if (spawnTimer <= 0) {
          spawnTimer = Math.max(0.3, 0.95 - elapsed * 0.012) * (0.75 + Math.random() * 0.5)
          const type = pickType(elapsed)
          const r = type === 'golden' ? 17 : type === 'candy' ? 11 : type === 'bat' ? 13 : 15
          const speed = Math.min(430, 150 + elapsed * 4.2) * (type === 'golden' ? 1.35 : 0.85 + Math.random() * 0.3)
          items.push({ x: 24 + Math.random() * (W - 48), y: -20, vy: speed, phase: Math.random() * 10, type, r })
        }

        for (let i = items.length - 1; i >= 0; i--) {
          const item = items[i]
          item.phase += dt
          item.y += item.vy * dt
          if (item.type === 'bat') item.x = Math.max(16, Math.min(W - 16, item.x + Math.sin(item.phase * 3.2) * 140 * dt))

          const caught = item.y + item.r >= PLAYER_Y - 12 && item.y - item.r <= PLAYER_Y + 8 && Math.abs(item.x - playerX) < PLAYER_HALF + item.r * 0.4
          if (caught) {
            items.splice(i, 1)
            if (isHazard(item.type)) {
              loseLife(item.x, PLAYER_Y - 30)
            } else {
              streak += 1
              const nextCombo = Math.min(3, 1 + Math.floor(streak / 6))
              playSound(nextCombo > combo ? 'combo' : item.type === 'golden' ? 'golden' : item.type === 'candy' ? 'candy' : 'pumpkin')
              combo = nextCombo
              const gained = itemValue[item.type] * combo
              score += gained
              addFloater(item.x, PLAYER_Y - 30, `+${gained}`, item.type === 'golden' ? '#f7c948' : '#ffffff')
            }
          } else if (item.y - item.r > H) {
            items.splice(i, 1)
            if (!isHazard(item.type)) loseLife(item.x, H - 40)
          }
          if (over) break
        }
      }

      hurt = Math.max(0, hurt - dt)
      for (let i = floaters.length - 1; i >= 0; i--) {
        floaters[i].life -= dt
        floaters[i].y -= 50 * dt
        if (floaters[i].life <= 0) floaters.splice(i, 1)
      }

      ctx.drawImage(background, 0, 0, W, H)
      drawStars(ctx, stars, now / 1000)
      for (const item of items) {
        if (item.type === 'pumpkin' || item.type === 'golden' || item.type === 'skull') drawSprite(ctx, sprites[item.type], item.x, item.y)
        else if (item.type === 'candy') drawCandy(ctx, item.x, item.y, item.r, item.phase)
        else drawBat(ctx, item.x, item.y, item.r, item.phase)
      }
      drawCauldron(ctx, playerX, hurt, logo)
      ctx.font = '800 18px system-ui, sans-serif'
      ctx.textAlign = 'center'
      for (const floater of floaters) {
        ctx.globalAlpha = Math.max(0, floater.life / 0.8)
        ctx.fillStyle = floater.color
        ctx.fillText(floater.text, floater.x, floater.y)
      }
      ctx.globalAlpha = 1
      drawHud(ctx, score, lives, combo, sprites.life)

      if (hurt > 0) {
        ctx.fillStyle = `rgba(220,30,30,${hurt * 0.5})`
        ctx.fillRect(0, 0, W, H)
      }
      if (countdown > 0) {
        ctx.fillStyle = 'rgba(10,4,16,0.55)'
        ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#f7c948'
        ctx.font = '900 84px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(Math.ceil(countdown)), W / 2, H / 2)
      }
      if (over) {
        ctx.fillStyle = 'rgba(10,4,16,0.6)'
        ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#ffffff'
        ctx.font = '900 34px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Koniec gry!', W / 2, H / 2 - 10)
        ctx.font = '700 18px system-ui, sans-serif'
        ctx.fillStyle = '#f7c948'
        ctx.fillText(`${score} pkt`, W / 2, H / 2 + 26)
      }

      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(frame)
      canvas.removeEventListener('pointermove', onPointer)
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('resize', refreshRect)
      window.removeEventListener('scroll', refreshRect, { capture: true })
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Plansza gry Dyniowe Łowy. Steruj kociołkiem palcem, myszką lub strzałkami."
      className="mx-auto block aspect-[2/3] h-auto w-full max-w-[360px] touch-none select-none rounded-2xl"
    />
  )
}
