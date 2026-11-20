import { promotionBadgeLines } from '@/lib/promotions'
import type { Promotion } from '@/lib/promotions'
import { cn } from '@/lib/utils'

type BadgeFields = Pick<Promotion, 'discount_percent'> & Partial<Pick<Promotion, 'kind' | 'buy_quantity' | 'reward_price'>>

const CAP_HEIGHT = 0.72
const CHAR_WIDTH = 0.6
const INNER_WIDTH = 78

/** Round promotion badge whose text is always centred and scaled to fit, whatever the warsztat saved. */
export function PromotionBadge({ promotion, className }: { promotion: BadgeFields; className?: string }) {
  const lines = promotionBadgeLines(promotion)
  const [main, sub] = lines.length === 1 ? [lines[0], null] : lines[0].length <= lines[1].length ? [lines[1], lines[0]] : [lines[0], lines[1]]
  const subFirst = sub !== null && lines[0] === sub
  const mainSize = Math.min(sub ? 34 : 40, INNER_WIDTH / (Math.max(main.length, 1) * CHAR_WIDTH))
  const subSize = sub ? Math.min(20, INNER_WIDTH / (Math.max(sub.length, 1) * CHAR_WIDTH), mainSize * 0.75) : 0
  const gap = sub ? 7 : 0
  const height = mainSize * CAP_HEIGHT + (sub ? subSize * CAP_HEIGHT + gap : 0)
  const top = 50 - height / 2
  const firstSize = subFirst ? subSize : mainSize
  const firstBaseline = top + firstSize * CAP_HEIGHT
  const secondBaseline = firstBaseline + gap + (subFirst ? mainSize : subSize) * CAP_HEIGHT

  return (
    <span className={cn('grid shrink-0 place-items-center rounded-full bg-primary text-primary-foreground', className)}>
      <svg viewBox="0 0 100 100" className="size-full" role="img" aria-label={lines.join(' ')}>
        {sub === null ? (
          <text x="50" y={firstBaseline} textAnchor="middle" fontSize={mainSize} fontWeight={900} fill="currentColor">{main}</text>
        ) : (
          <>
            <text x="50" y={firstBaseline} textAnchor="middle" fontSize={firstSize} fontWeight={subFirst ? 800 : 900} fill="currentColor">{lines[0]}</text>
            <text x="50" y={secondBaseline} textAnchor="middle" fontSize={subFirst ? mainSize : subSize} fontWeight={subFirst ? 900 : 800} fill="currentColor">{lines[1]}</text>
          </>
        )}
      </svg>
    </span>
  )
}
