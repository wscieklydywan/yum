import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeRoles, MANAGER_ROLES } from '@/lib/workshop-auth'
import { loadTierSettings } from '@/lib/club-tiers-server'
import { MAX_TIER_PERCENT, MAX_TIER_PERK_LENGTH, MAX_TIER_PERKS, MAX_TIER_THRESHOLD, type ClubTierSettings } from '@/lib/loyalty'
import { invalidatesPublic, PUBLIC_LOYALTY_TAG } from '@/lib/public-cache'

export async function GET() {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  try {
    const admin = createAdminClient()
    const settings = await loadTierSettings(admin)
    const [members, silverCount, goldCount] = await Promise.all([
      admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'klient'),
      admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'klient').gte('status_points', settings.silverMin).lt('status_points', settings.goldMin),
      admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'klient').gte('status_points', settings.goldMin),
    ])
    const total = members.count ?? 0
    const silverTotal = silverCount.count ?? 0
    const goldTotal = goldCount.count ?? 0
    return NextResponse.json(
      { settings, counts: { fan: Math.max(0, total - silverTotal - goldTotal), silver: silverTotal, gold: goldTotal } },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch {
    return NextResponse.json({ error: 'Nie udało się pobrać poziomów.' }, { status: 503 })
  }
}

function cleanPerks(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().replace(/\s+/g, ' ').slice(0, MAX_TIER_PERK_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_TIER_PERKS)
}

const validPercent = (value: number) => Number.isFinite(value) && value >= 0 && value <= MAX_TIER_PERCENT

export const PUT = invalidatesPublic([PUBLIC_LOYALTY_TAG], handlePUT)

async function handlePUT(request: Request) {
  const auth = await authorizeRoles(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const body = (await request.json().catch(() => null)) as Partial<ClubTierSettings> | null
  const silverMin = Number(body?.silverMin)
  const goldMin = Number(body?.goldMin)
  const silverPercent = Math.round(Number(body?.silverPercent) * 100) / 100
  const goldPercent = Math.round(Number(body?.goldPercent) * 100) / 100

  if (!Number.isInteger(silverMin) || !Number.isInteger(goldMin) || silverMin < 1 || goldMin > MAX_TIER_THRESHOLD) {
    return NextResponse.json({ error: `Progi muszą być liczbami całkowitymi od 1 do ${MAX_TIER_THRESHOLD.toLocaleString('pl-PL')}.` }, { status: 400 })
  }
  if (goldMin <= silverMin) return NextResponse.json({ error: 'Próg Złotego Fana musi być wyższy niż Srebrnego.' }, { status: 400 })
  if (!validPercent(silverPercent) || !validPercent(goldPercent)) {
    return NextResponse.json({ error: `Rabat musi wynosić od 0 do ${MAX_TIER_PERCENT}%.` }, { status: 400 })
  }

  const perks = { fan: cleanPerks(body?.perks?.fan), silver: cleanPerks(body?.perks?.silver), gold: cleanPerks(body?.perks?.gold) }
  const { error } = await createAdminClient()
    .from('restaurant_settings')
    .update({
      silver_fan_threshold_points: silverMin,
      gold_fan_threshold_points: goldMin,
      silver_fan_discount_percent: silverPercent,
      gold_fan_discount_percent: goldPercent,
      fan_perks: perks.fan.join('\n'),
      silver_fan_perks: perks.silver.join('\n'),
      gold_fan_perks: perks.gold.join('\n'),
    })
    .eq('id', 1)
  if (error) return NextResponse.json({ error: 'Nie udało się zapisać poziomów.' }, { status: 503 })

  const settings: ClubTierSettings = { silverMin, goldMin, silverPercent, goldPercent, perks }
  return NextResponse.json({ settings })
}
