'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Check, Copy, Crown, PartyPopper, Sparkles, Ticket } from 'lucide-react'
import { fetchHalloweenResults, HALLOWEEN_RESULTS_KEY, prizeLabel, type HalloweenMyPrize } from '@/lib/halloween'
import { formatCouponExpiry } from '@/lib/coupons'
import { cn } from '@/lib/utils'
import { cardClass, ClubSectionTitle } from '../club-member-sections'

const medalColors = ['text-[#f5b936]', 'text-[#b9c0c8]', 'text-[#cd8a5a]']

export function useHalloweenResults(enabled: boolean) {
  return useSWR(enabled ? HALLOWEEN_RESULTS_KEY : null, fetchHalloweenResults, { revalidateOnFocus: false })
}

function HalloweenRunnerUpCard({ prize }: { prize: HalloweenMyPrize }) {
  return (
    <section
      aria-labelledby="halloween-runner-up-title"
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#3b1650] to-[#1f0d33] p-5 text-white shadow-[0_14px_34px_rgba(31,13,51,0.35)] sm:p-6"
    >
      <Sparkles aria-hidden="true" className="absolute -right-3 -top-3 size-24 text-white/10" />
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#f7a93b]">Dyniowe Łowy · wyniki</p>
      <h2 id="halloween-runner-up-title" className="mt-1 text-balance text-2xl font-black leading-tight sm:text-3xl">
        Zająłeś {prize.place}. miejsce!
      </h2>
      <p className="mt-1.5 text-pretty text-sm leading-relaxed text-white/85">
        Dziękujemy za grę – Twój wynik {prize.score} pkt był tuż za podium. W podziękowaniu dodaliśmy Ci{' '}
        <strong className="text-[#f7a93b]">+{prize.stars} Stars</strong>. Powodzenia w następnej rozgrywce!
      </p>
    </section>
  )
}

export function HalloweenWinnerCard({ prize }: { prize: HalloweenMyPrize }) {
  const [copied, setCopied] = useState(false)
  if (!prize.code) return <HalloweenRunnerUpCard prize={prize} />
  const code = prize.code
  const active = !prize.redeemed && !prize.expired

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section
      aria-labelledby="halloween-win-title"
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#f07b1d] to-[#c2410c] p-5 text-white shadow-[0_14px_34px_rgba(240,123,29,0.4)] sm:p-6"
    >
      <PartyPopper aria-hidden="true" className="absolute -right-3 -top-3 size-24 text-white/15" />
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">Dyniowe Łowy · wyniki</p>
      <h2 id="halloween-win-title" className="mt-1 text-balance text-2xl font-black leading-tight sm:text-3xl">
        Wygrałeś! {prize.place}. miejsce
      </h2>
      <p className="mt-1.5 text-pretty text-sm leading-relaxed text-white/90">
        Nagroda: <strong>{prizeLabel(prize.prize)}</strong> – odbierz ją w lokalu.
      </p>

      {active ? (
        <div className="mt-4 rounded-2xl bg-white p-4 text-[#262220]">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#a0602a]">
            <Ticket className="size-3.5" aria-hidden="true" />
            Kod do odbioru przy ladzie
          </p>
          <div className="mt-2 flex items-center gap-2">
            <p className="flex-1 rounded-xl border-2 border-dashed border-[#f07b1d] py-2.5 text-center font-mono text-2xl font-black tracking-[0.2em]">
              {code}
            </p>
            <button
              type="button"
              onClick={copy}
              className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#140a20] text-white transition-transform active:scale-95"
              aria-label={copied ? 'Skopiowano kod' : 'Kopiuj kod'}
            >
              {copied ? <Check className="size-5" aria-hidden="true" /> : <Copy className="size-5" aria-hidden="true" />}
            </button>
          </div>
          <p className="mt-2 text-xs text-[#7a726a]">
            Pokaż kod obsłudze – nagroda zostanie wydana od ręki. {prize.expires_at && `Ważny do ${formatCouponExpiry(prize.expires_at)}.`}
          </p>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-white/15 px-4 py-3 text-sm font-semibold ring-1 ring-white/20">
          {prize.redeemed ? 'Nagroda została odebrana. Smacznego!' : 'Kod na nagrodę wygasł.'}
        </p>
      )}
    </section>
  )
}

export function HalloweenMyRank({ ended }: { ended: boolean }) {
  const { data } = useHalloweenResults(true)
  if (!data || data.mine) return null
  const rank = data.my_rank
  return (
    <section aria-label="Twoje miejsce w rankingu" className={cn('flex items-center gap-3 px-4 py-3.5', cardClass)}>
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#1f0d33] text-lg font-black tabular-nums text-white">
        {rank ? rank.rank : '–'}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-extrabold">
          {rank ? (ended ? `Zająłeś ${rank.rank}. miejsce` : `Jesteś na ${rank.rank}. miejscu`) : 'Nie masz jeszcze wyniku'}
        </span>
        <span className="text-pretty text-xs leading-relaxed text-muted-foreground">
          {rank
            ? `${rank.score} pkt · ${data.players} graczy w rankingu${ended ? '. Dziękujemy za grę!' : ''}`
            : ended
              ? 'Ta rozgrywka już się zakończyła. Zagraj w następnej!'
              : 'Zagraj, aby pojawić się w rankingu.'}
        </span>
      </span>
    </section>
  )
}

export function HalloweenWinnersList({ enabled }: { enabled: boolean }) {
  const { data, isLoading } = useHalloweenResults(enabled)
  if (!enabled) return null

  return (
    <>
      {data?.mine && <HalloweenWinnerCard prize={data.mine} />}
      <section aria-labelledby="halloween-winners-title" className="flex flex-col gap-3">
        <ClubSectionTitle id="halloween-winners-title" title="Zwycięzcy" aside={data?.finalized ? 'Wyniki ostateczne' : undefined} />
        <div className={cn('overflow-hidden', cardClass)}>
          {isLoading ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Ładowanie wyników…</p>
          ) : !data || data.winners.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {data?.finalized ? 'Nikt nie zdobył miejsca na podium.' : 'Ogłaszamy zwycięzców – zajrzyj za chwilę.'}
            </p>
          ) : (
            <ol className="divide-y divide-border">
              {data.winners.map((winner) => (
                <li key={winner.place} className={cn('flex items-center gap-3 px-3.5 py-3 sm:px-4', winner.me && 'bg-[#f07b1d]/10')}>
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#1f0d33]">
                    <Crown className={cn('size-4', medalColors[winner.place - 1])} aria-label={`${winner.place}. miejsce`} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-extrabold">{winner.name}</span>
                      {winner.me && <span className="shrink-0 rounded-full bg-[#f07b1d] px-1.5 py-0.5 text-[10px] font-bold text-white">Ty</span>}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{prizeLabel(winner.prize)}</span>
                  </span>
                  <span className="shrink-0 text-sm font-black tabular-nums">{winner.score}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </>
  )
}
