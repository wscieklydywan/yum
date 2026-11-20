const CAP_HEIGHT = 0.72
const LABEL_SIZE = 15
const GAP = 8

/** Scales with its container, so the same number reads well on a small wheel slice and on the big win medallion. */
export function PointsBadge({ points, className }: { points: number; className?: string }) {
  const value = String(points)
  const fontSize = value.length <= 2 ? 46 : value.length === 3 ? 38 : value.length === 4 ? 30 : 24
  const blockHeight = fontSize * CAP_HEIGHT + GAP + LABEL_SIZE * CAP_HEIGHT
  const valueBaseline = 50 - blockHeight / 2 + fontSize * CAP_HEIGHT
  const labelBaseline = valueBaseline + GAP + LABEL_SIZE * CAP_HEIGHT
  return (
    <svg viewBox="0 0 100 100" className={className ?? 'size-full'} aria-hidden="true">
      <text x="50" y={valueBaseline} textAnchor="middle" fontSize={fontSize} fontWeight={900} fill="currentColor" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </text>
      <text x="50" y={labelBaseline} textAnchor="middle" fontSize={LABEL_SIZE} fontWeight={800} fill="currentColor">
        PKT
      </text>
    </svg>
  )
}
