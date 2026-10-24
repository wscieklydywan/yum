import { Logo } from '@/components/yummy/logo'
import { cn } from '@/lib/utils'

const round = (value: number) => Math.round(value * 100) / 100

function webPaths(spokes: number, rings: number[], size: number) {
  const angles = Array.from({ length: spokes }, (_, i) => (i / (spokes - 1)) * (Math.PI / 2))
  const point = (radius: number, angle: number) => [round(radius * Math.cos(angle)), round(radius * Math.sin(angle))]
  const spokePaths = angles.map((angle) => {
    const [x, y] = point(size * 1.05, angle)
    return `M0 0 L${x} ${y}`
  })
  const ringPaths = rings.map((radius) => {
    let path = ''
    angles.forEach((angle, i) => {
      const [x, y] = point(radius, angle)
      if (i === 0) {
        path = `M${x} ${y}`
        return
      }
      const [cx, cy] = point(radius * 0.84, (angle + angles[i - 1]) / 2)
      path += ` Q${cx} ${cy} ${x} ${y}`
    })
    return path
  })
  return [...spokePaths, ...ringPaths]
}

const cornerWeb = webPaths(6, [16, 32, 50, 70, 92], 100)

export function SpiderWeb({ className, flip }: { className?: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={cn('pointer-events-none text-white/25', flip && '-scale-x-100', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={0.9}
      strokeLinecap="round"
    >
      {cornerWeb.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

export function HangingSpider({ className, thread = 40 }: { className?: string; thread?: number }) {
  return (
    <svg
      viewBox={`0 0 24 ${thread + 20}`}
      aria-hidden="true"
      className={cn('pointer-events-none origin-top animate-[spider-sway_4s_ease-in-out_infinite] text-white/80', className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
    >
      <path d={`M12 0 V${thread + 4}`} strokeWidth={0.6} className="text-white/40" stroke="currentColor" />
      <g transform={`translate(12 ${thread + 10})`} strokeWidth={1.1}>
        <path d="M-3 -2 L-8 -6 L-10 -2 M-3 0 L-9 -1 L-11 3 M-3 2 L-8 4 L-9 8 M-2 3 L-5 7 L-5 10" />
        <path d="M3 -2 L8 -6 L10 -2 M3 0 L9 -1 L11 3 M3 2 L8 4 L9 8 M2 3 L5 7 L5 10" />
        <ellipse cx="0" cy="1" rx="3.6" ry="4.4" fill="currentColor" stroke="none" />
        <circle cx="0" cy="-4.2" r="2.4" fill="currentColor" stroke="none" />
        <circle cx="-0.9" cy="-4.6" r="0.55" fill="#f07b1d" stroke="none" />
        <circle cx="0.9" cy="-4.6" r="0.55" fill="#f07b1d" stroke="none" />
      </g>
    </svg>
  )
}

export function SpookyLogo({ className }: { className?: string }) {
  return (
    <div className={cn('relative inline-flex', className)}>
      <SpiderWeb className="absolute -left-3 -top-3 size-10 text-white/45" />
      <SpiderWeb flip className="absolute -right-3 -top-3 size-7 text-white/35" />
      <Logo variant="white" className="relative h-9 w-auto drop-shadow-[0_2px_10px_rgba(240,123,29,0.55)] sm:h-11" />
      <HangingSpider className="absolute -bottom-9 right-1 h-12 w-4" thread={22} />
    </div>
  )
}

export function BatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 20" aria-hidden="true" className={cn('h-4 w-6 shrink-0', className)}>
      <path
        d="M16 5.5 C13 2 8 2 1 5 C4.5 7 5 10 4.5 13 C7 11.5 9 12 10.5 14 C12 12.5 14 13 16 16 C18 13 20 12.5 21.5 14 C23 12 25 11.5 27.5 13 C27 10 27.5 7 31 5 C24 2 19 2 16 5.5 Z"
        fill="#2a1640"
        stroke="rgba(200,160,255,0.95)"
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
      <rect x="13.6" y="7.4" width="1.6" height="1.6" fill="#ff4d4d" />
      <rect x="16.8" y="7.4" width="1.6" height="1.6" fill="#ff4d4d" />
    </svg>
  )
}

export function PumpkinIcon({ className, gold }: { className?: string; gold?: boolean }) {
  return (
    <span aria-hidden="true" className={cn('relative inline-block size-5 shrink-0', className)}>
      <span className="absolute left-1/2 top-0 h-1.5 w-1 -translate-x-1/2 rounded-sm bg-[#4f8a3a]" />
      <span
        className={cn(
          'absolute inset-x-0 bottom-0 top-1 rounded-[45%] shadow-[inset_-3px_-2px_0_rgba(0,0,0,0.18)]',
          gold ? 'bg-[#f7c948]' : 'bg-[#f07b1d]',
        )}
      />
      <span className="absolute bottom-0 left-1/2 top-1 w-[35%] -translate-x-1/2 rounded-[45%] border-x border-black/15" />
    </span>
  )
}
