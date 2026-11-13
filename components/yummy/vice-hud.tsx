'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, TreePalm } from 'lucide-react'
import { WantedLevel } from './wanted-level'
import { ViceLottery } from './vice-lottery'
import { cn } from '@/lib/utils'

const FIRST_NAMES = ['Lucia', 'Jason', 'Tommy', 'Rico', 'Vanessa', 'Marco', 'Carla', 'Diego', 'Nina', 'Ray']
const LAST_NAMES = ['Caminos', 'Vercetti', 'Duval', 'Montana', 'Reyes', 'Ortega', 'Santos', 'Castillo', 'Navarro', 'Cruz']
const CRIMES = ['Kradzież frytek', 'Podwójny cheddar bez pozwolenia', 'Przekroczenie limitu sosu', 'Nielegalny głód', 'Ucieczka z dietą']

type Identity = { name: string; dob: string; id: string; crime: string }

function pick<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

function randomIdentity(): Identity {
  const year = 1980 + Math.floor(Math.random() * 25)
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')
  return {
    name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    dob: `${day}.${month}.${year}`,
    id: `L${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}-VC`,
    crime: pick(CRIMES),
  }
}

/** Pinned bottom-right GTA VI HUD: wanted level plus a random State of Leonida ID card. */
export function ViceHud({ className }: { className?: string }) {
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [open, setOpen] = useState(false)

  // Random data is created only in the browser so server and client markup match.
  useEffect(() => setIdentity(randomIdentity()), [])

  return (
    <aside aria-label="Yummy City HUD" className={cn('pointer-events-none fixed bottom-3 right-3 z-40 flex flex-col items-end gap-2 sm:bottom-5 sm:right-5', className)}>
      {open && identity && (
        <div className="vice-id-enter pointer-events-auto max-h-[calc(100dvh-9rem)] w-72 overflow-y-auto overscroll-contain rounded-xl bg-[#fdf4ec] text-[#1a0b24] shadow-2xl shadow-[#c2185b]/30 ring-1 ring-black/10">
          <div className="flex items-center justify-between bg-gradient-to-r from-[#ff6fa8] via-[#ff8a3d] to-[#ffd166] px-3 py-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">State of Leonida</span>
            <TreePalm className="size-4" aria-hidden="true" />
          </div>
          <div className="flex gap-3 p-3">
            <div aria-hidden="true" className="grid size-16 shrink-0 place-items-end overflow-hidden rounded-md bg-gradient-to-b from-[#4dd0e1] to-[#c2185b]">
              <span className="mx-auto mb-[-6px] block size-12 rounded-t-full bg-[#1a0b24]/80" />
            </div>
            <dl className="min-w-0 text-[10px] leading-tight">
              <dt className="font-bold uppercase text-[#c2185b]">Nazwisko</dt>
              <dd className="truncate text-xs font-black">{identity.name}</dd>
              <dt className="mt-1 font-bold uppercase text-[#c2185b]">Ur.</dt>
              <dd className="font-semibold">{identity.dob}</dd>
              <dt className="mt-1 font-bold uppercase text-[#c2185b]">Nr ID</dt>
              <dd className="font-mono font-semibold">{identity.id}</dd>
            </dl>
          </div>
          <p className="border-t border-dashed border-black/15 px-3 py-2 text-[10px] font-semibold">
            <span className="font-black uppercase text-[#c2185b]">Zarzut: </span>
            {identity.crime}
          </p>
          <ViceLottery />
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="pointer-events-auto flex items-center gap-2 rounded-lg bg-black/75 px-2.5 py-1.5 text-white shadow-lg ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-black/85"
      >
        <span className="flex flex-col items-start">
          <WantedLevel size="sm" />
          <span className="mt-0.5 text-[9px] font-black uppercase tracking-[0.3em] text-[#ff6fa8]">Wanted · Yummy City</span>
        </span>
        <ChevronDown className={cn('size-4 text-white/70 transition-transform', open ? 'rotate-0' : 'rotate-180')} aria-hidden="true" />
        <span className="sr-only">{open ? 'Ukryj dowód Leonida' : 'Pokaż dowód Leonida'}</span>
      </button>
    </aside>
  )
}
