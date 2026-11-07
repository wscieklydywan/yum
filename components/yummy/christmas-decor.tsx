import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { Logo } from './logo'

type FlakeStyle = CSSProperties & Record<'--drift' | '--dur' | '--delay', string>

const makeFlakes = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    left: (i * 37 + 11) % 100,
    size: 2 + ((i * 7) % 5),
    delay: -(((i * 13) % 20) * 0.7),
    duration: 9 + ((i * 11) % 9),
    drift: ((i * 17) % 50) - 25,
    opacity: 0.35 + ((i * 5) % 6) / 10,
    blur: i % 4 === 0,
  }))

const FLAKES = makeFlakes(42)

/** Lekki śnieg z CSS – pozycje deterministyczne, więc SSR i klient się zgadzają. */
export function Snowfall({ count = 42, className }: { count?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {FLAKES.slice(0, count).map((flake, i) => (
        <span
          key={i}
          className={cn('snowflake', flake.blur && 'blur-[1px]')}
          style={
            {
              left: `${flake.left}%`,
              width: flake.size,
              height: flake.size,
              opacity: flake.opacity,
              '--drift': `${flake.drift}px`,
              '--dur': `${flake.duration}s`,
              '--delay': `${flake.delay}s`,
            } as FlakeStyle
          }
        />
      ))}
    </div>
  )
}

const DRIFT_W = 1200
const DRIFT_H = 90

/**
 * Profil zaspy: suma fal o niewspółmiernych okresach (duże zaspy + średnie garby + drobne grudki),
 * dzięki czemu kształt nie powtarza się jak równa „falbanka”.
 */
const driftProfile = (x: number, seed: number) => {
  const big = Math.sin(x / 190 + seed) * 11 + Math.sin(x / 83 + seed * 2.3) * 6
  const mid = Math.sin(x / 41 + seed * 4.1) * 3.2 * (0.6 + 0.4 * Math.sin(x / 260 + seed))
  const small = Math.sin(x / 13 + seed * 7.7) * 1.1
  return big + mid + small
}

/** Gładka krzywa przez punkty (Catmull-Rom → Bézier). */
const smoothLine = (points: [number, number][]) => {
  let d = `L${points[0][0]} ${points[0][1].toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0]} ${p2[1].toFixed(1)}`
  }
  return d
}

/** Kształt zaspy. `edge` = średnia głębokość krawędzi; dla dołu rysujemy od spodu w górę. */
const buildDrift = (position: 'top' | 'bottom', edge: number, amp: number, seed: number) => {
  const points: [number, number][] = []
  for (let x = 0; x <= DRIFT_W; x += 24) {
    const depth = edge + driftProfile(x, seed) * amp
    points.push([x, position === 'top' ? depth : DRIFT_H - depth])
  }
  const base = position === 'top' ? 0 : DRIFT_H
  return `M0 ${base} ${smoothLine(points)} L${DRIFT_W} ${base} Z`
}

const DRIFTS = {
  top: {
    back: buildDrift('top', 56, 1.1, 1.7),
    front: buildDrift('top', 46, 1, 0.4),
    highlight: buildDrift('top', 22, 0.45, 0.4),
  },
  bottom: {
    back: buildDrift('bottom', 62, 1.15, 2.9),
    front: buildDrift('bottom', 50, 1, 5.2),
    highlight: buildDrift('bottom', 40, 0.9, 5.2),
  },
}

const DRIPS = [
  { cx: 148, rx: 3.5, ry: 9 },
  { cx: 452, rx: 3, ry: 7 },
  { cx: 738, rx: 4, ry: 10 },
  { cx: 1010, rx: 3, ry: 6 },
].map((drip) => ({ ...drip, cy: 46 + driftProfile(drip.cx, 0.4) - 2 }))

const SPARKLES = Array.from({ length: 22 }, (_, i) => {
  const x = (i * 157 + 40) % DRIFT_W
  return { x, offset: 6 + ((i * 29) % 22), r: 0.9 + ((i * 7) % 3) * 0.45 }
})

/** Nieregularna zaspa – tylna warstwa w cieniu, przednia z gradientem, odbłyski i iskierki. */
export function SnowDrift({ position = 'top', className }: { position?: 'top' | 'bottom'; className?: string }) {
  const id = `drift-${position}`
  const shapes = DRIFTS[position]
  const isTop = position === 'top'
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${DRIFT_W} ${DRIFT_H}`}
      preserveAspectRatio="none"
      className={cn(
        'pointer-events-none block w-full',
        isTop ? 'drop-shadow-[0_6px_10px_rgba(0,0,0,0.35)]' : 'drop-shadow-[0_-4px_10px_rgba(0,0,0,0.3)]',
        className,
      )}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          {isTop ? (
            <>
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="65%" stopColor="#f1f5fb" />
              <stop offset="100%" stopColor="#c3d3e7" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="45%" stopColor="#eef3fa" />
              <stop offset="100%" stopColor="#b9cbe1" />
            </>
          )}
        </linearGradient>
      </defs>
      <path d={shapes.back} fill="#a9bdd6" opacity="0.8" />
      <path d={shapes.front} fill={`url(#${id})`} />
      <path d={shapes.highlight} fill="#ffffff" opacity={isTop ? 0.7 : 0.55} />
      {isTop &&
        DRIPS.map((drip) => <ellipse key={drip.cx} cx={drip.cx} cy={drip.cy} rx={drip.rx} ry={drip.ry} fill={`url(#${id})`} />)}
      {SPARKLES.map((s) => {
        const depth = (isTop ? 46 : 50) + driftProfile(s.x, isTop ? 0.4 : 5.2)
        const cy = isTop ? depth - s.offset : DRIFT_H - depth + s.offset
        return <ellipse key={s.x} cx={s.x} cy={cy} rx={s.r * 1.6} ry={s.r} fill="#ffffff" opacity="0.9" />
      })}
    </svg>
  )
}

/** Czapki śniegu: zaokrąglone boki „oblewają” narożniki kafelka, dół z nieregularnymi soplami. */
/**
 * Czapki śniegu: łukowe narożniki oblewają zaokrąglony kafelek i spływają po bokach,
 * góra to miękka poducha, dół – nieregularne, okrągłe zwisy.
 */
const SNOW_CAPS = [
  'M1 34 C0 20 4 10 13 6 C19 3 26 3 32 4 C39 1 47 1 54 3 C61 0 70 1 77 4 C86 6 95 11 98 21 C100 27 100 33 99 38 C98 43 93 43 92 38 C90 34 86 33 83 35 C80 40 73 40 72 35 C68 32 62 32 58 34 C55 39 49 39 47 34 C42 32 36 32 32 34 C29 40 21 40 20 34 C16 31 11 32 8 35 C6 41 1 40 1 34 Z',
  'M1 33 C1 19 6 9 15 5 C22 2 30 2 36 4 C44 1 53 1 60 3 C67 1 75 2 82 5 C91 9 98 16 99 27 C100 31 100 35 99 37 C97 42 92 41 91 36 C87 32 81 33 78 35 C75 41 67 41 66 35 C61 32 54 32 50 34 C47 38 41 38 39 33 C34 31 28 32 24 35 C21 41 13 41 12 35 C9 33 5 33 3 36 C1 38 1 36 1 33 Z',
  'M1 35 C0 22 3 12 11 7 C17 3 24 2 30 4 C36 1 44 0 51 2 C58 0 66 1 72 3 C80 2 90 7 96 15 C99 20 100 28 99 35 C99 41 94 42 92 37 C89 33 84 33 80 35 C77 40 70 40 68 34 C63 31 57 31 53 34 C50 40 42 40 41 34 C37 31 31 32 28 35 C25 39 19 39 17 34 C13 31 8 32 5 36 C3 40 1 39 1 35 Z',
]

export function SnowCap({ className, variant = 0 }: { className?: string; variant?: number }) {
  const path = SNOW_CAPS[variant % SNOW_CAPS.length]
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 44"
      preserveAspectRatio="none"
      className={cn('pointer-events-none absolute drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]', className)}
    >
      <path d={path} fill="#bfd0e4" transform="translate(0 2.2)" />
      <path d={path} fill="#fbfdff" />
      <path d="M9 14 C14 8 22 6 30 7 C38 4 48 4 56 6" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d={path} fill="none" stroke="#dbe6f2" strokeWidth="0.8" opacity="0.7" />
      <ellipse cx="72" cy="11" rx="1.8" ry="1.1" fill="#ffffff" />
    </svg>
  )
}

const TREE_LIGHTS = [
  { x: 44, y: 34, c: '#f2c14e' },
  { x: 56, y: 44, c: '#ff4d4d' },
  { x: 38, y: 56, c: '#5fd38d' },
  { x: 62, y: 62, c: '#f2c14e' },
  { x: 48, y: 70, c: '#ff9f43' },
  { x: 30, y: 82, c: '#ff4d4d' },
  { x: 70, y: 84, c: '#fff4d6' },
  { x: 52, y: 92, c: '#5fd38d' },
]

/** Mała choinka z migoczącymi lampkami i odrobiną śniegu na gałęziach. */
export function ChristmasTree({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 124" className={cn('pointer-events-none', className)}>
      <rect x="44" y="100" width="12" height="14" rx="2" fill="#5a3416" />
      <path d="M50 52 L80 100 C66 105 34 105 20 100 Z" fill="#14593a" />
      <path d="M50 32 L72 74 C61 78 39 78 28 74 Z" fill="#1a6e47" />
      <path d="M50 14 L65 48 C57 51 43 51 35 48 Z" fill="#228556" />
      <path d="M20 100 C30 96 38 104 48 100 C56 97 66 104 80 100 C70 106 32 106 20 100 Z" fill="#f4f8fd" />
      <path d="M28 74 C35 70 42 78 50 74 C57 71 64 77 72 74 C62 79 38 79 28 74 Z" fill="#f4f8fd" />
      <path d="M35 48 C40 45 45 51 50 48 C55 45 60 50 65 48 C58 52 42 52 35 48 Z" fill="#f4f8fd" />
      {TREE_LIGHTS.map((light, i) => (
        <circle
          key={i}
          cx={light.x}
          cy={light.y}
          r="2.6"
          fill={light.c}
          className="tree-light"
          style={{ color: light.c, animationDelay: `${(i % 4) * -0.55}s` }}
        />
      ))}
      <path
        d="M50 2 L53 10 L61 10 L55 15 L57 23 L50 18 L43 23 L45 15 L39 10 L47 10 Z"
        fill="#f7d77c"
        className="tree-star"
      />
    </svg>
  )
}

const BULB_COLORS = ['#f2c14e', '#ff4d4d', '#5fd38d', '#fff4d6', '#ff9f43']

/** Girlanda lampek – y liczone z krzywej Béziera, żeby żarówki wisiały na kablu. */
export function StringLights({ bulbs = 12, className }: { bulbs?: number; className?: string }) {
  const sag = (x: number) => {
    const t = (x % 50) / 50
    return 4 + 56 * t * (1 - t)
  }
  return (
    <div aria-hidden="true" className={cn('pointer-events-none relative h-11 w-full', className)}>
      <svg viewBox="0 0 100 44" preserveAspectRatio="none" className="absolute inset-0 size-full">
        <path d="M0 4 Q25 32 50 4 Q75 32 100 4" fill="none" stroke="#1b3b26" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      {Array.from({ length: bulbs }, (_, i) => {
        const x = ((i + 0.5) / bulbs) * 100
        const color = BULB_COLORS[i % BULB_COLORS.length]
        return (
          <span
            key={i}
            className="absolute flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${x.toFixed(2)}%`, top: Math.round(sag(x) - 1) }}
          >
            <span className="h-1.5 w-1.5 rounded-[2px] bg-[#2b4a34]" />
            <span
              className="christmas-bulb -mt-px h-3 w-2 rounded-full"
              style={{ backgroundColor: color, color, animationDelay: `${(i % 5) * -0.45}s` }}
            />
          </span>
        )
      })}
    </div>
  )
}

/** Bombka zawieszona na nitce – delikatnie się buja. */
export function Bauble({
  color,
  length,
  size = 22,
  delay = 0,
  className,
}: {
  color: string
  length: number
  size?: number
  delay?: number
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn('bauble pointer-events-none absolute top-0 flex flex-col items-center', className)}
      style={{ animationDelay: `${delay}s` }}
    >
      <span className="w-px bg-[#f2c14e]/70" style={{ height: length }} />
      <span className="h-1.5 w-2 rounded-t-[2px] bg-[#e0b04a]" />
      <span
        className="rounded-full shadow-[inset_-4px_-5px_8px_rgba(0,0,0,0.35),0_6px_14px_rgba(0,0,0,0.4)]"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.85) 0 8%, ${color} 30%, color-mix(in oklab, ${color} 55%, black) 100%)`,
        }}
      />
    </span>
  )
}

export function SantaHat({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 82" className={cn('pointer-events-none', className)}>
      <path d="M12 62 C16 34 38 10 64 8 C80 7 92 16 95 34 C88 27 80 25 74 31 C66 40 70 54 80 62 Z" fill="#d71f16" />
      <path d="M60 62 C58 46 64 34 74 31 C80 25 88 27 95 34 C92 20 82 10 70 8 C76 20 70 40 80 62 Z" fill="#8f0d0a" fillOpacity="0.55" />
      <path d="M30 50 C38 30 52 18 66 14" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="4" strokeLinecap="round" fill="none" />
      <rect x="4" y="56" width="84" height="20" rx="10" fill="#f8fbff" />
      <rect x="4" y="68" width="84" height="8" rx="4" fill="#d9e3ee" />
      <circle cx="93" cy="38" r="9" fill="#f8fbff" />
      <circle cx="95" cy="41" r="5" fill="#d9e3ee" />
    </svg>
  )
}

/** Logo Yummy w czapce Mikołaja. */
export function FestiveLogo({ className, variant = 'white' }: { className?: string; variant?: 'red' | 'white' }) {
  return (
    <span className={cn('relative inline-block', className)}>
      <Logo variant={variant} className="h-full w-auto drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]" />
      <SantaHat className="absolute -left-[9%] -top-[34%] w-[38%] -rotate-[18deg] drop-shadow-[0_3px_4px_rgba(0,0,0,0.4)]" />
    </span>
  )
}

/** Prezent z kokardą – czysty CSS, bez obrazków. */
export function GiftBox({
  box,
  ribbon,
  size,
  className,
}: {
  box: string
  ribbon: string
  size: number
  className?: string
}) {
  return (
    <span aria-hidden="true" className={cn('pointer-events-none absolute block', className)} style={{ width: size, height: size }}>
      <span className="absolute -top-[28%] left-1/2 flex -translate-x-1/2 gap-0">
        <span className="block rounded-full border-[3px] -rotate-[30deg]" style={{ width: size * 0.32, height: size * 0.22, borderColor: ribbon }} />
        <span className="block rounded-full border-[3px] rotate-[30deg]" style={{ width: size * 0.32, height: size * 0.22, borderColor: ribbon }} />
      </span>
      <span
        className="absolute inset-x-[-6%] top-0 h-[22%] rounded-[3px] shadow-[0_3px_0_rgba(0,0,0,0.2)]"
        style={{ background: `linear-gradient(180deg, color-mix(in oklab, ${box} 85%, white), ${box})` }}
      />
      <span
        className="absolute inset-x-0 bottom-0 top-[20%] rounded-b-[3px] shadow-[inset_-8px_-6px_12px_rgba(0,0,0,0.3),0_8px_14px_rgba(0,0,0,0.4)]"
        style={{ background: box }}
      />
      <span className="absolute inset-y-0 left-1/2 w-[16%] -translate-x-1/2" style={{ background: ribbon }} />
      <span className="absolute inset-x-[-6%] top-[8%] h-[8%]" style={{ background: ribbon }} />
    </span>
  )
}
