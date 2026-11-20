'use client'

import { useState, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Crown, Ghost, Gift, Sparkles, Trophy } from 'lucide-react'
import { AdventCalendarDialog, useAdventBadge } from '@/components/yummy/advent-calendar'
import { PrizeWheel } from '@/components/yummy/prize-wheel'
import { useWheelConfig } from '@/lib/use-wheel-config'
import type { ClubFeedId } from '@/lib/home-slides'
import { customTileIdFromKey, DEFAULT_CLUB_TILES, type ClubTileOverride, type ClubTilesConfig, type ClubTileTheme, type CustomClubTile } from '@/lib/club-tiles'
import { cn } from '@/lib/utils'
import { ClubGroup } from './club-member-sections'
import { useHalloweenState } from './halloween/halloween-section'
import { useHalloweenResults } from './halloween/halloween-results'

export const ADVENT_TILE_IMAGE = '/images/advent-tile.webp'

type TileProps = {
  eyebrow: string
  title: string
  text: string
  cta: string
  icon: ReactNode
  visual?: ReactNode
  image?: string | null
  onClick?: () => void
  href?: string | null
  className: string
  accent: string
  ctaClass: string
}

const tileClass =
  'group relative isolate flex h-36 w-full flex-col overflow-hidden rounded-3xl p-4 text-left shadow-[0_8px_20px_-12px_rgba(0,0,0,0.45)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:h-44 sm:p-5'

/** One uniform promo tile – the rail stays tidy no matter how many actions are live. */
export function FeedTile({ eyebrow, title, text, cta, icon, visual, image, onClick, href, className, accent, ctaClass }: TileProps) {
  const body = (
    <>
      {image ? (
        <>
          <Image src={image} alt="" fill sizes="(min-width: 1024px) 30vw, 82vw" className="-z-20 object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/45 to-black/5" />
        </>
      ) : (
        visual && (
          <span aria-hidden="true" className="pointer-events-none absolute -bottom-5 -right-6 -z-10 w-32 sm:-bottom-6 sm:w-36">
            {visual}
          </span>
        )
      )}
      <span className="flex items-center gap-1.5">
        <span className={cn('shrink-0 [&_svg]:size-4 sm:[&_svg]:size-5', accent)}>{icon}</span>
        {eyebrow && <span className={cn('truncate rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] sm:px-2 sm:text-[10px]', ctaClass)}>{eyebrow}</span>}
      </span>
      <span className="mt-2.5 block max-w-[62%] text-[15px] font-extrabold leading-[1.15] tracking-tight text-balance sm:max-w-[70%] sm:text-xl">{title}</span>
      {text && <span className="mt-1.5 line-clamp-2 block max-w-[58%] text-[11px] leading-relaxed opacity-80 sm:max-w-[62%] sm:text-xs">{text}</span>}
      {cta && <span className="mt-auto hidden text-xs font-bold sm:inline">{cta}</span>}
      {cta && <span className="sr-only sm:hidden">{cta}</span>}
      {(onClick || href) && (
        <span className="absolute bottom-3 right-3 grid size-8 place-items-center rounded-full bg-white/95 text-ink shadow-md transition-transform group-hover:translate-x-0.5 sm:bottom-4 sm:right-4 sm:size-9">
          <ArrowRight className="size-3.5 sm:size-4" aria-hidden="true" />
        </span>
      )}
    </>
  )

  return (
    <li className="w-[82%] shrink-0 snap-start sm:w-[calc(50%-0.375rem)] lg:w-auto">
      {onClick ? (
        <button type="button" onClick={onClick} aria-haspopup="dialog" className={cn(tileClass, className)}>
          {body}
        </button>
      ) : href?.startsWith('https://') ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={cn(tileClass, className)}>
          {body}
        </a>
      ) : href ? (
        <Link href={href} className={cn(tileClass, className)}>
          {body}
        </Link>
      ) : (
        <div className={cn(tileClass, 'hover:translate-y-0', className)}>{body}</div>
      )}
    </li>
  )
}

const pick = (override: string | undefined, fallback: string) => override?.trim() || fallback

function WheelTile({ freeSpinAvailable, onSpin, override }: { freeSpinAvailable: boolean; onSpin: () => void; override?: ClubTileOverride }) {
  const { extraSpinCost } = useWheelConfig()
  return (
    <FeedTile
      eyebrow={pick(override?.eyebrow, 'Koło fortuny')}
      title={pick(override?.title, 'Zakręć i wygraj!')}
      text={pick(override?.text, freeSpinAvailable ? 'Masz dziś darmowe zakręcenie.' : `Darmowe wróci jutro. Teraz za ${extraSpinCost} pkt.`)}
      cta={freeSpinAvailable ? 'Zakręć za darmo' : `Zakręć za ${extraSpinCost} pkt`}
      icon={freeSpinAvailable ? <Gift className="size-3.5" aria-hidden="true" /> : <Crown className="size-3.5" aria-hidden="true" />}
      visual={<PrizeWheel className="max-w-none" />}
      image={override?.image_url}
      onClick={onSpin}
      className="bg-gradient-to-br from-[#6b2fa0] via-[#4a1f78] to-[#261041] text-white focus-visible:ring-club-gold"
      accent="text-white"
      ctaClass="bg-club-gold text-ink"
    />
  )
}

function AdventTile({ onPointsChange, override }: { onPointsChange: (points: number) => void; override?: ClubTileOverride }) {
  const [open, setOpen] = useState(false)
  const { data, badge, openableToday } = useAdventBadge()
  if (!data || !data.show_club_banner || (data.mode === 'live' && data.ended)) return null
  return (
    <>
      <FeedTile
        eyebrow={pick(override?.eyebrow, badge)}
        title={pick(override?.title, 'Kalendarz adwentowy')}
        text={pick(override?.text, `${data.days} dni, ${data.days} niespodzianek do odebrania.`)}
        cta={openableToday ? 'Otwórz okienko' : 'Zajrzyj'}
        icon={<Gift className="size-3.5" aria-hidden="true" />}
        image={override?.image_url || ADVENT_TILE_IMAGE}
        onClick={() => setOpen(true)}
        className="bg-[#5a0a0e] text-white ring-1 ring-[#f2c14e]/30 focus-visible:ring-[#f2c14e]"
        accent="text-[#f2c14e]"
        ctaClass="bg-[#f2c14e] text-[#3a1306]"
      />
      <AdventCalendarDialog open={open} onOpenChange={setOpen} onPointsChange={onPointsChange} />
    </>
  )
}

function HalloweenTile({ onOpen, override }: { onOpen: () => void; override?: ClubTileOverride }) {
  const { data } = useHalloweenState()
  const ended = Boolean(data && !data.active)
  const { data: results } = useHalloweenResults(ended)
  if (!data) return null

  const prize = results?.mine
  const prizeReady = Boolean(ended && prize?.code && !prize.redeemed && !prize.expired)
  const winner = results?.winners[0]
  const text = !ended
    ? 'Łap dynie, zbieraj punkty i walcz o nagrody.'
    : prizeReady
      ? 'Masz nagrodę do odebrania w lokalu.'
      : results?.my_rank
        ? `Twoje miejsce: ${results.my_rank.rank}. z ${results.players}`
        : winner
          ? `1. miejsce: ${winner.name} · ${winner.score} pkt`
          : 'Zobacz ranking i nagrody.'

  return (
    <FeedTile
      eyebrow={pick(override?.eyebrow, ended ? 'Dyniowe Łowy · koniec' : 'Gra Halloween')}
      title={pick(override?.title, !ended ? 'Dyniowe Łowy' : prizeReady ? 'Wygrałeś nagrodę!' : 'Poznaj zwycięzców')}
      // Live results stay visible once the game ends, so an override only replaces the teaser.
      text={ended ? text : pick(override?.text, text)}
      cta={!ended ? 'Zagraj' : prizeReady ? 'Odbierz' : 'Ranking'}
      icon={ended ? <Trophy className="size-3.5" aria-hidden="true" /> : <Ghost className="size-3.5" aria-hidden="true" />}
      visual={<Ghost className="size-32 -rotate-12 text-[#f07b1d]/25 sm:size-36" strokeWidth={1.25} />}
      image={override?.image_url}
      onClick={onOpen}
      className="bg-[#140a20] text-white ring-1 ring-white/10 focus-visible:ring-[#f07b1d]"
      accent="text-[#f7a93b]"
      ctaClass="bg-[#f07b1d] text-[#140a20]"
    />
  )
}

export const CUSTOM_TILE_THEMES: Record<ClubTileTheme, { root: string; accent: string; badge: string }> = {
  red: { root: 'bg-gradient-to-br from-[#d8342a] via-[#b3231b] to-[#6f120d] text-white focus-visible:ring-[#f6c234]', accent: 'text-[#f6c234]', badge: 'bg-[#f6c234] text-[#2a1a0c]' },
  purple: { root: 'bg-gradient-to-br from-[#6b2fa0] via-[#4a1f78] to-[#261041] text-white focus-visible:ring-club-gold', accent: 'text-white', badge: 'bg-club-gold text-ink' },
  dark: { root: 'bg-[#1d1410] text-white ring-1 ring-white/10 focus-visible:ring-[#f6c234]', accent: 'text-[#f6c234]', badge: 'bg-[#f6c234] text-[#2a1a0c]' },
  gold: { root: 'bg-gradient-to-br from-[#f8d25c] via-[#f6c234] to-[#d99a12] text-[#2a1a0c] focus-visible:ring-[#2a1a0c]', accent: 'text-[#2a1a0c]', badge: 'bg-[#2a1a0c] text-[#f6c234]' },
  green: { root: 'bg-gradient-to-br from-[#2f8a57] via-[#1f6a41] to-[#0f3a22] text-white focus-visible:ring-[#f2c14e]', accent: 'text-[#f2c14e]', badge: 'bg-[#f2c14e] text-[#0f3a22]' },
}

function CustomTile({ tile }: { tile: CustomClubTile }) {
  const theme = CUSTOM_TILE_THEMES[tile.theme]
  return (
    <FeedTile
      eyebrow={tile.eyebrow}
      title={tile.title}
      text={tile.text}
      cta={tile.href ? tile.cta_label || 'Sprawdź' : ''}
      icon={<Sparkles className="size-3.5" aria-hidden="true" />}
      visual={<Sparkles className="size-32 rotate-12 opacity-15 sm:size-36" strokeWidth={1.25} />}
      image={tile.image_url}
      href={tile.href}
      className={cn(theme.root, tile.image_url && 'text-white')}
      accent={tile.image_url ? 'text-white' : theme.accent}
      ctaClass={theme.badge}
    />
  )
}

/**
 * Tiles appear asynchronously (e.g. the advent tile once its data loads). With scroll snapping the browser
 * keeps the previously snapped tile in view, which leaves the rail scrolled to the middle. Until the user
 * scrolls it themselves, keep the rail pinned to its start.
 */
function pinRailToStart(rail: HTMLUListElement | null) {
  if (!rail) return
  let touched = false
  const markTouched = () => { touched = true }
  const pin = () => { if (!touched) rail.scrollLeft = 0 }
  pin()
  const observer = new MutationObserver(() => requestAnimationFrame(pin))
  observer.observe(rail, { childList: true, subtree: true })
  rail.addEventListener('pointerdown', markTouched, { passive: true })
  rail.addEventListener('wheel', markTouched, { passive: true })
  rail.addEventListener('keydown', markTouched)
  return () => {
    observer.disconnect()
    rail.removeEventListener('pointerdown', markTouched)
    rail.removeEventListener('wheel', markTouched)
    rail.removeEventListener('keydown', markTouched)
  }
}

export function ClubHighlights({
  slider,
  hidden = [],
  tiles = DEFAULT_CLUB_TILES,
  freeSpinAvailable,
  onSpin,
  onOpenGame,
  onPointsChange,
}: {
  slider?: ReactNode
  hidden?: ClubFeedId[]
  tiles?: ClubTilesConfig
  freeSpinAvailable: boolean
  onSpin: () => void
  onOpenGame: () => void
  onPointsChange: (points: number) => void
}) {
  const shown = (id: ClubFeedId) => !hidden.includes(id)
  const customById = new Map(tiles.custom.map((tile) => [tile.id, tile]))

  const rail = tiles.order.flatMap((key) => {
    if (key === 'advent') return shown('advent') ? [<AdventTile key={key} override={tiles.overrides.advent} onPointsChange={onPointsChange} />] : []
    if (key === 'wheel') return shown('wheel') ? [<WheelTile key={key} override={tiles.overrides.wheel} freeSpinAvailable={freeSpinAvailable} onSpin={onSpin} />] : []
    if (key === 'halloween') return shown('halloween') ? [<HalloweenTile key={key} override={tiles.overrides.halloween} onOpen={onOpenGame} />] : []
    const tile = customById.get(customTileIdFromKey(key) ?? '')
    return tile && !tile.hidden ? [<CustomTile key={key} tile={tile} />] : []
  })

  const showSlider = Boolean(slider && shown('slider'))
  if (!showSlider && rail.length === 0) return null

  return (
    <ClubGroup id="club-news" title="Na czasie" description="Wydarzenia, gry i akcje sezonowe">
      {showSlider && slider}
      {rail.length > 0 && (
        <div className={showSlider ? 'mt-4 space-y-2.5 sm:mt-6 sm:space-y-3' : 'space-y-2.5 sm:space-y-3'}>
          <h3 id="club-games-heading" className="text-base font-bold tracking-tight sm:text-lg">
            Aktualnie na czasie
          </h3>
          <ul
            ref={pinRailToStart}
            aria-labelledby="club-games-heading"
            className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {rail}
          </ul>
        </div>
      )}
    </ClubGroup>
  )
}
