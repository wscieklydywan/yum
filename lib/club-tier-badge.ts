import type { ClubTier } from '@/lib/loyalty'

export const tierBadge: Record<ClubTier['name'], string> = {
  Fan: 'bg-[#f6e4d6] text-[#7a3f1d]',
  'Srebrny Fan': 'bg-zinc-100 text-[#3f4852]',
  'Złoty Fan': 'bg-[#fcefc8] text-[#7a5205]',
}
