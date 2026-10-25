'use client'

import Image from 'next/image'
import { Crown } from 'lucide-react'
import { useWheelPrizes } from '@/lib/use-wheel-prizes'
import { wheelIcon, type WheelPrize } from '@/lib/wheel'

const lights = Array.from({ length: 14 }, (_, index) => {
  const radians = ((index * 360) / 14) * (Math.PI / 180)
  return { id: index, left: `${50 + Math.sin(radians) * 46}%`, top: `${50 - Math.cos(radians) * 46}%` }
})

const CREAM = '#fff0df'
const RED = '#dc2520'
const GOLD = '#f4b740'

function segmentColor(index: number, count: number) {
  if (count % 2 === 1 && index === count - 1) return GOLD
  return index % 2 === 0 ? CREAM : RED
}

function wheelBackground(count: number) {
  const step = 360 / count
  const stops = Array.from({ length: count }, (_, index) => `${segmentColor(index, count)} ${index * step}deg ${(index + 1) * step}deg`)
  const offset = -step / 2
  return `repeating-conic-gradient(from ${offset}deg, transparent 0deg ${step - 1}deg, rgba(130, 47, 29, 0.35) ${step - 1}deg ${step}deg), conic-gradient(from ${offset}deg, ${stops.join(', ')})`
}

export function segmentAngle(count: number) {
  return 360 / Math.max(count, 1)
}

export function PrizeWheel({
  rotation = 0,
  durationMs = 0,
  className = 'max-w-[15rem] sm:max-w-[21rem] lg:max-w-[24rem]',
  prizes: prizesOverride,
  highlight,
}: {
  rotation?: number
  durationMs?: number
  className?: string
  prizes?: WheelPrize[]
  highlight?: number
}) {
  const { data } = useWheelPrizes()
  const prizes = prizesOverride ?? data
  const count = prizes.length
  const step = segmentAngle(count)
  const badgeSize = count <= 6 ? 17 : count <= 8 ? 14.5 : 12
  const radius = count <= 6 ? 27 : 29

  return (
    <div aria-hidden="true" className={`relative mx-auto aspect-square w-full ${className}`}>
      <div className="absolute inset-[1%] rounded-full bg-gradient-to-br from-[#ffe08a] via-[#e89c43] to-[#ffcc65] p-[1.4%] shadow-[0_12px_28px_rgba(75,0,0,0.28)]">
        <div className="relative size-full rounded-full bg-[#bd1c18] p-[3.2%] shadow-[inset_0_0_0_1px_rgba(255,242,210,0.6)]">
          <div
            className="absolute inset-0 will-change-transform"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: durationMs ? `transform ${durationMs}ms cubic-bezier(0.15, 0.7, 0.1, 1)` : undefined,
            }}
          >
            <div
              className="absolute inset-[6%] rounded-full border border-[#6c1b15]/45 bg-no-repeat bg-origin-border shadow-[inset_0_2px_8px_rgba(80,15,8,0.22)]"
              style={{ backgroundImage: wheelBackground(count) }}
            />
            {prizes.map((prize, index) => {
              const radians = index * step * (Math.PI / 180)
              const Icon = wheelIcon(prize.icon)
              const style = {
                left: `${50 + Math.sin(radians) * radius}%`,
                top: `${50 - Math.cos(radians) * radius}%`,
                width: `${badgeSize}%`,
                height: `${badgeSize}%`,
              }
              const ring = highlight === index ? 'ring-[3px] ring-[#ffd36f] ring-offset-1 ring-offset-[#bd1c18]' : ''
              return prize.visual === 'image' && prize.image ? (
                <span
                  key={prize.id}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-[#fff8ed] p-[1%] shadow-[0_3px_8px_rgba(59,20,10,0.22)] ${ring}`}
                  style={style}
                >
                  <span className="relative block size-full overflow-hidden rounded-full">
                    <Image src={prize.image} alt="" fill sizes="64px" className="object-cover" />
                  </span>
                </span>
              ) : (
                <span
                  key={prize.id}
                  className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#fff5e9] text-[#ca211b] shadow-[0_3px_8px_rgba(59,20,10,0.2)] ${ring}`}
                  style={style}
                >
                  <Icon className="size-[56%]" strokeWidth={1.8} />
                </span>
              )
            })}
          </div>

          {lights.map(({ id, left, top }) => (
            <span
              key={id}
              className="absolute size-[2.4%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fff4c5] shadow-[0_0_5px_2px_rgba(255,204,78,0.72)]"
              style={{ left, top }}
            />
          ))}

          <span className="absolute left-1/2 top-1/2 grid size-[25%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-[#efaa49] bg-[radial-gradient(circle_at_35%_28%,#f33e2d,#bf1715_65%,#85100e)] text-[#ffd36f] shadow-[0_3px_10px_rgba(70,0,0,0.38)]">
            <Crown className="size-[48%]" strokeWidth={1.7} />
          </span>
        </div>
      </div>

      <svg className="absolute left-1/2 top-[-1%] z-10 h-[16%] w-[13%] -translate-x-1/2 drop-shadow-[0_3px_3px_rgba(80,0,0,0.35)]" viewBox="0 0 64 84" fill="none" aria-hidden="true">
        <path d="M11 4.5h42c5 0 7.7 3.7 5.5 8.2L37.2 74c-2.1 5.2-8.3 5.2-10.4 0L5.5 12.7C3.3 8.2 6 4.5 11 4.5Z" fill="#D92720" stroke="#FFD36F" strokeWidth="5" strokeLinejoin="round" />
        <path d="M14 10h36" stroke="#FFF1C0" strokeOpacity=".75" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  )
}
