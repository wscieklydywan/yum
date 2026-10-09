import type { CSSProperties } from 'react'
import Image from 'next/image'
import { formatCouponDiscount, wheelIcon, type WheelPrize } from '@/lib/wheel'
import type { SpinResult } from './club-spin-wheel'

function PrizeMedallion({ prize }: { prize: WheelPrize | undefined }) {
  if (!prize) return null
  const Icon = wheelIcon(prize.icon)

  return (
    <span
      aria-hidden="true"
      className="absolute left-1/2 top-0 grid size-[22cqw] -translate-x-1/2 -translate-y-1/2 animate-[win-pop_600ms_120ms_cubic-bezier(0.34,1.56,0.64,1)_both] place-items-center rounded-full bg-gradient-to-br from-[#ffe08a] via-[#e89c43] to-[#ffcc65] p-[1.2cqw] shadow-[0_10px_24px_rgba(0,0,0,0.45)] motion-reduce:animate-none"
    >
      <span className="relative grid size-full place-items-center overflow-hidden rounded-full bg-[#fff5e9] text-[#ca211b] ring-2 ring-neutral-950/90">
        {prize.visual === 'image' && prize.image ? (
          <Image src={prize.image} alt="" fill sizes="96px" className="object-cover" />
        ) : (
          <Icon className="size-[55%]" strokeWidth={1.8} />
        )}
      </span>
    </span>
  )
}

const burstColors = ['#ffd36f', '#ff3b2f', '#ffffff', '#f59e0b', '#ffe9a8']

const bursts = [
  { x: 50, y: 50, count: 22, distance: 58, delay: 0, size: 9 },
  { x: 18, y: 22, count: 14, distance: 30, delay: 160, size: 7 },
  { x: 84, y: 24, count: 14, distance: 30, delay: 300, size: 7 },
  { x: 16, y: 78, count: 12, distance: 26, delay: 440, size: 6 },
  { x: 82, y: 80, count: 12, distance: 26, delay: 560, size: 6 },
  { x: 50, y: 10, count: 12, distance: 28, delay: 700, size: 6 },
  { x: 50, y: 50, count: 16, distance: 42, delay: 820, size: 7 },
]

function WinDetails({ result }: { result: SpinResult }) {
  if (result.type === 'nothing') {
    return <p className="mt-2.5 text-[11px] font-medium text-white/60">Tym razem bez nagrody. Spróbuj jutro!</p>
  }
  if (result.type === 'points') {
    return (
      <>
        <p className="mx-auto mt-3 inline-flex items-baseline gap-1 rounded-full bg-[#ffd36f] px-3 py-1 text-neutral-950">
          <span className="text-base font-extrabold tabular-nums leading-none">+{result.prize}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider">pkt</span>
        </p>
        <p className="mt-2.5 text-[11px] font-medium text-white/60">Punkty są już na Twoim koncie</p>
      </>
    )
  }
  const reward =
    result.type === 'free_item'
      ? `Gratis: ${result.productName || result.label}`
      : formatCouponDiscount(result.type === 'discount_percent' ? 'percent' : 'amount', result.discountValue)
  return (
    <>
      <p className="mx-auto mt-3 inline-flex rounded-full bg-[#ffd36f] px-3 py-1 text-xs font-extrabold text-neutral-950">{reward}</p>
      {result.code && (
        <p className="mt-2.5 text-[11px] font-medium text-white/70">
          Kod kuponu: <span className="font-mono text-sm font-bold tracking-widest text-white">{result.code}</span>
        </p>
      )}
      <p className="mt-1 text-[11px] font-medium text-white/60">Pokaż kod przy kasie · znajdziesz go w kuponach</p>
    </>
  )
}

export function ClubWinBurst({ prize, result }: { prize: WheelPrize | undefined; result: SpinResult }) {
  const label = prize?.label ?? result.label

  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
      <span className="absolute inset-[4%] animate-[win-glow_500ms_ease-out_both] rounded-full bg-[radial-gradient(circle,rgba(10,10,10,0.55)_0%,rgba(10,10,10,0.35)_55%,rgba(10,10,10,0)_75%)] motion-reduce:animate-none" />

      <div aria-hidden="true" className="absolute inset-0 motion-reduce:hidden">
        {bursts.map((burst, b) => (
          <span
            key={`flash-${b}`}
            className="absolute size-[18cqw] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 animate-[win-flash_550ms_ease-out_forwards] bg-[radial-gradient(circle,rgba(255,236,170,0.95)_0%,rgba(255,180,60,0.45)_35%,rgba(255,180,60,0)_70%)]"
            style={{ left: `${burst.x}%`, top: `${burst.y}%`, animationDelay: `${burst.delay}ms` }}
          />
        ))}
        {bursts.map((burst, b) =>
          Array.from({ length: burst.count }, (_, i) => {
            const angle = (i / burst.count) * Math.PI * 2 + b
            return (
              <span
                key={`${b}-${i}`}
                className="absolute rounded-full opacity-0 animate-[win-spark_1000ms_cubic-bezier(0.2,0.7,0.3,1)_forwards]"
                style={
                  {
                    left: `${burst.x}%`,
                    top: `${burst.y}%`,
                    width: burst.size,
                    height: burst.size,
                    marginLeft: -burst.size / 2,
                    marginTop: -burst.size / 2,
                    background: burstColors[(i + b) % burstColors.length],
                    boxShadow: `0 0 10px 2px ${burstColors[(i + b) % burstColors.length]}`,
                    animationDelay: `${burst.delay}ms`,
                    '--spark-x': `${Math.cos(angle) * burst.distance}cqw`,
                    '--spark-y': `${Math.sin(angle) * burst.distance}cqw`,
                  } as CSSProperties
                }
              />
            )
          }),
        )}
      </div>

      <div
        role="status"
        aria-live="polite"
        className="relative mt-[10%] w-[84%] animate-[win-pop_520ms_cubic-bezier(0.34,1.56,0.64,1)_both] rounded-2xl border border-white/10 bg-neutral-950/90 px-4 pb-4 pt-[13cqw] text-center text-white shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-md motion-reduce:animate-none"
      >
        <span aria-hidden="true" className="absolute inset-x-6 top-0 h-0.5 bg-gradient-to-r from-transparent via-[#ffd36f] to-transparent" />
        <PrizeMedallion prize={prize} />
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#ffd36f]">
          {result.type === 'nothing' ? 'Pudło!' : 'Gratulacje!'}
        </p>
        <p className="mt-1.5 text-balance text-lg font-extrabold leading-tight tracking-tight sm:text-xl">
          {result.type === 'nothing' ? label : `Wygrywasz ${label}`}
        </p>
        <WinDetails result={result} />
      </div>
    </div>
  )
}
